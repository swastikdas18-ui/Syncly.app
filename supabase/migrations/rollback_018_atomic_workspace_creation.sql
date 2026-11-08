-- ==============================================================================
-- SYNCLY / WORK-CONNECT: ROLLBACK FOR 018_atomic_workspace_creation.sql
-- ==============================================================================

-- 1. Drop create_workspace RPC
DROP FUNCTION IF EXISTS public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN);

-- 2. Restore protect_membership_privileged_fields trigger function to Migration 017 state
CREATE OR REPLACE FUNCTION public.protect_membership_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req_role TEXT;
  v_is_owner BOOLEAN;
  v_has_approved_request BOOLEAN;
BEGIN
  -- Determine request role safely using Supabase session context (Fail Closed)
  BEGIN
    v_req_role := COALESCE(
      auth.role(),
      NULLIF(current_setting('request.jwt.claim.role', true), ''),
      (auth.jwt() ->> 'role'),
      NULLIF(current_setting('role', true), ''),
      'authenticated'
    );
  EXCEPTION WHEN OTHERS THEN
    v_req_role := 'authenticated';
  END;

  -- Only apply client guards to authenticated or anonymous connections
  IF v_req_role IN ('authenticated', 'anon') THEN

    -- =========================================================================
    -- A. ON INSERT: Client self-enrollment and approved join workflow guards
    -- =========================================================================
    IF TG_OP = 'INSERT' THEN
      -- Direct self-enrollment cannot grant privileged roles (admin/owner/manager)
      IF NEW.role NOT IN ('member', 'employee') THEN
        RAISE EXCEPTION 'Permission denied: Direct membership creation cannot grant privileged roles.'
          USING ERRCODE = '42501';
      END IF;

      -- If inserting for another user (NEW.user_id != auth.uid()), verify:
      -- 1. Caller is an active community admin/owner in the target community.
      -- 2. An authentic APPROVED join request exists for this applicant, community, and reviewer.
      IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        IF NOT private.is_community_admin(NEW.community_id) THEN
          RAISE EXCEPTION 'Permission denied: Only workspace administrators can enroll other users.'
            USING ERRCODE = '42501';
        END IF;

        -- Strictly verify that an APPROVED request exists, reviewed by this admin
        SELECT EXISTS (
          SELECT 1 FROM public.community_join_requests r
          WHERE r.user_id = NEW.user_id
            AND r.community_id = NEW.community_id
            AND r.status = 'approved'
            AND r.reviewed_by = auth.uid()
        ) INTO v_has_approved_request;

        IF NOT v_has_approved_request THEN
          RAISE EXCEPTION 'Permission denied: Cannot create membership without an authorized approved join request.'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

    -- =========================================================================
    -- B. ON UPDATE: Strict privilege boundary enforcement
    -- =========================================================================
    IF TG_OP = 'UPDATE' THEN
      -- Invariant 1: user_id and community_id are strictly immutable
      IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Permission denied: Membership user_id is immutable.'
          USING ERRCODE = '42501';
      END IF;

      IF NEW.community_id IS DISTINCT FROM OLD.community_id THEN
        RAISE EXCEPTION 'Permission denied: Membership community_id is immutable.'
          USING ERRCODE = '42501';
      END IF;

      -- Invariant 2: No user can alter their own membership role (self-escalation / self-demotion blocked)
      IF NEW.user_id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Permission denied: Users cannot alter their own membership role.'
          USING ERRCODE = '42501';
      END IF;

      -- Invariant 3: Role transition authorization checks
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        v_is_owner := private.is_community_owner(OLD.community_id);

        -- Rule 3a: Only active community owners can grant 'owner' or 'admin' roles
        IF NEW.role IN ('owner', 'admin') AND NOT v_is_owner THEN
          RAISE EXCEPTION 'Permission denied: Only community owners can grant owner or admin roles.'
            USING ERRCODE = '42501';
        END IF;

        -- Rule 3b: Only active community owners can demote existing 'owner' or 'admin' members
        IF OLD.role IN ('owner', 'admin') AND NOT v_is_owner THEN
          RAISE EXCEPTION 'Permission denied: Only community owners can modify existing owner or admin memberships.'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_membership_privileged_fields() IS 
'Enforces membership privilege boundaries: prevents privilege self-escalation and validates approved join requests.';
