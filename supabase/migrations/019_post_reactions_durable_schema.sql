-- ==============================================================================
-- SYNCLY MIGRATION 019: DURABLE POST REACTIONS SCHEMA & ATOMIC RPC MUTATION
-- ==============================================================================
-- Objective:
-- 1. Eliminate in-memory reaction tracking as the source of truth.
-- 2. Establish a durable public.post_reactions table with strict (post_id, user_id)
--    uniqueness constraint, foreign keys, indexing, and tenant isolation RLS.
-- 3. Provide public.toggle_post_reaction() RPC to execute ACID atomic mutations,
--    guaranteeing non-negative counts and zero race conditions under concurrency.
-- ==============================================================================

-- 1. Create public.post_reactions table
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_post_reactions_post_user UNIQUE (post_id, user_id)
);

-- 2. Performance & Join Indexes
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON public.post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON public.post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_tenant_id ON public.post_reactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_tenant_post ON public.post_reactions(tenant_id, post_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Policy 1: SELECT - Members can read reactions for posts in workspaces they belong to
DROP POLICY IF EXISTS "post_reactions_select_member" ON public.post_reactions;
CREATE POLICY "post_reactions_select_member" ON public.post_reactions
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT community_id FROM public.memberships
            WHERE user_id = auth.uid()
        )
    );

-- Policy 2: INSERT - Authenticated users can only record reactions for themselves in their workspaces
DROP POLICY IF EXISTS "post_reactions_insert_self" ON public.post_reactions;
CREATE POLICY "post_reactions_insert_self" ON public.post_reactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND tenant_id IN (
            SELECT community_id FROM public.memberships
            WHERE user_id = auth.uid()
        )
    );

-- Policy 3: DELETE - Authenticated users can only delete their own reactions
DROP POLICY IF EXISTS "post_reactions_delete_self" ON public.post_reactions;
CREATE POLICY "post_reactions_delete_self" ON public.post_reactions
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        AND tenant_id IN (
            SELECT community_id FROM public.memberships
            WHERE user_id = auth.uid()
        )
    );

-- Policy 4: SERVICE ROLE - Unrestricted administrative maintenance
DROP POLICY IF EXISTS "post_reactions_service_role_all" ON public.post_reactions;
CREATE POLICY "post_reactions_service_role_all" ON public.post_reactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Atomic PostgreSQL RPC: public.toggle_post_reaction()
CREATE OR REPLACE FUNCTION public.toggle_post_reaction(
    p_post_id UUID,
    p_action TEXT DEFAULT 'toggle'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_status TEXT;
    v_post_tenant_id UUID;
    v_is_member BOOLEAN;
    v_already_liked BOOLEAN;
    v_has_liked BOOLEAN;
    v_new_count INTEGER;
BEGIN
    -- 1. Cryptographically verify caller identity
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 401,
            'error', 'Unauthorized. Cryptographically verified Supabase authentication required.'
        );
    END IF;

    -- 2. Verify caller profile existence and active status
    SELECT status INTO v_caller_status
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_status IS NULL OR v_caller_status <> 'active' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 403,
            'error', 'Forbidden. Only active user profiles can react to posts.'
        );
    END IF;

    -- 3. Verify post existence and lock post row to guarantee serialized count updates
    SELECT tenant_id INTO v_post_tenant_id
    FROM public.posts
    WHERE id = p_post_id
    FOR UPDATE;

    IF v_post_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 404,
            'error', 'Post not found or access denied.'
        );
    END IF;

    -- 4. Verify caller active membership in the post's tenant (Cross-Tenant Boundary)
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE community_id = v_post_tenant_id
          AND user_id = v_caller_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 403,
            'error', 'Forbidden. Caller is not an active member of the workspace hosting this post.'
        );
    END IF;

    -- 5. Check existing reaction in durable post_reactions table
    SELECT EXISTS (
        SELECT 1 FROM public.post_reactions
        WHERE post_id = p_post_id
          AND user_id = v_caller_id
    ) INTO v_already_liked;

    -- 6. Execute desired state transition
    IF p_action = 'like' THEN
        IF NOT v_already_liked THEN
            INSERT INTO public.post_reactions (post_id, user_id, tenant_id)
            VALUES (p_post_id, v_caller_id, v_post_tenant_id)
            ON CONFLICT (post_id, user_id) DO NOTHING;
        END IF;
        v_has_liked := true;
    ELSIF p_action = 'unlike' THEN
        IF v_already_liked THEN
            DELETE FROM public.post_reactions
            WHERE post_id = p_post_id
              AND user_id = v_caller_id;
        END IF;
        v_has_liked := false;
    ELSE -- 'toggle'
        IF v_already_liked THEN
            DELETE FROM public.post_reactions
            WHERE post_id = p_post_id
              AND user_id = v_caller_id;
            v_has_liked := false;
        ELSE
            INSERT INTO public.post_reactions (post_id, user_id, tenant_id)
            VALUES (p_post_id, v_caller_id, v_post_tenant_id)
            ON CONFLICT (post_id, user_id) DO NOTHING;
            v_has_liked := true;
        END IF;
    END IF;

    -- 7. Calculate exact count from durable records
    SELECT count(*)::INTEGER INTO v_new_count
    FROM public.post_reactions
    WHERE post_id = p_post_id;

    -- 8. Synchronize posts.likes_count atomically
    UPDATE public.posts
    SET likes_count = v_new_count
    WHERE id = p_post_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 200,
        'likesCount', v_new_count,
        'hasLiked', v_has_liked,
        'postId', p_post_id
    );
END;
$$;

-- 6. Least-Privilege Function Permissions
REVOKE ALL ON FUNCTION public.toggle_post_reaction(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_post_reaction(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_post_reaction(UUID, TEXT) TO authenticated, service_role;
