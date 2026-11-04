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
    memberCount: 248,
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
    allowedDomains: ['acme.com', 'acmecorp.internal', 'acme.org'],
    isDiscoverable: true,
    requiresApproval: false,
    industry: 'Cloud Infrastructure'
  },
  {
    id: SECONDARY_TENANT_ID,
    name: 'Globex Technologies',
    slug: 'globex-tech',
    tagline: 'Next-Gen Robotics & Autonomous Systems',
    createdAt: '2026-02-01T10:30:00Z',
    memberCount: 165,
    logoUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=120&auto=format&fit=crop&q=80',
    allowedDomains: ['globex.tech', 'globex.com'],
    isDiscoverable: true,
    requiresApproval: false,
    industry: 'Robotics & AI'
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Stripe Engineering',
    slug: 'stripe-eng',
    tagline: 'Financial Infrastructure & Developer Platforms',
    createdAt: '2026-02-15T14:00:00Z',
    memberCount: 420,
    logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=120&auto=format&fit=crop&q=80',
    allowedDomains: ['stripe.com'],
    isDiscoverable: true,
    requiresApproval: true,
    industry: 'Fintech & Developer Tools'
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Starlight Labs',
    slug: 'starlight-labs',
    tagline: 'Deep Tech & Computational Genomics Research',
    createdAt: '2026-03-01T11:20:00Z',
    memberCount: 88,
    logoUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=80',
    allowedDomains: ['starlight.ai', 'starlightlabs.co'],
    isDiscoverable: true,
    requiresApproval: false,
    industry: 'Biotech & Health'
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    name: 'Apex Strategic Advisory',
    slug: 'apex-advisory',
    tagline: 'Enterprise Management Consulting & Digital Transformation',
    createdAt: '2026-02-20T11:00:00Z',
    memberCount: 310,
    logoUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=120&auto=format&fit=crop&q=80',
    allowedDomains: ['apexadvisory.com', 'consulting.internal'],
    isDiscoverable: true,
    requiresApproval: false,
    industry: 'Consulting'
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
