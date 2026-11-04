-- ==============================================================================
-- SYNCLY / WORK-CONNECT MULTI-MEMBERSHIP & COMMUNITY FULL-TEXT SEARCH MIGRATION
-- Migration: 010_multi_memberships.sql
-- ==============================================================================

-- 1. Ensure the memberships table enforces unique user-community constraints
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'intern')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_community ON public.memberships(community_id);

-- 2. Add Full-Text Search Vector & GIN Index on communities / tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS search_vector tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(tagline, '') || ' ' || coalesce(industry, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_communities_search ON public.tenants USING GIN(search_vector);

-- 3. Row-Level Security (RLS) on memberships
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own memberships
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.memberships;
CREATE POLICY "Users can view their own memberships"
ON public.memberships FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Community owners and admins can view all members in their community
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

-- Policy 3: Users can self-join (INSERT) if the target community allows instant joining
DROP POLICY IF EXISTS "Users can self-join communities" ON public.memberships;
CREATE POLICY "Users can self-join communities"
ON public.memberships FOR INSERT
WITH CHECK (
  user_id = auth.uid()
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

-- Policy 4: Community owners and admins can manage member roles
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
