import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server.ts';
import type { ProfileRow, MembershipRow } from '@/types/database.ts';

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
  memberships: MembershipRow[];
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  return UUID_REGEX.test(uuid.trim());
}

/**
 * Centralized Server-Side Authentication & Authorization Authority.
 * 
 * SECURITY RULES ENFORCED:
 * 1. Supabase Auth is the SOLE identity authority (verified via supabase.auth.getUser()).
 * 2. Never trusts manually decoded JWT payloads or client headers (x-user-id, x-user-email).
 * 3. Never trusts client-declared roles (syncly_role, body.role).
 * 4. Resolves user profile, active status, and tenant memberships from PostgreSQL public schema.
 * 5. Fails closed if user is unauthenticated, deactivated, or lacks membership in target tenant.
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

    // 4. Fetch user's tenant memberships from PostgreSQL public.memberships
    const { data: membershipsData } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id);

    const memberships: MembershipRow[] = (membershipsData as unknown as MembershipRow[]) || [];

    // 5. Resolve active workspace context
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
        // Explicit cross-tenant access denied. Stale profile.tenant_id cannot restore access.
        return {
          isAuthenticated: false,
          userId: user.id,
          email: user.email || null,
          profile,
          role: null,
          activeTenantId: null,
          tenantId: null,
          fullName: profile.full_name || null,
          memberships,
          error: 'Forbidden. You do not hold an active membership in the requested workspace.',
        };
      }
    } else {
      // Default to user's verified active membership matching profile.tenant_id or first enrolled membership
      const defaultMembership = memberships.find(
        (m) => profile.tenant_id && m.community_id.toLowerCase() === profile.tenant_id.toLowerCase()
      ) || memberships[0] || null;

      if (defaultMembership) {
        activeTenantId = defaultMembership.community_id;
        resolvedRole = (defaultMembership.role as any) || 'employee';
      } else {
        // User has no active memberships in any tenant (all revoked/deleted)
        activeTenantId = null;
        resolvedRole = null;
      }
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
      memberships,
    };
  } catch (err: any) {
    console.error('[getVerifiedAuthContext] Internal auth verification error:', err);
    return unauthorizedResult('Internal authorization failure.');
  }
}
