import { Channel } from '@/src/types.ts';
import { resolveTenantId } from '@/src/lib/tenantContext.ts';

/**
 * Real channels fetcher.
 * Queries /api/channels with the verified tenant context.
 * Returns empty array or throws if request fails — NEVER fabricates fake channels.
 */
export async function getChannels(tenantId?: string | null): Promise<Channel[]> {
  const safeTenantId = resolveTenantId(tenantId);
  if (!safeTenantId) {
    return [];
  }

  const res = await fetch(`/api/channels?tenantId=${encodeURIComponent(safeTenantId)}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': safeTenantId,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch channels (HTTP ${res.status})`);
  }

  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}
