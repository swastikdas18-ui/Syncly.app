import { Channel } from '@/src/types.ts';
import { DEFAULT_TENANT_ID } from '@/src/lib/tenantContext.ts';

export const DEFAULT_PUBLIC_CHANNELS: Channel[] = [
  {
    id: 'general',
    tenantId: DEFAULT_TENANT_ID,
    name: 'general',
    description: 'Company-wide updates & general watercooler',
    isPrivate: false,
    createdAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'announcements',
    tenantId: DEFAULT_TENANT_ID,
    name: 'announcements',
    description: 'Executive broadcasts and corporate notices',
    isPrivate: false,
    createdAt: '2026-01-15T00:00:00.000Z',
  },
];

/**
 * Resilient channels fetcher with non-throwing safe fallbacks.
 * Returns default public channels [{ id: 'general' }, { id: 'announcements' }] if endpoint fails or is empty.
 */
export async function getChannels(tenantId?: string): Promise<Channel[]> {
  const safeTenantId = tenantId || DEFAULT_TENANT_ID;

  try {
    const res = await fetch(`/api/channels?tenantId=${encodeURIComponent(safeTenantId)}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': safeTenantId,
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('API getChannels network fallback:', err);
  }

  return DEFAULT_PUBLIC_CHANNELS.map((chan) => ({
    ...chan,
    tenantId: safeTenantId,
  }));
}

