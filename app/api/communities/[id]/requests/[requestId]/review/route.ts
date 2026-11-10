import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
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
    if (auth.error && auth.error.startsWith('Forbidden.')) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }
    if (auth.error && auth.error.startsWith('Bad Request.')) {
      return NextResponse.json({ error: auth.error }, { status: 400 });
    }
    return NextResponse.json(
      { error: auth.error || 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  // 2. Reject if membership database query failed
  if (auth.membershipStatus === 'error') {
    return NextResponse.json(
      { error: 'Membership verification service temporarily unavailable.' },
      { status: 503 }
    );
  }

  // 3. Reject suspended or inactive accounts
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
    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json({ error: 'Invalid community identifier.' }, { status: 400 });
    }
    if (!requestId || !UUID_REGEX.test(requestId)) {
      return NextResponse.json({ error: 'Invalid request identifier.' }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action; // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    const supabase = await createClient(request);

    // Call atomic RPC: review_join_request(p_request_id, p_action)
    // Canonical database signature in Migration 017: review_join_request(UUID, TEXT)
    // Server-controlled role assignment inside the database procedure assigns 'member'.
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('review_join_request', {
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

    const result = rpcData as {
      success: boolean;
      status?: number;
      error?: string;
      message?: string;
      action?: string;
      community_id?: string;
      applicant_id?: string;
      membership_id?: string;
    };

    if (!result || !result.success) {
      const statusCode = typeof result?.status === 'number' ? result.status : 400;
      return NextResponse.json(
        { error: result?.error || 'Review operation rejected by server.', status: result?.status },
        { status: statusCode }
      );
    }

    // Record audit log
    await logAuditEvent({
      action: `join_request_${result.action}`,
      targetResource: `community_join_requests/${requestId}`,
      tenantId: result.community_id || communityId,
      actorId: auth.userId,
      metadata: {
        requestId,
        action: result.action,
        applicantId: result.applicant_id,
        membershipId: result.membership_id,
      },
    });

    const resultAction = result.action || action;
    const isApproved = resultAction === 'approve' || resultAction === 'approved';

    return NextResponse.json(
      {
        success: true,
        requestId,
        communityId: result.community_id || communityId,
        status: isApproved ? 'approved' : 'rejected',
        membershipId: result.membership_id || null,
        message: result.message || `Join request ${resultAction} successfully.`,
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
