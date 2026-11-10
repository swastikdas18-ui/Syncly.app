import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tenant/members
 * 
 * Strict Tenant-Isolated Members Roster:
 * 1. Authenticates caller session cryptographically.
 * 2. Checks membership verification status: fails with 503 if memberships query had database error.
 * 3. Resolves target workspace ID from request header `x-tenant-id` or active session.
 * 4. Verifies caller holds an active membership in the target workspace (403 if unauthorized).
 * 5. Queries `memberships` table filtered strictly by `community_id = targetWorkspaceId`.
 * 6. Fetches corresponding profile records. Fails closed with 500 if profile query errors (never silently falls back).
 * 7. Returns sanitized member list without internal SQL or diagnostic leaks.
 */
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    if (auth.error && auth.error.startsWith('Bad Request.')) {
      return NextResponse.json(
        { error: auth.error },
        { status: 400 }
      );
    }
    if (auth.error && auth.error.startsWith('Forbidden.')) {
      return NextResponse.json(
        { error: auth.error },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: auth.error || 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  // Handle membership query failure explicitly (fail closed with 503)
  if (auth.membershipStatus === 'error') {
    return NextResponse.json(
      { error: 'Membership verification service temporarily unavailable.' },
      { status: 503 }
    );
  }

  // Determine requested workspace from header or active context
  const headerTenantId = request.headers.get('x-tenant-id');
  const targetTenantId = headerTenantId || auth.activeTenantId;

  if (!targetTenantId) {
    return NextResponse.json(
      { error: 'Target workspace context required.' },
      { status: 400 }
    );
  }

  // Validate caller membership in requested workspace
  const isMemberOfTarget = auth.memberships.some(
    (m) => m.community_id === targetTenantId
  );

  if (!isMemberOfTarget) {
    return NextResponse.json(
      { error: 'Forbidden. You do not hold active membership in this workspace.' },
      { status: 403 }
    );
  }

  const supabase = await createClient(request);

  // Query memberships scoped strictly to this workspace
  const { data: membershipRows, error: memErr } = await supabase
    .from('memberships')
    .select('id, user_id, community_id, role, joined_at')
    .eq('community_id', targetTenantId);

  if (memErr) {
    return NextResponse.json(
      { error: 'Failed to query workspace memberships.' },
      { status: 500 }
    );
  }

  const userIds = (membershipRows || []).map((m: any) => m.user_id).filter(Boolean);

  // Fetch corresponding profiles
  let profileMap: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, status, created_at')
      .in('id', userIds);

    // Fail closed if profile query encounters an error (do not silently show broken/generic members)
    if (profileErr) {
      console.error('[tenant/members] Profile lookup error:', profileErr);
      return NextResponse.json(
        { error: 'Failed to load member profiles.' },
        { status: 500 }
      );
    }

    if (profiles) {
      profiles.forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }
  }

  // Assemble verified member objects
  const members = (membershipRows || []).map((m: any) => {
    const prof = profileMap[m.user_id] || {};
    return {
      id: m.user_id,
      membershipId: m.id,
      name: prof.full_name || 'Team Member',
      avatarUrl: prof.avatar_url || null,
      role: m.role || 'member',
      status: prof.status || 'active',
      joinedAt: m.joined_at,
      tenantId: m.community_id,
    };
  });

  return NextResponse.json({
    success: true,
    tenantId: targetTenantId,
    count: members.length,
    data: members,
  });
}
