-- ==============================================================================
-- SYNCLY / WORK-CONNECT: ATOMIC WORKSPACE CREATION RPC & PRIVILEGE BOUNDARY RECONCILIATION
-- Migration: 018_atomic_workspace_creation.sql
--
-- Objective:
--   1. Reconcile protect_membership_privileged_fields() trigger:
--      Permits initial 'owner' role insertion ONLY when executed inside the
--      internal create_workspace RPC transaction scope:
--      (current_setting('syncly.internal_workspace_creation', true) = 'true' AND NEW.user_id = auth.uid())
--      Direct client INSERTs of 'owner'/'admin' remain strictly blocked.
--   2. Atomic PostgreSQL RPC: public.create_workspace(...)
--      Executes tenant insertion, creator owner membership insertion, and audit log
--      atomically in a single ACID transaction.
--      Rolls back fully if any step fails; guarantees no orphaned tenants or unowned workspaces.
--   3. Strict Security Definer controls:
--      - SET search_path = public, pg_temp
--      - Validates caller authentication (auth.uid() IS NOT NULL)
--      - Validates active profile status
--      - Validates input boundaries (slug, name, allowed_domains normalization)
--      - Enforces uniqueness on tenant slug
--      - REVOKE from PUBLIC/anon; GRANT EXECUTE to authenticated, service_role
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Reconcile Trigger Function: Protect Membership Privileged Fields
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
  v_is_internal_creation BOOLEAN;
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
    -- A. ON INSERT: Client self-enrollment, approved join workflow, and atomic creation
    -- =========================================================================
    IF TG_OP = 'INSERT' THEN
      -- Check if this insertion is occurring within public.create_workspace()
      v_is_internal_creation := (COALESCE(current_setting('syncly.internal_workspace_creation', true), 'false') = 'true');

      IF v_is_internal_creation THEN
        -- Inside atomic workspace creation: only the authenticated caller can be assigned initial 'owner'
        IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.role <> 'owner' THEN
          RAISE EXCEPTION 'Permission denied: Atomic workspace creation only permits initial owner assignment to creator.'
            USING ERRCODE = '42501';
        END IF;
      ELSE
        -- Outside internal workspace creation: direct self-enrollment cannot grant privileged roles (admin/owner/manager)
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
'Enforces membership privilege boundaries: prevents privilege self-escalation, validates approved join requests, and reconciles atomic workspace creation.';

-- ------------------------------------------------------------------------------
-- 2. Atomic Workspace Creation RPC: public.create_workspace(...)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name TEXT,
  p_slug TEXT,
  p_tagline TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_allowed_domains TEXT[] DEFAULT '{}',
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_is_discoverable BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_status TEXT;
  v_clean_name TEXT;
  v_clean_slug TEXT;
  v_clean_tagline TEXT;
  v_clean_description TEXT;
  v_clean_logo_url TEXT;
  v_clean_industry TEXT;
  v_clean_domains TEXT[];
  v_new_tenant_id UUID;
  v_new_membership_id UUID;
  v_new_audit_id UUID;
  v_tenant_record RECORD;
BEGIN
  -- 1. Fail-closed caller authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 401,
      'error', 'Unauthorized. Cryptographically verified Supabase authentication required.'
    );
  END IF;

  -- 2. Validate caller account is active
  SELECT status INTO v_caller_status
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_status IS NULL OR v_caller_status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Forbidden. Only active user profiles can create workspaces.'
    );
  END IF;

  -- 3. Input validation & sanitization
  v_clean_name := TRIM(p_name);
  IF v_clean_name IS NULL OR v_clean_name = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Workspace name is required.'
    );
  END IF;

  IF LENGTH(v_clean_name) > 100 THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Workspace name must not exceed 100 characters.'
    );
  END IF;

  -- Clean slug: lowercase, replace invalid characters with hyphens
  v_clean_slug := COALESCE(NULLIF(TRIM(p_slug), ''), v_clean_name);
  v_clean_slug := LOWER(REGEXP_REPLACE(v_clean_slug, '[^a-zA-Z0-9]+', '-', 'g'));
  v_clean_slug := TRIM(BOTH '-' FROM v_clean_slug);

  IF v_clean_slug IS NULL OR v_clean_slug = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'A valid URL-friendly workspace slug could not be determined.'
    );
  END IF;

  IF LENGTH(v_clean_slug) > 63 THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 400,
      'error', 'Workspace slug must not exceed 63 characters.'
    );
  END IF;

  -- Check slug uniqueness with deterministic conflict handling
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug) THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'A workspace with slug ''' || v_clean_slug || ''' already exists. Please choose a different name.'
    );
  END IF;

  -- Metadata defaults & sanitization
  v_clean_tagline := COALESCE(NULLIF(TRIM(p_tagline), ''), NULLIF(TRIM(p_description), ''), 'Enterprise Corporate Community');
  v_clean_description := COALESCE(TRIM(p_description), '');
  v_clean_industry := COALESCE(NULLIF(TRIM(p_industry), ''), 'Technology');
  v_clean_logo_url := COALESCE(NULLIF(TRIM(p_logo_url), ''), 'https://api.dicebear.com/7.x/identicon/svg?seed=' || v_clean_slug);

  -- Normalize allowed_domains: lowercase, strip leading @, remove whitespace
  SELECT ARRAY(
    SELECT DISTINCT LOWER(TRIM(LEADING '@' FROM TRIM(d)))
    FROM unnest(COALESCE(p_allowed_domains, '{}'::TEXT[])) AS d
    WHERE TRIM(LEADING '@' FROM TRIM(d)) <> ''
  ) INTO v_clean_domains;

  -- Generate new UUID for tenant
  v_new_tenant_id := gen_random_uuid();

  -- =========================================================================
  -- ATOMIC TRANSACTION EXECUTION
  -- =========================================================================

  -- Step 1: Insert tenant record
  INSERT INTO public.tenants (
    id,
    name,
    slug,
    tagline,
    description,
    logo_url,
    industry,
    requires_approval,
    allowed_domains,
    is_discoverable,
    created_at
  ) VALUES (
    v_new_tenant_id,
    v_clean_name,
    v_clean_slug,
    v_clean_tagline,
    v_clean_description,
    v_clean_logo_url,
    v_clean_industry,
    COALESCE(p_requires_approval, false),
    v_clean_domains,
    COALESCE(p_is_discoverable, true),
    NOW()
  )
  RETURNING * INTO v_tenant_record;

  -- Step 2: Set transaction-local session setting so trigger recognizes valid workspace creation
  PERFORM set_config('syncly.internal_workspace_creation', 'true', true);

  -- Step 3: Insert creator initial owner membership
  v_new_membership_id := gen_random_uuid();
  INSERT INTO public.memberships (
    id,
    user_id,
    community_id,
    role,
    joined_at
  ) VALUES (
    v_new_membership_id,
    v_caller_id,
    v_new_tenant_id,
    'owner',
    NOW()
  );

  -- Step 4: Record audit log entry atomically
  v_new_audit_id := gen_random_uuid();
  INSERT INTO public.audit_logs (
    id,
    tenant_id,
    actor_id,
    action,
    target_resource,
    metadata,
    created_at
  ) VALUES (
    v_new_audit_id,
    v_new_tenant_id,
    v_caller_id,
    'workspace_created',
    'tenant:' || v_new_tenant_id::TEXT,
    jsonb_build_object(
      'name', v_clean_name,
      'slug', v_clean_slug,
      'membership_id', v_new_membership_id,
      'initial_role', 'owner'
    ),
    NOW()
  );

  -- Reset transaction-local session setting
  PERFORM set_config('syncly.internal_workspace_creation', 'false', true);

  -- 4. Return success response
  RETURN jsonb_build_object(
    'success', true,
    'status', 201,
    'message', 'Workspace created successfully with initial owner membership.',
    'data', jsonb_build_object(
      'id', v_new_tenant_id,
      'name', v_tenant_record.name,
      'slug', v_tenant_record.slug,
      'tagline', v_tenant_record.tagline,
      'description', v_tenant_record.description,
      'logoUrl', v_tenant_record.logo_url,
      'industry', v_tenant_record.industry,
      'allowedDomains', v_clean_domains,
      'requiresApproval', v_tenant_record.requires_approval,
      'isDiscoverable', v_tenant_record.is_discoverable,
      'memberCount', 1,
      'createdAt', v_tenant_record.created_at,
      'role', 'owner'
    )
  );
END;
$$;

COMMENT ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) IS 
'Atomic workspace creation RPC: creates tenant, initial creator owner membership, and audit log in a single transaction.';

-- ------------------------------------------------------------------------------
-- 3. Strict Execution Permissions
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) TO authenticated, service_role;
