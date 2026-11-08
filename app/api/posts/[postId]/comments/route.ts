import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { PostComment } from '@/src/types.ts';

interface RouteContext {
  params: Promise<{ postId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Valid Supabase session required.' }, { status: 401 });
  }

  const { postId } = await context.params;
  const tenantId = auth.activeTenantId;

  try {
    const body = await request.json();
    const content = body?.content?.trim();

    if (!content) {
      return NextResponse.json({ error: 'Comment content cannot be blank.' }, { status: 400 });
    }

    const supabase = await createClient(request);

    // Verify post belongs to current tenant
    const { data: post, error: postErr } = await (supabase.from('posts') as any)
      .select('id, tenant_id, comments_count')
      .eq('id', postId)
      .eq('tenant_id', tenantId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found or access denied.' }, { status: 404 });
    }

    // Insert comment
    const { data: commentRow, error: commErr } = await (supabase.from('post_comments') as any)
      .insert({
        tenant_id: tenantId,
        post_id: postId,
        author_id: auth.userId,
        content,
      })
      .select(`
        id,
        tenant_id,
        post_id,
        author_id,
        content,
        created_at,
        profiles:author_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .single();

    if (commErr) {
      return NextResponse.json({ error: 'Failed to add comment: ' + commErr.message }, { status: 500 });
    }

    // Increment comments_count on post
    await (supabase.from('posts') as any)
      .update({ comments_count: (post.comments_count || 0) + 1 })
      .eq('id', postId);

    const cAuthor = commentRow.profiles || {};
    const cName = cAuthor.full_name || auth.fullName || 'Team Member';
    const cInitials = cName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'TM';

    const formattedComment: PostComment = {
      id: commentRow.id,
      tenantId: commentRow.tenant_id,
      postId: commentRow.post_id,
      authorId: commentRow.author_id,
      authorName: cName,
      authorAvatar: cAuthor.avatar_url || undefined,
      authorRole: cAuthor.role || auth.role || 'employee',
      authorInitials: cInitials,
      content: commentRow.content,
      createdAt: commentRow.created_at,
    };

    return NextResponse.json({ success: true, data: formattedComment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }
}

