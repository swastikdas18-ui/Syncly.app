-- ==============================================================================
-- ROLLBACK MIGRATION: 020_workspace_creation_rbac.sql
-- Restores public.create_workspace to Migration 018 baseline.
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
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 401,
      'error', 'Unauthorized. Cryptographically verified Supabase authentication required.'
    );
  END IF;

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

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug) THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 409,
      'error', 'A workspace with slug ''' || v_clean_slug || ''' already exists. Please choose a different name.'
    );
  END IF;

  v_clean_tagline := COALESCE(NULLIF(TRIM(p_tagline), ''), NULLIF(TRIM(p_description), ''), 'Enterprise Corporate Community');
  v_clean_description := COALESCE(TRIM(p_description), '');
  v_clean_industry := COALESCE(NULLIF(TRIM(p_industry), ''), 'Technology');
  v_clean_logo_url := COALESCE(NULLIF(TRIM(p_logo_url), ''), 'https://api.dicebear.com/7.x/identicon/svg?seed=' || v_clean_slug);

  SELECT ARRAY(
    SELECT DISTINCT LOWER(TRIM(LEADING '@' FROM TRIM(d)))
    FROM unnest(COALESCE(p_allowed_domains, '{}'::TEXT[])) AS d
    WHERE TRIM(LEADING '@' FROM TRIM(d)) <> ''
  ) INTO v_clean_domains;

  v_new_tenant_id := gen_random_uuid();

  INSERT INTO public.tenants (
    id, name, slug, tagline, description, logo_url, industry, requires_approval, allowed_domains, is_discoverable, created_at
  ) VALUES (
    v_new_tenant_id, v_clean_name, v_clean_slug, v_clean_tagline, v_clean_description, v_clean_logo_url, v_clean_industry, COALESCE(p_requires_approval, false), v_clean_domains, COALESCE(p_is_discoverable, true), NOW()
  )
  RETURNING * INTO v_tenant_record;

  PERFORM set_config('syncly.internal_workspace_creation', 'true', true);

  v_new_membership_id := gen_random_uuid();
  INSERT INTO public.memberships (
    id, user_id, community_id, role, joined_at
  ) VALUES (
    v_new_membership_id, v_caller_id, v_new_tenant_id, 'owner', NOW()
  );

  v_new_audit_id := gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, tenant_id, actor_id, action, target_resource, metadata, created_at
  ) VALUES (
    v_new_audit_id, v_new_tenant_id, v_caller_id, 'workspace_created', 'tenant:' || v_new_tenant_id::TEXT,
    jsonb_build_object('name', v_clean_name, 'slug', v_clean_slug, 'membership_id', v_new_membership_id, 'initial_role', 'owner'),
    NOW()
  );

  PERFORM set_config('syncly.internal_workspace_creation', 'false', true);

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
