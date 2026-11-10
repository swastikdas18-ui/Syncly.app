import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server.ts';
import type { ProfileRow, MembershipRow } from '@/types/database.ts';

export type MembershipFetchStatus = 'success' | 'empty' | 'error';

/**
 * Syncly Verified Authentication Context
 * Derived strictly from Supabase Auth and PostgreSQL public database tables.
 */
export interface VerifiedAuthContext {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  profile: ProfileRow | null;
  role: 'owner' | 'admin' | 'moderator' | 'employee' | 'intern' | null;
  activeTenantId: string | null;
  tenantId: string | null; // convenience alias to activeTenantId
  fullName: string | null; // convenience alias to profile?.full_name
  membershipStatus: MembershipFetchStatus;
  membershipError?: string;
  memberships: MembershipRow[];
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  return UUID_REGEX.test(uuid.trim());
}

/**
 * Centralized Server-Side Authentication & Authorization Authority.
 * 
 * SECURITY RULES ENFORCED (Cycle 10.4):
 * 1. Supabase Auth is the SOLE identity authority (verified via supabase.auth.getUser()).
 * 2. Never trusts manually decoded JWT payloads or client headers (x-user-id, x-user-email).
 * 3. Never trusts client-declared roles (syncly_role, body.role).
 * 4. Resolves user profile, active status, and tenant memberships from PostgreSQL public schema.
 * 5. Explicitly separates membership query error from legitimate 0-membership state:
 *    - 'success': user holds verified memberships
 *    - 'empty': query succeeded, user has 0 memberships
 *    - 'error': query failed or timed out (preserves session, fails closed on tenant-dependent actions)
 * 6. Supports switching between multiple genuinely verified memberships (e.g. Acme <-> Globex).
 * 7. Candidate workspace (from x-tenant-id or active_tenant_id cookie) is validated strictly
 *    against user's verified memberships. Unauthorized workspace request returns HTTP 403.
 */
export async function getVerifiedAuthContext(req?: NextRequest): Promise<VerifiedAuthContext> {
  const unauthorizedResult = (errorMessage: string = 'Unauthorized. Cryptographically verified Supabase authentication required.'): VerifiedAuthContext => ({
    isAuthenticated: false,
    userId: null,
    email: null,
    profile: null,
    role: null,
    activeTenantId: null,
    tenantId: null,
    fullName: null,
    membershipStatus: 'error',
    membershipError: errorMessage,
    memberships: [],
    error: errorMessage,
  });

  try {
    const supabase = await createClient(req);

    // 1. Authoritative identity verification via Supabase Auth server
    const authHeader = req?.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    if (bearerToken) {
      await supabase.auth.setSession({ access_token: bearerToken, refresh_token: '' }).catch(() => {});
    }
    const { data: { user }, error: authError } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedResult(authError?.message || 'Unauthorized. Valid Supabase session required.');
    }

    // 2. Fetch authoritative profile from PostgreSQL public.profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      return unauthorizedResult('Forbidden. User profile record not found in database.');
    }

    const profile = profileData as unknown as ProfileRow;

    // 3. Verify user account status (prevent deactivated/suspended users from acting)
    if (profile.status && profile.status !== 'active') {
      return unauthorizedResult(`Forbidden. User account status is '${profile.status}'.`);
    }

    // 4. Fetch user's tenant memberships from PostgreSQL public.memberships with explicit error handling
    const { data: membershipsData, error: memErr } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id);

    // CRITICAL: Handle database/network/RLS error explicitly - DO NOT silently convert to empty array
    if (memErr) {
      console.error('[getVerifiedAuthContext] Membership database query error:', memErr);
      return {
        isAuthenticated: true, // User session is valid
        userId: user.id,
        email: user.email || null,
        profile,
        role: (profile.role as any) || 'employee',
        activeTenantId: null,
        tenantId: null,
        fullName: profile.full_name || null,
        membershipStatus: 'error',
        membershipError: memErr.message || 'Database error querying memberships.',
        memberships: [],
        error: 'Membership verification service temporarily unavailable.',
      };
    }

    const memberships: MembershipRow[] = (membershipsData as unknown as MembershipRow[]) || [];
    const membershipStatus: MembershipFetchStatus = memberships.length === 0 ? 'empty' : 'success';

    // 5. Handle verified ZERO memberships (un-enrolled account / new registration onboarding)
    if (memberships.length === 0) {
      return {
        isAuthenticated: true,
        userId: user.id,
        email: user.email || null,
        profile,
        role: (profile.role as any) || 'employee',
        activeTenantId: null,
        tenantId: null,
        fullName: profile.full_name || null,
        membershipStatus: 'empty',
        memberships: [],
      };
    }

    // 6. Resolve active workspace context strictly from verified memberships
    let candidateTenantId: string | null = null;

    if (req) {
      const headerTenant = req.headers.get('x-tenant-id');
      const cookieTenant = req.cookies.get('active_tenant_id')?.value;
      candidateTenantId = headerTenant || cookieTenant || null;
    } else {
      const cookieStore = await cookies();
      candidateTenantId = cookieStore.get('active_tenant_id')?.value || null;
    }

    let activeTenantId: string | null = null;
    let resolvedRole: 'owner' | 'admin' | 'moderator' | 'employee' | 'intern' = (profile.role as any) || 'employee';

    if (candidateTenantId && isValidUUID(candidateTenantId)) {
      const normalizedCandidate = candidateTenantId.trim().toLowerCase();

      // Sole authoritative source of truth: Check if user holds an explicit membership in requested tenant
      const matchingMembership = memberships.find(
        (m) => m.community_id.toLowerCase() === normalizedCandidate
      );

      if (matchingMembership) {
        activeTenantId = matchingMembership.community_id;
        resolvedRole = (matchingMembership.role as any) || 'employee';
      } else {
        // If candidate tenant was requested via explicit header or cookie, and user does not belong to it,
        // reject cross-tenant access with 403.
        const isExplicitHeader = req && Boolean(req.headers.get('x-tenant-id'));
        if (isExplicitHeader) {
          return {
            isAuthenticated: false,
            userId: user.id,
            email: user.email || null,
            profile,
            role: null,
            activeTenantId: null,
            tenantId: null,
            fullName: profile.full_name || null,
            membershipStatus: 'success',
            memberships,
            error: 'Forbidden. You do not hold an active membership in the requested workspace.',
          };
        } else {
          // Stale browser cookie for non-enrolled workspace: reject candidate and fallback to first verified membership
          const firstVerified = memberships[0];
          activeTenantId = firstVerified.community_id;
          resolvedRole = (firstVerified.role as any) || 'employee';
        }
      }
    } else {
      // No candidate provided or candidate invalid: select user's first verified active membership
      const defaultMembership = memberships[0];
      activeTenantId = defaultMembership.community_id;
      resolvedRole = (defaultMembership.role as any) || 'employee';
    }

    return {
      isAuthenticated: true,
      userId: user.id,
      email: user.email || null,
      profile,
      role: resolvedRole,
      activeTenantId,
      tenantId: activeTenantId,
      fullName: profile.full_name || null,
      membershipStatus,
      memberships,
    };
  } catch (err: any) {
    console.error('[getVerifiedAuthContext] Internal auth verification error:', err);
    return unauthorizedResult('Internal authorization failure.');
  }
}
