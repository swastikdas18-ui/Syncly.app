-- ==============================================================================
-- SYNCLY: TENANT MEMBERSHIP POLICY ROLE SCOPE
--
-- Anonymous sessions must not evaluate membership/audit policies that call
-- private.is_community_admin(). That helper is intentionally executable by
-- authenticated users only. Keeping these policies on PUBLIC causes stale or
-- anonymous sessions to fail with SQLSTATE 42501 instead of returning an
-- empty/unauthorized result.
--
-- This migration narrows the affected policies to authenticated users. The
-- existing row predicates remain unchanged, so tenant isolation is preserved.
-- ==============================================================================

ALTER POLICY "Admins can update memberships"
  ON public.memberships TO authenticated;

ALTER POLICY "Community admins can view community members"
  ON public.memberships TO authenticated;

ALTER POLICY "Users can self-join communities"
  ON public.memberships TO authenticated;

ALTER POLICY "Users can view their own memberships"
  ON public.memberships TO authenticated;

ALTER POLICY "audit_logs_admin_select"
  ON public.audit_logs TO authenticated;

ALTER POLICY "audit_logs_insert"
  ON public.audit_logs TO authenticated;
