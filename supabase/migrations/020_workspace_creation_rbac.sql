-- ==============================================================================
-- SYNCLY / WORK-CONNECT: WORKSPACE CREATION RBAC ENFORCEMENT & RPC HARDENING
-- Migration: 020_workspace_creation_rbac.sql
--
-- Objective:
--   1. Enforce strict Database-Level Authorization Policy on public.create_workspace:
--      - Caller MUST be cryptographically authenticated (auth.uid() IS NOT NULL)
--      - Caller profile MUST be status = 'active'
--      - Caller authorization check:
--        * If caller has existing memberships in public.memberships:
--          Caller MUST hold 'owner' or 'admin' role in AT LEAST ONE workspace.
--          Callers whose memberships are strictly 'manager', 'member', 'employee', or 'intern'
--          are REJECTED with HTTP 403 Forbidden.
--        * If caller has zero memberships in public.memberships:
--          Permit initial first-workspace onboarding creation (assigns caller as initial 'owner').
--      - Lookup failure on memberships fails closed with HTTP 403 / 500.
--   2. Maintain search_path = public, pg_temp and SECURITY DEFINER safety.
--   3. Maintain transaction-local setting 'syncly.internal_workspace_creation' for
--      trigger reconciliation with public.protect_membership_privileged_fields().
--   4. Revoke old/unrestricted execution paths; grant EXECUTE strictly to authenticated, service_role.
-- ==============================================================================

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
  v_membership_count INT;
  v_is_authorized_admin_or_owner BOOLEAN;
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

  -- 2. Validate caller account is active in profiles with row lock to eliminate onboarding concurrency race
  SELECT status INTO v_caller_status
  FROM public.profiles
  WHERE id = v_caller_id
  FOR UPDATE;

  IF v_caller_status IS NULL OR v_caller_status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 403,
      'error', 'Forbidden. Only active user profiles can create workspaces.'
    );
  END IF;

  -- 3. Canonical Authorization Policy at Database Engine Level
  -- Check user's verified memberships:
  SELECT 
    COUNT(*),
    BOOL_OR(role IN ('owner', 'admin'))
  INTO 
    v_membership_count,
    v_is_authorized_admin_or_owner
  FROM public.memberships
  WHERE user_id = v_caller_id;

  -- If user already belongs to at least one workspace:
  -- They MUST have 'admin' or 'owner' role in at least one workspace.
  -- Managers, Members, Interns, and Employees are strictly forbidden from creating workspaces.
  IF v_membership_count > 0 THEN
    IF NOT COALESCE(v_is_authorized_admin_or_owner, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 403,
        'error', 'Forbidden. Workspace creation is restricted to Organization Administrators and Owners.'
      );
    END IF;
  ELSE
    -- Zero-membership onboarding: verified new users with 0 memberships are allowed
    -- to create their initial organization workspace.
    NULL;
  END IF;

  -- 4. Input validation & sanitization
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

  -- Clean slug: lowercase, replace non-alphanumeric with hyphens
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

  -- 5. Return success response
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
'Atomic workspace creation RPC with database-level RBAC: restricts workspace creation to Admins/Owners and verified 0-membership onboarding.';

-- ------------------------------------------------------------------------------
-- Execution Permissions: Restrict strictly to authenticated and service_role
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) TO authenticated, service_role;
