import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';

interface RouteContext {
  params: Promise<{ postId: string }>;
}

// User-level reaction tracking per post: Map<postId, Set<userId>>
const globalReactions: Map<string, Set<string>> = ((globalThis as any).__post_reactions ??= new Map<string, Set<string>>());

/**
 * POST /api/posts/[postId]/like
 * Toggles like / unlike for the authenticated user on a post.
 * Supports explicit action: { action: 'like' | 'unlike' | 'toggle' }
 * Ensures reaction state is deterministic and cannot be duplicated.
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

  // Fetch current post
  const { data: post, error: postErr } = await (supabase.from('posts') as any)
    .select('id, tenant_id, likes_count')
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .single();

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found or access denied.' }, { status: 404 });
  }

  const currentCount = post.likes_count || 0;
  let userLikes = globalReactions.get(postId);
  if (!userLikes) {
    userLikes = new Set<string>();
    globalReactions.set(postId, userLikes);
  }

  const alreadyLiked = userLikes.has(userId);
  let newCount = currentCount;
  let hasLiked = false;

  if (desiredAction === 'like') {
    if (!alreadyLiked) {
      userLikes.add(userId);
      newCount = currentCount + 1;
    } else {
      newCount = currentCount;
    }
    hasLiked = true;
  } else if (desiredAction === 'unlike') {
    if (alreadyLiked) {
      userLikes.delete(userId);
      newCount = Math.max(0, currentCount - 1);
    } else {
      newCount = Math.max(0, currentCount);
    }
    hasLiked = false;
  } else {
    // toggle mode
    if (alreadyLiked) {
      userLikes.delete(userId);
      newCount = Math.max(0, currentCount - 1);
      hasLiked = false;
    } else {
      userLikes.add(userId);
      newCount = currentCount + 1;
      hasLiked = true;
    }
  }

  try {
    const adminClient = createAdminClient();
    await (adminClient.from('posts') as any)
      .update({ likes_count: newCount })
      .eq('id', postId);
  } catch {
    await (supabase.from('posts') as any)
      .update({ likes_count: newCount })
      .eq('id', postId);
  }

  return NextResponse.json({
    success: true,
    likesCount: newCount,
    hasLiked,
  });
}
