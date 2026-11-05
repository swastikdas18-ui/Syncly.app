import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_TENANTS, DEFAULT_TENANT_ID } from '@/src/lib/tenantContext.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenants = INITIAL_TENANTS.length > 0 ? INITIAL_TENANTS : [
    {
      id: DEFAULT_TENANT_ID,
      name: 'Acme Corporation',
      slug: 'acme-corp',
      tagline: 'Global Enterprise Systems & Operations',
      memberCount: 142,
      createdAt: '2026-01-15T00:00:00.000Z',
      allowedDomains: ['acme.com', 'acmecorp.internal'],
      isDiscoverable: true,
      requiresApproval: false,
      industry: 'Enterprise Software & Cloud Infrastructure',
      ownerId: DEFAULT_TENANT_ID,
    }
  ];

  return NextResponse.json({
    success: true,
    count: tenants.length,
    data: tenants,
  });
}

