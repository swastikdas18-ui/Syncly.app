import { Tenant } from '@/src/types.ts';
import { resolveTenantId } from '@/src/lib/tenantContext.ts';

/**
 * Resilient tenant fetcher with non-throwing safe handling.
 * Queries /api/communities/explore or /api/tenant/members.
 * Returns empty array if endpoints fail — NEVER fabricates Acme Corporation as a fallback.
 */
export async function getTenants(tenantId?: string | null): Promise<Tenant[]> {
  const safeTenantId = resolveTenantId(tenantId);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (safeTenantId) {
    headers['x-tenant-id'] = safeTenantId;
  }

  try {
    const res = await fetch('/api/communities/explore', {
      headers,
      cache: 'no-store',
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('API getTenants explore endpoint fallback:', err);
  }

  try {
    const res = await fetch('/api/tenant/members', {
      headers,
      cache: 'no-store',
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('API getTenants members endpoint fallback:', err);
  }

  return [];
}
