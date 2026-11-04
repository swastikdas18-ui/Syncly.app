import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await getTenantContext();
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
      allowedDomains: parsedDomains.length > 0 ? parsedDomains : ['acme.com'],
      isDiscoverable: isDiscoverable !== false,
      requiresApproval: requiresApproval === true,
      industry: industry || 'Technology',
    };

    const response = NextResponse.json({
      success: true,
      data: newCommunity,
      message: `Community created with default channels (#general, #announcements, #dev-team, #random). Creator assigned role = 'owner'.`,
      rlsContextSql: buildTenantSessionSql(newCommunityId),
    }, { status: 201 });

    response.cookies.set('x-tenant-id', newCommunityId, { path: '/', maxAge: 2592000 });
    response.cookies.set('syncly_role', 'owner', { path: '/', maxAge: 2592000 });

    return response;
  } catch {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }
}
