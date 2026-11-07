-- ==============================================================================
-- SYNCLY / WORK-CONNECT: RLS RECURSION REMEDIATION & PRIVILEGE BOUNDARY HARDENING
-- Migration: 017_rls_recursion_remediation.sql
--
-- Objective:
--   1. Eliminate PostgreSQL 42P17 infinite recursion error on public.memberships
--      by introducing SECURITY DEFINER helper functions in an unexposed 'private' schema.
--   2. Strict Privilege Boundary Enforcement on Memberships:
--      - Only an active community owner can grant or revoke 'owner' and 'admin' roles.
--      - An ordinary admin cannot promote another member to admin or owner.
--      - An ordinary admin cannot demote an owner or another admin.
--      - No user can alter their own membership role (self-escalation blocked).
--      - user_id and community_id on memberships are strictly immutable.
--      - Direct client INSERT on memberships is restricted to 'member' or 'employee' role.
--      - Direct client creation of 'admin' or 'owner' memberships is blocked.
--   3. Preservation of Approved Join Request Workflow:
--      - Reconciles public.review_join_request() with trigger validation:
--        Updates community_join_requests status to 'approved' FIRST before inserting
--        the membership, allowing the trigger to verify an authentic 'approved' request
--        reviewed by the current admin in the same transaction.
--      - Rejects direct 3rd-party inserts without an approved request.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ensure Private Schema Exists and is Secured
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

COMMENT ON SCHEMA private IS 
'Private administrative schema for internal SECURITY DEFINER functions, isolated from PostgREST public API.';

-- Revoke all default permissions on private schema from PUBLIC
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Helper Function: private.is_community_admin(p_community_id UUID)
-- Evaluates whether the caller (auth.uid()) is an active user with 'owner' or 'admin'
-- role in target community. Checks profile.status = 'active'.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_community_admin(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.community_id = p_community_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
      AND p.status = 'active'
  );
$$;

COMMENT ON FUNCTION private.is_community_admin(UUID) IS 
'Security Definer helper checking if auth.uid() is an active owner/admin in target community, eliminating RLS policy self-recursion.';

REVOKE ALL ON FUNCTION private.is_community_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_community_admin(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Helper Function: private.is_community_owner(p_community_id UUID)
-- Evaluates whether the caller (auth.uid()) is an active user with 'owner' role.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_community_owner(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.community_id = p_community_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
      AND p.status = 'active'
  );
$$;

COMMENT ON FUNCTION private.is_community_owner(UUID) IS 
'Security Definer helper checking if auth.uid() is an active owner in target community.';

REVOKE ALL ON FUNCTION private.is_community_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_community_owner(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Helper Function: private.is_community_intern(p_community_id UUID)
-- Evaluates whether the caller holds the canonical 'intern' role.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_community_intern(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.community_id = p_community_id
        AND m.user_id = auth.uid()
        AND m.role = 'intern'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = p_community_id
        AND p.role = 'intern'
    )
  );
$$;

COMMENT ON FUNCTION private.is_community_intern(UUID) IS 
'Security Definer helper checking if auth.uid() has intern role, eliminating posts insert policy recursion on memberships.';

REVOKE ALL ON FUNCTION private.is_community_intern(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_community_intern(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. Trigger Function: Protect Membership Privileged Fields & Boundaries
-- ------------------------------------------------------------------------------
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
      session_user::text
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

DROP TRIGGER IF EXISTS trg_protect_membership_privileged_fields ON public.memberships;
CREATE TRIGGER trg_protect_membership_privileged_fields
BEFORE INSERT OR UPDATE ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.protect_membership_privileged_fields();

-- ------------------------------------------------------------------------------
-- 6. Canonical Review Join Request Update (Transaction Reordering)
-- Updates status to 'approved' FIRST before inserting membership row so the
-- trigger can verify an authentic approved join request in the same transaction.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_join_request(
  p_request_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_caller_id UUID;
  v_reviewer_profile RECORD;
  v_is_admin BOOLEAN;
  v_requester_status TEXT;
  v_existing_membership_id UUID;
  v_new_membership_id UUID;
BEGIN
  -- 1. Validate authenticated caller
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 401,
      'error', 'Unauthorized. Cryptographically verified Supabase authentication required.'
    );
  END IF;

  -- 2. Validate action input
  IF p_action NOT IN ('approve', 'reject') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Invalid action. Supported actions are: approve, reject.'
    );
  END IF;

  -- 3. Validate reviewer profile exists and is active
  SELECT status INTO v_reviewer_profile
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_reviewer_profile.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Forbidden. Reviewer account is inactive, suspended, or does not exist.'
    );
  END IF;

  -- 4. Lock the pending request row to prevent concurrent race conditions
  SELECT * INTO v_req
  FROM public.community_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 404,
      'error', 'Join request not found.'
    );
  END IF;

  -- 5. Validate request is currently pending
  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'Join request is already ' || v_req.status || '.'
    );
  END IF;

  -- 6. Reject self-approval (Reviewer cannot approve/reject their own request)
  IF v_req.user_id = v_caller_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Self-approval forbidden. Reviewer cannot review their own join request.'
    );
  END IF;

  -- 7. Validate active owner/admin membership in the target tenant
  SELECT private.is_community_admin(v_req.community_id) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Forbidden. Only active admins or owners of this workspace can review join requests.'
    );
  END IF;

  -- 8. Validate applicant profile exists and is active
  SELECT status INTO v_requester_status
  FROM public.profiles
  WHERE id = v_req.user_id;

  IF NOT FOUND OR v_requester_status IS NULL OR v_requester_status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Requester account is deactivated, suspended, or does not exist.'
    );
  END IF;

  -- 9. Check for an existing membership explicitly (Deterministic conflict handling)
  IF p_action = 'approve' THEN
    SELECT id INTO v_existing_membership_id
    FROM public.memberships
    WHERE user_id = v_req.user_id
      AND community_id = v_req.community_id
    LIMIT 1;

    IF v_existing_membership_id IS NOT NULL THEN
      UPDATE public.community_join_requests
      SET status = 'approved',
          reviewed_by = v_caller_id,
          reviewed_at = NOW()
      WHERE id = p_request_id;

      RETURN jsonb_build_object(
        'success', false,
        'status', 409,
        'error', 'Conflict. Applicant already holds active membership in this workspace.',
        'membership_id', v_existing_membership_id
      );
    END IF;

    -- 10. Update the request status to 'approved' FIRST in transaction
    UPDATE public.community_join_requests
    SET status = 'approved',
        reviewed_by = v_caller_id,
        reviewed_at = NOW()
    WHERE id = p_request_id;

    -- 11. Create exactly one membership with server-controlled role 'member'
    INSERT INTO public.memberships (user_id, community_id, role, joined_at)
    VALUES (v_req.user_id, v_req.community_id, 'member', NOW())
    RETURNING id INTO v_new_membership_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 200,
      'action', 'approved',
      'membership_id', v_new_membership_id,
      'community_id', v_req.community_id,
      'message', 'Join request approved and membership created.'
    );
  ELSE
    -- Action = 'reject'
    UPDATE public.community_join_requests
    SET status = 'rejected',
        reviewed_by = v_caller_id,
        reviewed_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 200,
      'action', 'rejected',
      'community_id', v_req.community_id,
      'message', 'Join request rejected.'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_join_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_join_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_join_request(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. Clean up any previous public helpers if they existed
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_community_admin(UUID);
DROP FUNCTION IF EXISTS public.is_community_intern(UUID);

-- ------------------------------------------------------------------------------
-- 8. Refactor Policies on public.memberships
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.memberships;
CREATE POLICY "Users can view their own memberships"
ON public.memberships FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Community admins can view community members" ON public.memberships;
CREATE POLICY "Community admins can view community members"
ON public.memberships FOR SELECT
USING (private.is_community_admin(community_id));

DROP POLICY IF EXISTS "Users can self-join communities" ON public.memberships;
CREATE POLICY "Users can self-join communities"
ON public.memberships FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND role IN ('member', 'employee')
  AND EXISTS (
    SELECT 1 FROM public.tenants AS t
    WHERE t.id = memberships.community_id
      AND (
        t.requires_approval = false 
        OR auth.jwt() ->> 'email' LIKE ANY(
          SELECT '%' || d FROM unnest(t.allowed_domains) AS d
        )
      )
  )
);

DROP POLICY IF EXISTS "Admins can update memberships" ON public.memberships;
CREATE POLICY "Admins can update memberships"
ON public.memberships FOR UPDATE
USING (private.is_community_admin(community_id))
WITH CHECK (
  private.is_community_admin(community_id)
  AND (role NOT IN ('owner', 'admin') OR private.is_community_owner(community_id))
);

-- ------------------------------------------------------------------------------
-- 9. Refactor Policy on public.posts (INSERT)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_posts_insert ON public.posts;
CREATE POLICY tenant_isolation_posts_insert ON public.posts
  FOR INSERT WITH CHECK (
    public.is_tenant_member(tenant_id) 
    AND author_id = auth.uid()
    AND NOT private.is_community_intern(tenant_id)
  );

-- ------------------------------------------------------------------------------
-- 10. Refactor Policy on public.audit_logs (SELECT)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT USING (
    private.is_community_admin(tenant_id)
  );

-- ------------------------------------------------------------------------------
-- 11. Refactor Policy on public.community_join_requests (SELECT)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view community join requests" ON public.community_join_requests;
CREATE POLICY "Admins can view community join requests"
ON public.community_join_requests FOR SELECT
USING (private.is_community_admin(community_id));
