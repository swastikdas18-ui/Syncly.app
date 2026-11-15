-- ==============================================================================
-- SYNCLY: WORKSPACE MEMBER DIRECTORY VISIBILITY
--
-- Members of a workspace may view the membership roster for that same workspace.
-- This enables the Members directory for ordinary members while preserving
-- strict tenant isolation. Access still requires an authenticated caller and
-- public.is_tenant_member() verifies their own membership in the target tenant.
-- ==============================================================================

ALTER POLICY "Community admins can view community members"
  ON public.memberships
  USING (public.is_tenant_member(community_id));

ALTER POLICY "Community admins can view community members"
  ON public.memberships
  RENAME TO "Workspace members can view workspace directory";
