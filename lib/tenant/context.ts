import { headers } from 'next/headers';

/**
 * Syncly / Work-Connect Multi-Tenant System Context
 * 
 * FAIL-CLOSED SECURITY RULES:
 * 1. Missing or invalid tenant context must fail closed (isValid: false, tenantId: null).
 * 2. Never silently authorizes Acme Corporation as the default tenant.
 * 3. Active tenant selection is merely a preference; actual authorization is enforced
 *    by verifying database memberships against the authenticated user.
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
 * Fails closed by returning null if missing, invalid, or malformed.
 */
export function resolveTenantId(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }
  const trimmed = candidate.trim();
  if (isValidUUID(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

export interface TenantContext {
  tenantId: string | null;
  source: 'header' | 'none';
  isValid: boolean;
}

/**
 * Server-side helper for Next.js App Router (Server Components & Route Handlers).
 * Reads the 'x-tenant-id' injected by Next.js middleware into request headers.
 * Fails closed if missing or invalid.
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
    // Handling outside request context
  }

  return {
    tenantId: null,
    source: 'none',
    isValid: false,
  };
}

/**
 * Helper to build SQL session commands for Supabase RLS.
 * Sets the session variable used by RLS policies:
 * SET LOCAL app.current_tenant_id = '...'
 */
export function buildTenantSessionSql(tenantId: string | null | undefined): string {
  const safeId = resolveTenantId(tenantId);
  if (!safeId) {
    return "SET LOCAL app.current_tenant_id = '';";
  }
  return `SET LOCAL app.current_tenant_id = '${safeId}';`;
}

/**
 * Validates whether a user identity has authorization to perform actions in target tenant.
 * Protects mutation endpoints from cross-tenant spoofing.
 */
export function verifyTenantAuthorization(userTenantId: string | null | undefined, targetTenantId: string | null | undefined): boolean {
  if (!userTenantId || !targetTenantId) return false;
  const safeUserTenant = resolveTenantId(userTenantId);
  const safeTargetTenant = resolveTenantId(targetTenantId);
  if (!safeUserTenant || !safeTargetTenant) return false;
  return safeUserTenant === safeTargetTenant;
}
