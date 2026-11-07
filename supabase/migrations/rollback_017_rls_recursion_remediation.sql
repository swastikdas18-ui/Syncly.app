-- ==============================================================================
-- SYNCLY / WORK-CONNECT: ROLLBACK FOR 017_rls_recursion_remediation.sql
-- ==============================================================================

DROP POLICY IF EXISTS "Admins can view community join requests" ON public.community_join_requests;
CREATE POLICY "Admins can view community join requests"
ON public.community_join_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.community_id = community_join_requests.community_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE community_id = audit_logs.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS tenant_isolation_posts_insert ON public.posts;
CREATE POLICY tenant_isolation_posts_insert ON public.posts
  FOR INSERT WITH CHECK (
    public.is_tenant_member(tenant_id) 
    AND author_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships 
      WHERE community_id = tenant_id AND user_id = auth.uid() AND role = 'intern'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tenant_id = tenant_id AND role = 'intern'
    )
  );

DROP POLICY IF EXISTS "Admins can update memberships" ON public.memberships;
CREATE POLICY "Admins can update memberships"
ON public.memberships FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.community_id = memberships.community_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Community admins can view community members" ON public.memberships;
CREATE POLICY "Community admins can view community members"
ON public.memberships FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships AS m
    WHERE m.community_id = memberships.community_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Users can view their own memberships" ON public.memberships;
CREATE POLICY "Users can view their own memberships"
ON public.memberships FOR SELECT
USING (user_id = auth.uid());

DROP FUNCTION IF EXISTS public.is_community_intern(UUID);
DROP FUNCTION IF EXISTS public.is_community_admin(UUID);
