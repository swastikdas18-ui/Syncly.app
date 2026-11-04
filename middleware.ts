import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_TENANT_ID, SECONDARY_TENANT_ID, isValidUUID, resolveTenantId } from './lib/tenant/context.ts';

// Known subdomain mappings for corporate domains
const SUBDOMAIN_TENANTS: Record<string, string> = {
  acme: DEFAULT_TENANT_ID,
  'acme-corp': DEFAULT_TENANT_ID,
  globex: SECONDARY_TENANT_ID,
  'globex-tech': SECONDARY_TENANT_ID,
};

/**
 * Next.js Edge Middleware for Multi-Tenant Isolation
 * 
 * Pipeline:
 * 1. Checks incoming request headers for 'x-tenant-id'.
 * 2. Checks cookies for 'workconnect_tenant_id'.
 * 3. Checks query parameter '?tenant=' or '?tenantId='.
 * 4. Checks hostname subdomain (e.g., 'acme.syncly.internal').
 * 5. Strict UUID validation: prevents PostgreSQL 22P02 syntax errors by safely
 *    falling back to DEFAULT_TENANT_ID ('00000000-0000-0000-0000-000000000001')
 *    rather than string literals like 'tenant-default'.
 * 6. Rewrites request headers with validated 'x-tenant-id'.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip static assets and internal Next.js requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') && !pathname.endsWith('.json')
  ) {
    return NextResponse.next();
  }

  // 1. Check header
  let candidateTenant: string | null | undefined = request.headers.get('x-tenant-id');

  // 2. Check query parameter
  if (!candidateTenant) {
    candidateTenant = searchParams.get('tenant') || searchParams.get('tenantId');
  }

  // 3. Check cookie
  if (!candidateTenant) {
    candidateTenant = request.cookies.get('workconnect_tenant_id')?.value;
  }

  // 4. Check subdomain
  if (!candidateTenant) {
    const host = request.headers.get('host') || '';
    const parts = host.split('.');
    if (parts.length > 2) {
      const subdomain = parts[0].toLowerCase();
      if (SUBDOMAIN_TENANTS[subdomain]) {
        candidateTenant = SUBDOMAIN_TENANTS[subdomain];
      }
    }
  }

  // 5. Strict UUID validation & 22P02 defense
  const resolvedTenantId = resolveTenantId(candidateTenant);

  // 6. Inject validated tenant ID into downstream request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', resolvedTenantId);
  requestHeaders.set('x-tenant-is-valid-uuid', isValidUUID(candidateTenant) ? 'true' : 'false');
  requestHeaders.set('x-tenant-fallback-applied', (!candidateTenant || !isValidUUID(candidateTenant)) ? 'true' : 'false');

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Also set response headers for client/inspector visibility
  response.headers.set('x-tenant-id', resolvedTenantId);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
