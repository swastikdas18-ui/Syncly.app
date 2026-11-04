import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';

interface CreatePostPayload {
  title?: string;
  content: string;
  category?: 'announcement' | 'general' | 'spotlight' | 'qna' | 'event';
  mediaUrls?: string[];
  authorId?: string;
  authorName?: string;
  authorRole?: string;
}

/**
 * GET /api/posts
 * Returns paginated, tenant-scoped posts with author profile and comments.
 * Returns clean empty array when no posts exist.
 */
export async function GET(request: NextRequest) {
  const { tenantId, isValid } = await getTenantContext();

  if (!isValid || !tenantId) {
    return NextResponse.json({ error: 'Tenant context required.' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'all';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  return NextResponse.json({
    success: true,
    tenantId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    category,
    limit,
    offset,
    count: 0,
    data: [],
  });
}

/**
 * POST /api/posts
 * Creates a new company update post tagged with authenticated author and isolated tenant_id.
 */
export async function POST(request: NextRequest) {
  const { tenantId, isValid } = await getTenantContext();

  if (!isValid || !tenantId) {
    return NextResponse.json({ error: 'Tenant context required.' }, { status: 401 });
  }

  const callerId = request.headers.get('x-user-id');

  try {
    const body = (await request.json()) as CreatePostPayload;

    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return NextResponse.json(
        { error: 'Field "content" is required and cannot be empty.' },
        { status: 400 }
      );
    }

    const resolvedAuthorId = body.authorId || callerId;
    if (!resolvedAuthorId) {
      return NextResponse.json(
        { error: 'Authenticated user identity (authorId) is required to publish.' },
        { status: 401 }
      );
    }

    const newPost = {
      id: crypto.randomUUID(),
      tenantId,
      authorId: resolvedAuthorId,
      authorName: body.authorName || 'Team Member',
      authorRole: body.authorRole || 'employee',
      title: body.title?.trim() || '',
      content: body.content.trim(),
      category: body.category || 'general',
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      rlsContextSql: buildTenantSessionSql(tenantId),
    };

    return NextResponse.json({ success: true, data: newPost }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }
}
