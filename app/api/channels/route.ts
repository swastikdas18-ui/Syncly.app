import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant/context.ts';
import { DEFAULT_TENANT_ID } from '@/src/lib/tenantContext.ts';
import { Channel } from '@/src/types.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { tenantId } = await getTenantContext();
  const safeTenantId = tenantId || DEFAULT_TENANT_ID;

  const defaultChannels: Channel[] = [
    {
      id: 'general',
      tenantId: safeTenantId,
      name: 'general',
      description: 'Company-wide updates & general watercooler',
      isPrivate: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'announcements',
      tenantId: safeTenantId,
      name: 'announcements',
      description: 'Executive broadcasts and corporate notices',
      isPrivate: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'engineering',
      tenantId: safeTenantId,
      name: 'engineering',
      description: 'Sprint planning and technical RFCs',
      isPrivate: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
  ];

  return NextResponse.json({
    success: true,
    count: defaultChannels.length,
    data: defaultChannels,
  });
}

