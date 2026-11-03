export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const SECONDARY_TENANT_ID = '00000000-0000-0000-0000-000000000002';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether an incoming string matches RFC 4122 UUID format.
 * Prevents Postgres 22P02 syntax crashes when cast to ::uuid.
 */
export function isValidUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Extracts and sanitizes tenant ID from request headers, params, or state.
 * Fallbacks strictly to default UUID instead of string literals like 'tenant-default'.
 */
export function resolveTenantId(rawTenantId?: string | null): string {
  if (rawTenantId && isValidUUID(rawTenantId)) {
    return rawTenantId.trim().toLowerCase();
  }
  return DEFAULT_TENANT_ID;
}

export const INITIAL_TENANTS = [
  {
    id: DEFAULT_TENANT_ID,
    name: 'Acme Corporation',
    slug: 'acme-corp',
    tagline: 'Enterprise Cloud Infrastructure & Logistics',
    createdAt: '2026-01-15T09:00:00Z',
    memberCount: 248
  },
  {
    id: SECONDARY_TENANT_ID,
    name: 'Globex Technologies',
    slug: 'globex-tech',
    tagline: 'Next-Gen Robotics & Autonomous Systems',
    createdAt: '2026-02-01T10:30:00Z',
    memberCount: 165
  }
];

export const INITIAL_PROFILES = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Elena Rostova',
    role: 'admin' as const,
    status: 'active' as const,
    initials: 'ER'
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Marcus Vance',
    role: 'manager' as const,
    status: 'active' as const,
    initials: 'MV'
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Devon Thorne',
    role: 'admin' as const,
    status: 'active' as const,
    initials: 'DT'
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Maya Lin',
    role: 'employee' as const,
    status: 'active' as const,
    initials: 'ML'
  }
];
