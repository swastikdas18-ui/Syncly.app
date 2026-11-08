import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Enforce verified authentication
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.email) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required to join communities.' },
      { status: 401 }
    );
  }

  // 2. Reject suspended or inactive accounts
  if (auth.profile?.status && auth.profile.status !== 'active') {
    return NextResponse.json(
      { error: `Forbidden. Account status is '${auth.profile.status}'.` },
      { status: 403 }
    );
  }

  // Rate limiting check
  const rl = await checkRateLimit('join_request', auth.userId);
  if (!rl.isAllowed) {
    if (rl.isServiceUnavailable) {
      return NextResponse.json(
        { error: 'Rate limiting service temporarily unavailable. Please retry shortly.' },
        { status: 503, headers: { 'Retry-After': '60' } }
      );
    }
    return NextResponse.json(
      { error: 'Too many join requests submitted. Please wait before trying again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  }

  try {
    const { id: communityId } = await params;
    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json({ error: 'Invalid community identifier.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';

    const email = auth.email.toLowerCase().trim();
    const domain = email.includes('@') ? email.split('@')[1] : '';

    const supabase = await createClient(request);

    // 3. Check if user is already an active member of this community
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id, role')
      .eq('user_id', auth.userId)
      .eq('community_id', communityId)
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json(
        { error: 'Conflict. You are already an active member of this workspace.', status: 'already_member' },
        { status: 409 }
      );
    }

    // 4. Query target tenant details from database
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, requires_approval, allowed_domains')
      .eq('id', communityId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Target workspace not found.' }, { status: 404 });
    }

    const tData = tenant as { id: string; name: string; requires_approval: boolean; allowed_domains: string[] };
    const allowedDomains: string[] = Array.isArray(tData.allowed_domains)
      ? tData.allowed_domains.map((d: string) => d.toLowerCase().trim().replace(/^@/, ''))
      : [];
    const domainMatches = allowedDomains.length > 0 && allowedDomains.includes(domain);

    // 5. Auto-join workflow (when approval is not required AND domain matches, or open enrollment)
    if (!tData.requires_approval && (allowedDomains.length === 0 || domainMatches)) {
      const { error: insertError } = await supabase
        .from('memberships')
        .insert({
          user_id: auth.userId,
          community_id: communityId,
          role: 'member',
        } as any);

      if (!insertError) {
        const response = NextResponse.json({
          success: true,
          status: 'joined',
          message: `Instant access granted${domainMatches ? ` via verified domain (@${domain})` : ''}.`,
          tenantId: communityId,
          rlsContextSql: buildTenantSessionSql(communityId),
        });

        response.cookies.set('active_tenant_id', communityId, {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
        });

        return response;
      }
    }

    // 6. Join Request Workflow: Check for existing pending request
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      adminClient = supabase;
    }

    const { data: existingRequest } = await adminClient
      .from('community_join_requests')
      .select('id, status, created_at')
      .eq('user_id', auth.userId)
      .eq('community_id', communityId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      const reqInfo = existingRequest as { id: string; status: string };
      return NextResponse.json({
        error: 'Conflict. You already have a pending join request awaiting administrator review.',
        status: 'pending',
        requestId: reqInfo.id,
      }, { status: 409 });
    }

    // 7. Persist new pending join request
    const { data: newReq, error: reqError } = await adminClient
      .from('community_join_requests')
      .insert({
        community_id: communityId,
        user_id: auth.userId,
        user_email: email,
        user_name: auth.fullName || auth.profile?.full_name || 'Applicant',
        message: message || 'Requesting workspace access.',
        status: 'pending',
      } as any)
      .select()
      .single();

    if (reqError) {
      if (reqError.code === '23505') {
        return NextResponse.json({
          error: 'Conflict. A pending join request already exists for this workspace.',
          status: 'pending',
        }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to queue join request.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Join request queued for administrator review.',
      request: newReq,
      rlsContextSql: buildTenantSessionSql(communityId),
    }, { status: 202 });
  } catch (err: any) {
    console.error('[API Join] Internal error:', err);
    return NextResponse.json({ error: 'Server error processing join request.' }, { status: 500 });
  }
}
