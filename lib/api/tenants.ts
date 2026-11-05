import { DEFAULT_TENANT_ID, INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
import { Tenant } from '@/src/types.ts';

export const DEFAULT_FALLBACK_TENANT: Tenant = {
  id: DEFAULT_TENANT_ID,
  name: 'Acme Corporation',
  slug: 'acme-corp',
  tagline: 'Global Enterprise Systems & Operations',
  memberCount: 142,
  createdAt: '2026-01-15T00:00:00.000Z',
  logoUrl: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=128&h=128&fit=crop&crop=faces',
  allowedDomains: ['acme.com', 'acmecorp.internal'],
  isDiscoverable: true,
  requiresApproval: false,
  industry: 'Enterprise Software & Cloud Infrastructure',
  ownerId: DEFAULT_TENANT_ID,
};

/**
 * Resilient tenant fetcher with non-throwing graceful fallbacks.
 * Queries /api/communities/explore or /api/tenant/members and defaults to UUID '00000000-0000-0000-0000-000000000001'.
 */
export async function getTenants(tenantId?: string): Promise<Tenant[]> {
  try {
    const res = await fetch('/api/communities/explore', {
      headers: {
        'Content-Type': 'application/json',
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
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
    console.warn('API getTenants explore endpoint fallback:', err);
  }

  try {
    const res = await fetch('/api/tenant/members', {
      headers: {
        'Content-Type': 'application/json',
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
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
    console.warn('API getTenants members endpoint fallback:', err);
  }

  return INITIAL_TENANTS && INITIAL_TENANTS.length > 0 ? INITIAL_TENANTS : [DEFAULT_FALLBACK_TENANT];
}

