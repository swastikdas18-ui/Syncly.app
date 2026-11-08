import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';
import { logAuditEvent } from '@/lib/audit.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  // 1. Enforce verified authentication
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
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

  // Rate limiting for administrative reviews
  const rl = await checkRateLimit('admin_mutation', auth.userId);
  if (!rl.isAllowed) {
    return NextResponse.json(
      { error: 'Administrative action rate limit exceeded. Please wait a moment.' },
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
    const { id: communityId, requestId } = await params;

    // Validate UUID formats
    if (!communityId || !UUID_REGEX.test(communityId) || !requestId || !UUID_REGEX.test(requestId)) {
      return NextResponse.json(
        { error: 'Invalid community identifier or request identifier format.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Validate action strictly against 'approve' and 'reject'
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "approve" or "reject".' },
        { status: 400 }
      );
    }

    // 3. Authenticated Supabase Client
    // Propagates authenticated user's JWT/session cookies directly to PostgreSQL
    const supabase = await createClient(request);

    // 4. Delegate review atomically to PostgreSQL review_join_request function
    // All authorization rules (reviewer identity via auth.uid(), target workspace ownership,
    // active profile check, self-approval defense, row lock, conflict check, and role hardcoding)
    // are enforced atomically inside the database engine.
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('review_join_request', {
      p_request_id: requestId,
      p_action: action,
    });

    if (rpcError) {
      console.error('[Review Join RPC Error]:', rpcError.message);
      // Map database exceptions safely without exposing internal database errors
      if (rpcError.code === '42883') {
        return NextResponse.json(
          { error: 'Join request workflow RPC function not found on database.' },
          { status: 501 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to process join request review.' },
        { status: 500 }
      );
    }

    // Parse structured JSONB response from review_join_request
    const result = (typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult) || {};

    if (!result.success) {
      const statusCode = typeof result.status === 'number' ? result.status : 400;
      return NextResponse.json(
        {
          error: result.error || 'Failed to review join request.',
          status: result.status,
          success: false,
        },
        { status: statusCode }
      );
    }

    // 5. Successful Execution - Record immutable audit log
    await logAuditEvent({
      tenantId: result.community_id || communityId,
      actorId: auth.userId,
      action: result.action === 'approve' ? 'join_request_approved' : 'join_request_rejected',
      targetResource: `join_request:${requestId}`,
      metadata: {
        requestId,
        action: result.action,
        applicantId: result.applicant_id,
        membershipId: result.membership_id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        requestId,
        communityId: result.community_id || communityId,
        status: result.action === 'approve' ? 'approved' : 'rejected',
        membershipId: result.membership_id || null,
        message: result.message || `Join request ${result.action} successfully.`,
        rlsContextSql: buildTenantSessionSql(communityId),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[API Review] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Server error reviewing join request.' },
      { status: 500 }
    );
  }
}
