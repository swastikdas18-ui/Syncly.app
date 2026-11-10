import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  const { id: communityId } = await params;
  if (!communityId || !UUID_REGEX.test(communityId)) {
    return NextResponse.json({ error: 'Invalid community identifier.' }, { status: 400 });
  }

  const supabase = await createClient(request);

  // Authoritative check: Verify caller holds active owner or admin role in the target workspace
  const { data: callerMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', auth.userId)
    .eq('community_id', communityId)
    .maybeSingle();

  const callerRole = (callerMembership as { role?: string } | null)?.role;
  const isAuthorized = callerRole === 'owner' || callerRole === 'admin';
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Forbidden. Admin or owner role required to view join requests.' },
      { status: 403 }
    );
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    adminClient = supabase;
  }

  // Load join requests for this community
  const { data: requests, error } = await (adminClient.from('community_join_requests') as any)
    .select(`
      id,
      community_id,
      user_id,
      status,
      created_at,
      reviewed_at
    `)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load join requests.' }, { status: 500 });
  }

  // Load requester profiles
  const userIds = Array.from(new Set((requests || []).map((r: any) => r.user_id).filter(Boolean)));
  let profileMap: Record<string, { email?: string; full_name?: string }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await (adminClient.from('profiles') as any)
      .select('id, email, full_name')
      .in('id', userIds);

    if (profiles) {
      profiles.forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }
  }

  const list = (requests || []).map((r: any) => ({
    id: r.id,
    communityId: r.community_id,
    userId: r.user_id,
    userEmail: profileMap[r.user_id]?.email || '',
    userName: profileMap[r.user_id]?.full_name || 'Anonymous User',
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    // Keep snake_case for DB clients
    community_id: r.community_id,
    user_id: r.user_id,
    user_email: profileMap[r.user_id]?.email || '',
    user_name: profileMap[r.user_id]?.full_name || 'Anonymous User',
    created_at: r.created_at,
    reviewed_at: r.reviewed_at,
  }));
  const pendingCount = list.filter((r: any) => r.status === 'pending').length;

  return NextResponse.json({
    success: true,
    communityId,
    authorizedRole: callerRole,
    count: list.length,
    pendingCount,
    data: list,
  });
}
