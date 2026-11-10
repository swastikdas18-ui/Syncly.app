import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';

/**
 * GET /api/profile
 * Returns the authenticated user's profile and active workspace context.
 */
export async function GET(request: NextRequest) {
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

  // Handle membership query failure explicitly (fail closed with 503)
  if (auth.membershipStatus === 'error') {
    return NextResponse.json(
      { error: 'Membership verification service temporarily unavailable.' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: auth.userId,
      email: auth.email,
      fullName: auth.fullName,
      role: auth.role,
      tenantId: auth.activeTenantId,
    },
    profile: auth.profile,
    memberships: auth.memberships,
  });
}

/**
 * PATCH /api/profile
 * Updates self-service profile fields.
 * 
 * SECURITY: Prevents self-escalation of roles. Role changes can only be made
 * by organization owners and administrators through dedicated admin endpoints.
 */
export async function PATCH(request: NextRequest) {
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

  // Handle membership query failure explicitly (fail closed with 503)
  if (auth.membershipStatus === 'error') {
    return NextResponse.json(
      { error: 'Membership verification service temporarily unavailable.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    // Whitelist permitted self-service fields
    const updatePayload: Record<string, any> = {};

    if (body.fullName !== undefined) {
      if (typeof body.fullName !== 'string' || body.fullName.trim().length === 0) {
        return NextResponse.json(
          { error: 'Full name cannot be empty.' },
          { status: 400 }
        );
      }
      updatePayload.full_name = body.fullName.trim();
    }

    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl && !body.avatarUrl.startsWith('http://') && !body.avatarUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Avatar URL must use http or https scheme.' },
          { status: 400 }
        );
      }
      updatePayload.avatar_url = body.avatarUrl;
    }

    // Role/tenant escalation prevention: ignore client role or tenant modifications
    const supabase = await createClient(request);

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await (supabase.from('profiles') as any)
        .update(updatePayload)
        .eq('id', auth.userId);

      if (updateError) {
        console.error('[API /api/profile] Database update failure:', {
          code: updateError.code,
          message: updateError.message,
          userId: auth.userId ? `${auth.userId.slice(0, 8)}...` : undefined
        });

        return NextResponse.json(
          {
            error: 'Database error occurred while updating profile.',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: auth.userId,
        email: auth.email,
        fullName: updatePayload.full_name || auth.fullName,
        avatarUrl: updatePayload.avatar_url || auth.profile?.avatar_url,
        role: auth.role, // Preserves authoritative role from DB; client role input is discarded
        tenantId: auth.activeTenantId,
      },
      message: 'Profile updated successfully. Role modifications are restricted to workspace administrators.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Malformed payload.' },
      { status: 400 }
    );
  }
}
