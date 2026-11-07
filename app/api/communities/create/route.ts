import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required to create workspaces.' },
      { status: 401 }
    );
  }

  // Rate limit community creation
  const rl = await checkRateLimit('community_create', auth.userId);
  if (!rl.isAllowed) {
    if (rl.isServiceUnavailable) {
      return NextResponse.json(
        { error: 'Rate limiting service temporarily unavailable. Please retry shortly.' },
        { status: 503, headers: { 'Retry-After': '60' } }
      );
    }
    return NextResponse.json(
      { error: 'Too many communities created. Please wait before creating another.' },
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
    const body = await request.json();
    const { name, slug, tagline, description, logoUrl, allowedDomains, requiresApproval, isDiscoverable, industry } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Community name is required.' }, { status: 400 });
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newCommunityId = crypto.randomUUID();
    const parsedDomains = Array.isArray(allowedDomains)
      ? allowedDomains.map((d: string) => d.trim().replace(/^@/, '').toLowerCase()).filter(Boolean)
      : [];

    const newCommunity = {
      id: newCommunityId,
      name: name.trim(),
      slug: cleanSlug,
      tagline: (tagline || description || 'Enterprise Corporate Community').trim(),
      memberCount: 1,
      createdAt: new Date().toISOString(),
      logoUrl: logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanSlug}`,
      allowedDomains: parsedDomains.length > 0 ? parsedDomains : [],
      isDiscoverable: isDiscoverable !== false,
      requiresApproval: requiresApproval === true,
      industry: industry || 'Technology',
    };

    const supabase = await createClient(request);

    // Insert new tenant record
    await supabase.from('tenants').insert({
      id: newCommunityId,
      name: newCommunity.name,
      slug: newCommunity.slug,
    } as any);

    // Enforce database membership: Creator is designated as 'owner' in public.memberships
    await supabase.from('memberships').insert({
      user_id: auth.userId,
      community_id: newCommunityId,
      role: 'owner',
    } as any);

    const response = NextResponse.json({
      success: true,
      data: newCommunity,
      message: `Community created successfully. Creator assigned role = 'owner'.`,
      rlsContextSql: buildTenantSessionSql(newCommunityId),
    }, { status: 201 });

    response.cookies.set('active_tenant_id', newCommunityId, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }
}
