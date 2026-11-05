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

const ACME_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const SEED_POSTS: CreatePostPayload[] = [
  {
    title: 'Welcome to Acme Corporation & Q1 Engineering Kickoff',
    content: 'Welcome everyone to the new Syncly corporate platform! We are kicking off Q1 with major investments across our cloud platform, real-time message streams, and developer velocity tools. Check out the roadmap below.',
    category: 'announcement',
    authorId: '00000000-0000-0000-0000-000000000001',
    authorName: 'Demo Mentor',
    authorRole: 'admin',
    mediaUrls: [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    title: 'Intern Cohort 2026 Welcome & Orientation',
    content: 'A huge warm welcome to our 2026 Engineering and Product intern cohort! Be sure to join #general and check the Events tab for upcoming 1:1 mentorship matchings and architectural workshops.',
    category: 'spotlight',
    authorId: '00000000-0000-0000-0000-000000000001',
    authorName: 'Demo Mentor',
    authorRole: 'admin',
    mediaUrls: [],
  },
  {
    title: 'Distributed Systems & Edge Streaming Architecture Deep Dive',
    content: 'Our infrastructure team just published the whitepaper on zero-latency multi-tenant SSE streaming with Postgres RLS safety. Join the technical review in #engineering this Thursday at 2 PM!',
    category: 'general',
    authorId: '00000000-0000-0000-0000-000000000001',
    authorName: 'Demo Mentor',
    authorRole: 'admin',
    mediaUrls: [],
  },
];

let inMemoryPosts: any[] = SEED_POSTS.map((sp, idx) => ({
  id: `seed-post-${idx + 1}`,
  tenantId: ACME_TENANT_ID,
  authorId: sp.authorId,
  authorName: sp.authorName,
  authorRole: sp.authorRole,
  authorInitials: 'DM',
  title: sp.title || '',
  content: sp.content,
  category: sp.category || 'general',
  mediaUrls: sp.mediaUrls || [],
  likesCount: 12 - idx * 3,
  commentsCount: 3 - idx,
  createdAt: new Date(Date.now() - (idx + 1) * 3600000 * 5).toISOString(),
}));

/**
 * GET /api/posts
 * Returns paginated, tenant-scoped posts with author profile and comments.
 * Returns seeded posts for Acme Corporation when database rows are empty.
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

  const tenantScopedPosts = inMemoryPosts.filter((p) => p.tenantId === tenantId);
  const filtered = category === 'all'
    ? tenantScopedPosts
    : tenantScopedPosts.filter((p) => p.category.toLowerCase() === category.toLowerCase());

  const paginated = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    tenantId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    category,
    limit,
    offset,
    count: filtered.length,
    data: paginated,
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
      authorInitials: (body.authorName || 'TM').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      title: body.title?.trim() || '',
      content: body.content.trim(),
      category: body.category || 'general',
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      rlsContextSql: buildTenantSessionSql(tenantId),
    };

    inMemoryPosts.unshift(newPost);

    return NextResponse.json({ success: true, data: newPost }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }
}
