import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';

interface RouteContext {
  params: Promise<{ postId: string }>;
}

/**
 * PATCH /api/posts/[postId]
 * Edits an authorized post's title or content.
 * SECURITY: Only the original author can edit their own post.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Valid Supabase session required.' }, { status: 401 });
  }

  const { postId } = await context.params;
  const tenantId = auth.activeTenantId;
  const userId = auth.userId;

  const supabase = await createClient(request);

  // Fetch post to check ownership
  const { data: post, error: fetchErr } = await (supabase.from('posts') as any)
    .select('id, tenant_id, author_id')
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !post) {
    return NextResponse.json({ error: 'Post not found or access denied.' }, { status: 404 });
  }

  // Authorization check: only author can edit
  if (post.author_id !== userId) {
    return NextResponse.json({ error: 'Forbidden. You cannot edit another user\'s post.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, content, category } = body;

    const updates: { title?: string; content?: string; category?: string } = {};
    if (typeof title === 'string') updates.title = title.trim();
    if (typeof content === 'string') updates.content = content.trim();
    if (typeof category === 'string') updates.category = category.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No update fields provided.' }, { status: 400 });
    }

    const { data: updatedPost, error: updateErr } = await (supabase.from('posts') as any)
      .update(updates)
      .eq('id', postId)
      .select('*, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, post: updatedPost }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Malformed request payload.' }, { status: 400 });
  }
}

/**
 * DELETE /api/posts/[postId]
 * Deletes an authorized post.
 * SECURITY: Only the author, or an admin/owner can delete the post.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Valid Supabase session required.' }, { status: 401 });
  }

  const { postId } = await context.params;
  const tenantId = auth.activeTenantId;
  const userId = auth.userId;
  const userRole = auth.role;

  const supabase = await createClient(request);

  // Fetch post
  const { data: post, error: fetchErr } = await (supabase.from('posts') as any)
    .select('id, tenant_id, author_id')
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !post) {
    return NextResponse.json({ error: 'Post not found or access denied.' }, { status: 404 });
  }

  // Authorization check: author OR admin/owner
  const isAuthor = post.author_id === userId;
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';

  if (!isAuthor && !isAdminOrOwner) {
    return NextResponse.json({ error: 'Forbidden. You do not have permission to delete this post.' }, { status: 403 });
  }

  // Delete comments first if any
  await (supabase.from('post_comments') as any).delete().eq('post_id', postId);

  // Delete the post
  const { error: delErr } = await (supabase.from('posts') as any)
    .delete()
    .eq('id', postId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Post successfully deleted.' }, { status: 200 });
}
