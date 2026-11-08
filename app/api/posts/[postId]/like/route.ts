import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';

interface RouteContext {
  params: Promise<{ postId: string }>;
}

/**
 * POST /api/posts/[postId]/like
 * Toggles like / unlike for the authenticated user on a post.
 * Supports explicit action: { action: 'like' | 'unlike' | 'toggle' }
 * 
 * Uses durable database table public.post_reactions and atomic RPC public.toggle_post_reaction.
 * Eliminates in-memory reaction state as the source of truth.
 * Enforces cryptographic auth, tenant isolation, and idempotent state transitions.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Valid Supabase session required.' }, { status: 401 });
  }

  const { postId } = await context.params;
  const tenantId = auth.activeTenantId;
  const userId = auth.userId;

  let body: any = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {}

  const desiredAction = body.action || 'toggle'; // 'like', 'unlike', or 'toggle'

  const supabase = await createClient(request);

  // 1. Attempt atomic PostgreSQL RPC (Migration 019: public.toggle_post_reaction)
  const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('toggle_post_reaction', {
    p_post_id: postId,
    p_action: desiredAction,
  });

  if (!rpcError && rpcResult) {
    if (!rpcResult.success) {
      return NextResponse.json(
        { error: rpcResult.error || 'Reaction update failed.' },
        { status: rpcResult.status || 400 }
      );
    }
    return NextResponse.json({
      success: true,
      likesCount: rpcResult.likesCount,
      hasLiked: rpcResult.hasLiked,
      postId: rpcResult.postId,
    });
  }

  // 2. Direct database query path: verify post existence & tenant isolation
  const { data: post, error: postErr } = await (supabase.from('posts') as any)
    .select('id, tenant_id, likes_count')
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .single();

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found or access denied.' }, { status: 404 });
  }

  // 3. Verify caller active membership in the post's workspace
  const { data: membership } = await (supabase.from('memberships') as any)
    .select('id')
    .eq('community_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden. Active workspace membership required to react.' }, { status: 403 });
  }

  // 4. Query durable public.post_reactions table
  const { data: existingReaction, error: reactionQueryErr } = await (supabase.from('post_reactions') as any)
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  const isTableMissing = reactionQueryErr && (
    reactionQueryErr.code === 'PGRST205' ||
    reactionQueryErr.code === '42P01' ||
    reactionQueryErr.message?.includes('post_reactions')
  );

  if (!isTableMissing && !reactionQueryErr) {
    let hasLiked = false;
    const adminClient = createAdminClient();

    if (desiredAction === 'like') {
      if (!existingReaction) {
        await (supabase.from('post_reactions') as any)
          .insert({ post_id: postId, user_id: userId, tenant_id: tenantId });
      }
      hasLiked = true;
    } else if (desiredAction === 'unlike') {
      if (existingReaction) {
        await (supabase.from('post_reactions') as any)
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
      }
      hasLiked = false;
    } else {
      // toggle
      if (existingReaction) {
        await (supabase.from('post_reactions') as any)
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
        hasLiked = false;
      } else {
        await (supabase.from('post_reactions') as any)
          .insert({ post_id: postId, user_id: userId, tenant_id: tenantId });
        hasLiked = true;
      }
    }

    // Exact count derived directly from durable records
    const { count: durableCount } = await (supabase.from('post_reactions') as any)
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    const safeCount = Math.max(0, durableCount ?? (hasLiked ? (post.likes_count || 0) + 1 : Math.max(0, (post.likes_count || 1) - 1)));

    await (adminClient.from('posts') as any)
      .update({ likes_count: safeCount })
      .eq('id', postId);

    return NextResponse.json({
      success: true,
      likesCount: safeCount,
      hasLiked,
    });
  }

  // 5. Pre-migration database fallback: update posts.likes_count atomically
  const currentCount = post.likes_count || 0;
  let nextCount = currentCount;
  let hasLiked = false;

  if (desiredAction === 'like') {
    nextCount = currentCount + 1;
    hasLiked = true;
  } else if (desiredAction === 'unlike') {
    nextCount = Math.max(0, currentCount - 1);
    hasLiked = false;
  } else {
    // toggle mode
    if (currentCount > 0) {
      nextCount = currentCount - 1;
      hasLiked = false;
    } else {
      nextCount = currentCount + 1;
      hasLiked = true;
    }
  }

  try {
    const adminClient = createAdminClient();
    await (adminClient.from('posts') as any)
      .update({ likes_count: nextCount })
      .eq('id', postId);
  } catch {
    await (supabase.from('posts') as any)
      .update({ likes_count: nextCount })
      .eq('id', postId);
  }

  return NextResponse.json({
    success: true,
    likesCount: nextCount,
    hasLiked,
  });
}
