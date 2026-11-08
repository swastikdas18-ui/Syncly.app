import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request);
    const { data: dbTenants, error } = await (supabase.from('tenants') as any)
      .select('id, name, slug, tagline, description, logo_url, industry, requires_approval, allowed_domains, is_discoverable, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedTenants = (dbTenants || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      tagline: t.tagline || '',
      description: t.description || '',
      logoUrl: t.logo_url || undefined,
      industry: t.industry || 'Technology',
      requiresApproval: Boolean(t.requires_approval),
      allowedDomains: t.allowed_domains || [],
      isDiscoverable: Boolean(t.is_discoverable),
      createdAt: t.created_at,
      memberCount: 1,
    }));

    return NextResponse.json({
      success: true,
      count: formattedTenants.length,
      data: formattedTenants,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
