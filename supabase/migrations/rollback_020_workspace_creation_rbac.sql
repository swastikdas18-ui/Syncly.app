-- ==============================================================================
-- ROLLBACK MIGRATION: 020_workspace_creation_rbac.sql
-- FAIL-CLOSED SECURITY ROLLBACK:
--
-- Objective:
--   Never restore an insecure, unauthenticated, or un-guarded create_workspace RPC.
--   Restoring the pre-020 implementation allows direct RPC invocation without RBAC.
--
-- Rollback Strategy:
--   1. Replace public.create_workspace with a fail-closed stub that explicitly rejects
--      all execution with HTTP 503 Service Unavailable / Maintenance Mode.
--   2. Revoke execution permissions from PUBLIC and authenticated roles.
--   3. Maintain execution strictly for service_role for operational recovery.
--   4. Document operational consequence: Workspace provisioning is temporarily
--      disabled until a reviewed security remediation is applied.
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
BEGIN
  -- Fail-closed operational boundary: prevent any unauthorized or direct RPC execution during rollback
  RETURN jsonb_build_object(
    'success', false,
    'status', 503,
    'error', 'Service Temporarily Unavailable. Workspace creation is currently suspended for administrative maintenance.'
  );
END;
$$;

COMMENT ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) IS 
'Fail-closed rollback stub: workspace creation is disabled to prevent insecure direct RPC execution.';

-- Strict Execution Boundary: Revoke all caller execution during rollback
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN) TO service_role;
