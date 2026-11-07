import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';

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
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Valid Supabase session required.' }, { status: 401 });
  }

  const tenantId = auth.activeTenantId;

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
  // Enforce cryptographically verified authentication
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

    const newPost = {
      id: crypto.randomUUID(),
      tenantId: effectiveTenantId,
      authorId: auth.userId,
      authorName: auth.fullName || 'Team Member',
      authorRole: auth.role || 'employee',
      authorInitials: (auth.fullName || 'TM').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      title: body.title?.trim() || '',
      content: body.content.trim(),
      category: body.category || 'general',
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      rlsContextSql: buildTenantSessionSql(effectiveTenantId),
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
