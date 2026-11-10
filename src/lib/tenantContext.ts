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
 * Returns null when no valid UUID is provided.
 * FAIL-CLOSED: NEVER silently substitutes Acme Corporation as a fallback.
 */
export function resolveTenantId(rawTenantId?: string | null): string | null {
  if (rawTenantId && isValidUUID(rawTenantId)) {
    return rawTenantId.trim().toLowerCase();
  }
  return null;
}
