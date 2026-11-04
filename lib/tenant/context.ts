import { headers } from 'next/headers';

/**
 * Syncly / Work-Connect Multi-Tenant System Context
 * 
 * Safe Fallback Constants:
 * NEVER use string literals like 'tenant-default' or 'default' because Postgres will
 * fail with a 22P02 "invalid input syntax for type uuid" error when casting to UUID.
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const SECONDARY_TENANT_ID = '00000000-0000-0000-0000-000000000002';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a given string is a syntactically valid RFC 4122 UUID.
 */
export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  return UUID_REGEX.test(uuid.trim());
}

/**
 * Safely resolves a tenant ID with strict UUID validation.
 * Falls back to DEFAULT_TENANT_ID ('00000000-0000-0000-0000-000000000001')
 * if the candidate is missing, invalid, or malformed.
 */
export function resolveTenantId(candidate: string | null | undefined): string {
  if (!candidate) {
    return DEFAULT_TENANT_ID;
  }
  const trimmed = candidate.trim();
  if (isValidUUID(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Defensive fallback against 22P02 Postgres errors
  return DEFAULT_TENANT_ID;
}

export interface TenantContext {
  tenantId: string;
  source: 'header' | 'cookie' | 'fallback';
  isValid: boolean;
}

/**
 * Server-side helper for Next.js App Router (Server Components & Route Handlers).
 * Reads the 'x-tenant-id' injected by Next.js middleware into request headers.
 */
export async function getTenantContext(): Promise<TenantContext> {
  try {
    const headersList = await headers();
    const rawHeader = headersList.get('x-tenant-id');
    
    if (rawHeader && isValidUUID(rawHeader)) {
      return {
        tenantId: rawHeader.trim().toLowerCase(),
        source: 'header',
        isValid: true,
      };
    }
  } catch {
    // Graceful handling outside request context
  }

  return {
    tenantId: DEFAULT_TENANT_ID,
    source: 'fallback',
    isValid: true,
  };
}

/**
 * Helper to build SQL session commands for Supabase RLS.
 * Sets the session variable used by RLS policies:
 * SET LOCAL app.current_tenant_id = '...'
 */
export function buildTenantSessionSql(tenantId: string): string {
  const safeId = resolveTenantId(tenantId);
  return `SET LOCAL app.current_tenant_id = '${safeId}';`;
}
