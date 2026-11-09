import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { createClient } from '@/lib/supabase/server.ts';

/**
 * GET /api/profile
 * Returns the authenticated user's profile and active workspace context.
 */
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
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
    rlsContextSql: buildTenantSessionSql(auth.activeTenantId),
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
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    
    // Explicitly reject any attempt to submit privileged role modifications
    if ('role' in body) {
      return NextResponse.json(
        { error: 'Forbidden. Role modifications cannot be performed through self-service profile updates.' },
        { status: 403 }
      );
    }

    const { fullName, avatarUrl } = body;

    const supabase = await createClient(request);

    // Update public.profiles in database for the authenticated user only
    const updatePayload: { full_name?: string; avatar_url?: string } = {};
    if (typeof fullName === 'string' && fullName.trim()) {
      updatePayload.full_name = fullName.trim();
    }
    if (typeof avatarUrl === 'string') {
      updatePayload.avatar_url = avatarUrl.trim();
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await (supabase.from('profiles') as any)
        .update(updatePayload)
        .eq('id', auth.userId);

      if (updateError) {
        // Redacted diagnostic logging: log code & message without leaking PII or credentials
        console.error('[API /api/profile] Database update failure:', {
          code: updateError.code,
          message: updateError.message,
          userId: auth.userId ? `${auth.userId.slice(0, 8)}...` : undefined
        });

        return NextResponse.json(
          {
            error: 'Database error occurred while updating profile.',
            details: updateError.message
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
      rlsContextSql: buildTenantSessionSql(auth.activeTenantId),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Malformed payload.' },
      { status: 400 }
    );
  }
}
