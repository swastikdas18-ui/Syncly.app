-- ==============================================================================
-- SYNCLY / WORK-CONNECT: RLS RECURSION REMEDIATION
-- Migration: 017_rls_recursion_remediation.sql
--
-- Objective:
--   Eliminate PostgreSQL 42P17 infinite recursion error on public.memberships
--   by introducing SECURITY DEFINER helper functions to check roles without
--   invoking recursive Row-Level Security checks.
--
-- Pre-conditions:
--   - public.memberships table exists with columns: id, user_id, community_id, role, joined_at
--   - Policies on memberships, posts, audit_logs, and community_join_requests
--     referencing memberships are safely refactored to use the helpers.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Function: is_community_admin(p_community_id UUID)
-- Evaluates whether the current authenticated caller (auth.uid()) holds an
-- active 'owner' or 'admin' role in the specified community.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_community_admin(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.community_id = p_community_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_community_admin(UUID) IS 
'Security Definer helper checking if auth.uid() holds owner or admin role in target community, eliminating RLS policy self-recursion.';

REVOKE ALL ON FUNCTION public.is_community_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_admin(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Helper Function: is_community_intern(p_community_id UUID)
-- Evaluates whether the current authenticated caller (auth.uid()) is restricted
-- with the 'intern' role in the specified community or profile.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_community_intern(p_community_id UUID)
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

COMMENT ON FUNCTION public.is_community_intern(UUID) IS 
'Security Definer helper checking if auth.uid() has intern role, eliminating posts insert policy recursion on memberships.';

REVOKE ALL ON FUNCTION public.is_community_intern(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_intern(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Refactor Policies on public.memberships
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.memberships;
CREATE POLICY "Users can view their own memberships"
ON public.memberships FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Community admins can view community members" ON public.memberships;
CREATE POLICY "Community admins can view community members"
ON public.memberships FOR SELECT
USING (public.is_community_admin(community_id));

DROP POLICY IF EXISTS "Admins can update memberships" ON public.memberships;
CREATE POLICY "Admins can update memberships"
ON public.memberships FOR UPDATE
USING (public.is_community_admin(community_id));

-- ------------------------------------------------------------------------------
-- 4. Refactor Policy on public.posts (INSERT)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_posts_insert ON public.posts;
CREATE POLICY tenant_isolation_posts_insert ON public.posts
  FOR INSERT WITH CHECK (
    public.is_tenant_member(tenant_id) 
    AND author_id = auth.uid()
    AND NOT public.is_community_intern(tenant_id)
  );

-- ------------------------------------------------------------------------------
-- 5. Refactor Policy on public.audit_logs (SELECT)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT USING (
    public.is_community_admin(tenant_id)
  );

-- ------------------------------------------------------------------------------
-- 6. Refactor Policy on public.community_join_requests (SELECT)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view community join requests" ON public.community_join_requests;
CREATE POLICY "Admins can view community join requests"
ON public.community_join_requests FOR SELECT
USING (public.is_community_admin(community_id));
