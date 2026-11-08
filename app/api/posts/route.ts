import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { Post, PostComment } from '@/src/types.ts';

interface CreatePostPayload {
  title?: string;
  content: string;
  category?: 'announcement' | 'general' | 'spotlight' | 'qna' | 'event';
  mediaUrls?: string[];
}

/**
 * GET /api/posts
 * Returns paginated, tenant-scoped posts with author profile and comments from PostgreSQL.
 */
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Valid Supabase session required.' }, { status: 401 });
  }

  const tenantId = auth.activeTenantId;
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'all';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = await createClient(request);

  let query = (supabase.from('posts') as any)
    .select(`
      id,
      tenant_id,
      author_id,
      title,
      content,
      category,
      media_urls,
      likes_count,
      comments_count,
      created_at,
      profiles:author_id (
        id,
        full_name,
        avatar_url,
        role
      ),
      post_comments (
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
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category && category !== 'all') {
    query = query.eq('category', category.toLowerCase());
  }

  const { data: dbPosts, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch posts: ' + error.message }, { status: 500 });
  }

  // Format into Post frontend contract
  const formattedPosts: Post[] = (dbPosts || []).map((p: any) => {
    const author = p.profiles || {};
    const authorName = author.full_name || 'Team Member';
    const authorInitials = authorName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'TM';

    const comments: PostComment[] = (p.post_comments || []).map((c: any) => {
      const cAuthor = c.profiles || {};
      const cName = cAuthor.full_name || 'Team Member';
      const cInitials = cName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'TM';

      return {
        id: c.id,
        tenantId: c.tenant_id,
        postId: c.post_id,
        authorId: c.author_id,
        authorName: cName,
        authorAvatar: cAuthor.avatar_url || undefined,
        authorRole: cAuthor.role || 'employee',
        authorInitials: cInitials,
        content: c.content,
        createdAt: c.created_at,
      };
    });

    return {
      id: p.id,
      tenantId: p.tenant_id,
      authorId: p.author_id,
      authorName,
      authorAvatar: author.avatar_url || undefined,
      authorRole: author.role || 'employee',
      authorInitials,
      title: p.title || '',
      content: p.content,
      category: p.category || 'general',
      mediaUrls: p.media_urls || [],
      likesCount: p.likes_count || 0,
      commentsCount: comments.length,
      hasLiked: ((globalThis as any).__post_reactions?.get(p.id) as Set<string> | undefined)?.has(auth.userId) ?? false,
      createdAt: p.created_at,
      comments,
    };
  });

  return NextResponse.json({
    success: true,
    tenantId,
    category,
    limit,
    offset,
    count: formattedPosts.length,
    data: formattedPosts,
  });
}

/**
 * POST /api/posts
 * Creates a new company update post in PostgreSQL tagged with authenticated author and isolated tenant_id.
 */
export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Cryptographically verified authentication required.' },
      { status: 401 }
    );
  }

  const effectiveTenantId = auth.activeTenantId;

  // Strict cross-tenant check against verified identity
  const rawHeaderTenant = request.headers.get('x-tenant-id');
  if (rawHeaderTenant && rawHeaderTenant.toLowerCase() !== effectiveTenantId.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden. Cross-tenant post creation denied.' }, { status: 403 });
  }

  // Enforce server-derived RBAC: Interns are prohibited from publishing posts
  if (auth.role === 'intern') {
    return NextResponse.json({ error: 'Forbidden. Interns are not permitted to publish posts.' }, { status: 403 });
  }

  // Rate limiting check
  const rl = await checkRateLimit('post_create', auth.userId);
  if (!rl.isAllowed) {
    if (rl.isServiceUnavailable) {
      return NextResponse.json(
        { error: 'Rate limiting service temporarily unavailable. Please retry shortly.' },
        { status: 503, headers: { 'Retry-After': '30' } }
      );
    }
    return NextResponse.json(
      { error: 'Too many posts created. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  }

  try {
    const body = (await request.json()) as CreatePostPayload;

    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return NextResponse.json(
        { error: 'Field "content" is required and cannot be empty.' },
        { status: 400 }
      );
    }

    const supabase = await createClient(request);

    const { data: newPostRow, error: insertError } = await (supabase.from('posts') as any)
      .insert({
        tenant_id: effectiveTenantId,
        author_id: auth.userId,
        title: body.title?.trim() || '',
        content: body.content.trim(),
        category: body.category || 'general',
        media_urls: Array.isArray(body.mediaUrls) ? body.mediaUrls : [],
        likes_count: 0,
        comments_count: 0,
      })
      .select(`
        id,
        tenant_id,
        author_id,
        title,
        content,
        category,
        media_urls,
        likes_count,
        comments_count,
        created_at,
        profiles:author_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create post: ' + insertError.message },
        { status: 500 }
      );
    }

    const author = newPostRow.profiles || {};
    const authorName = author.full_name || auth.fullName || 'Team Member';
    const authorInitials = authorName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'TM';

    const formattedPost: Post = {
      id: newPostRow.id,
      tenantId: newPostRow.tenant_id,
      authorId: newPostRow.author_id,
      authorName,
      authorAvatar: author.avatar_url || undefined,
      authorRole: author.role || auth.role || 'employee',
      authorInitials,
      title: newPostRow.title || '',
      content: newPostRow.content,
      category: newPostRow.category || 'general',
      mediaUrls: newPostRow.media_urls || [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: newPostRow.created_at,
      comments: [],
    };

    return NextResponse.json({ success: true, data: formattedPost }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }
}
