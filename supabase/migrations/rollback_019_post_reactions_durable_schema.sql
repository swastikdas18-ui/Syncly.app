-- ==============================================================================
-- SYNCLY MIGRATION ROLLBACK: 019_post_reactions_durable_schema.sql
-- ==============================================================================
-- Safely removes public.toggle_post_reaction() RPC and drops public.post_reactions.
-- Restores database to Migration 018 state.
-- ==============================================================================

-- 1. Drop atomic RPC function
DROP FUNCTION IF EXISTS public.toggle_post_reaction(UUID, TEXT);

-- 2. Drop RLS policies on post_reactions
DROP POLICY IF EXISTS "post_reactions_select_member" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_insert_self" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_delete_self" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_service_role_all" ON public.post_reactions;

-- 3. Drop durable table and constraints
DROP TABLE IF EXISTS public.post_reactions CASCADE;
