-- ==============================================================================
-- SYNCLY: PROFILE VISIBILITY BY VERIFIED WORKSPACE MEMBERSHIP
--
-- The multi-workspace architecture uses public.memberships as the authoritative
-- relationship. profiles.tenant_id is legacy/nullable and cannot be the tenant
-- visibility predicate for users who belong through memberships.
--
-- Allow a signed-in user to read:
--   1. their own profile; and
--   2. profiles of users who share at least one verified workspace with them.
--
-- This preserves tenant isolation while allowing the roster and presence sidebar
-- to display colleague names, roles, and avatars.
-- ==============================================================================

ALTER POLICY "profiles_select_policy"
ON public.profiles
TO authenticated
USING (
  id = (select auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.memberships AS target_membership
    WHERE target_membership.user_id = profiles.id
      AND public.is_tenant_member(target_membership.community_id)
  )
);
