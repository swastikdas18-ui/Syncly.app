import { NextResponse } from 'next/server';
import type { VerifiedAuthContext } from '@/lib/auth/server.ts';

/**
 * Validates the auth context for workspace-scoped API endpoints.
 * 
 * Enforces Cycle 10.4.1 authorization semantics:
 * - Unauthenticated -> 401 Unauthorized
 * - Malformed x-tenant-id header -> 400 Bad Request
 * - Cross-tenant or unauthorized workspace -> 403 Forbidden
 * - Membership database error -> 503 Service Unavailable
 * - Authenticated with 0 memberships -> null activeTenantId (can be handled or rejected depending on endpoint)
 */
export function handleAuthErrors(
  auth: VerifiedAuthContext,
  options: { requireWorkspace?: boolean } = { requireWorkspace: true }
): NextResponse | null {
  // 1. Explicit error checks from getVerifiedAuthContext
  if (auth.error) {
    if (auth.error.startsWith('Bad Request.')) {
      return NextResponse.json({ error: auth.error }, { status: 400 });
    }
    if (auth.error.startsWith('Forbidden.')) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }
    if (auth.error.startsWith('Unauthorized.')) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
  }

  // 2. Unauthenticated check
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  // 3. Membership query error check (fail closed with 503)
  if (auth.membershipStatus === 'error') {
    return NextResponse.json(
      { error: 'Membership verification service temporarily unavailable.' },
      { status: 503 }
    );
  }

  // 4. Workspace required check (e.g. posts, channels, events)
  if (options.requireWorkspace && !auth.activeTenantId) {
    if (auth.membershipStatus === 'empty' || auth.memberships.length === 0) {
      return NextResponse.json(
        { error: 'No active workspace membership found. Please join or create a workspace.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Active workspace context required.' },
      { status: 400 }
    );
  }

  return null;
}
