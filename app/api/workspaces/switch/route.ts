import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { isValidUUID, resolveTenantId } from '@/lib/tenant/context.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { logAuditEvent } from '@/lib/audit.ts';

/**
 * POST /api/workspaces/switch
 * Switches the active workspace context for an authenticated user.
 * 
 * SECURITY RULES:
 * 1. Requires verified authentication via Supabase Auth (getVerifiedAuthContext).
 * 2. Queries PostgreSQL public.memberships to verify that the user holds an active membership
 *    in the target tenant (or matches their primary home tenant in public.profiles).
 * 3. Rejects users without valid membership with HTTP 403 Forbidden.
 * 4. Sets a validated preference cookie 'active_tenant_id' for downstream route requests.
 */
export async function POST(request: NextRequest) {
  // 1. Authenticate caller
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    if (auth.error && auth.error.startsWith('Bad Request.')) {
      return NextResponse.json({ error: auth.error }, { status: 400 });
    }
    if (auth.error && auth.error.startsWith('Forbidden.')) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
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
    const body = await request.json().catch(() => ({}));
    const targetTenantId = body?.tenantId;

    // 2. Validate tenant UUID format
    if (!targetTenantId || !isValidUUID(targetTenantId)) {
      return NextResponse.json(
        { error: 'Invalid or missing target tenant UUID.' },
        { status: 400 }
      );
    }

    const safeTenantId = resolveTenantId(targetTenantId);
    if (!safeTenantId) {
      return NextResponse.json(
        { error: 'Invalid target tenant UUID format.' },
        { status: 400 }
      );
    }

    // 3. Query PostgreSQL public.memberships to verify actual membership
    const supabase = await createClient(request);

    const { data: membershipRecord, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', auth.userId)
      .eq('community_id', safeTenantId)
      .maybeSingle();

    if (membershipError) {
      console.error('[workspace/switch] Membership query error:', membershipError);
      return NextResponse.json(
        { error: 'Membership verification service temporarily unavailable.' },
        { status: 503 }
      );
    }

    const targetRole: string | null = (membershipRecord as any)?.role || null;

    // Stale profile.tenant_id is NEVER trusted without an explicit record in public.memberships
    if (!targetRole) {
      return NextResponse.json(
        { error: 'Forbidden. You do not hold an active membership in the target workspace.' },
        { status: 403 }
      );
    }

    // 4. Fetch target workspace metadata from public.tenants
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug')
      .eq('id', safeTenantId)
      .maybeSingle();

    if (tenantError) {
      console.error('[workspace/switch] Tenant metadata lookup error:', tenantError);
      return NextResponse.json(
        { error: 'Workspace metadata service temporarily unavailable.' },
        { status: 503 }
      );
    }

    if (!tenantData) {
      return NextResponse.json(
        { error: 'Workspace not found.' },
        { status: 404 }
      );
    }

    const workspaceInfo = {
      id: safeTenantId,
      name: (tenantData as any).name || 'Workspace',
      slug: (tenantData as any).slug || 'workspace',
      role: targetRole,
    };

    const response = NextResponse.json({
      success: true,
      workspace: workspaceInfo,
      message: `Active workspace successfully switched to ${workspaceInfo.name}.`,
    });

    // 5. Set active_tenant_id preference cookie
    response.cookies.set('active_tenant_id', safeTenantId, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
      httpOnly: false,
    });

    // 6. Record audit event
    await logAuditEvent({
      tenantId: safeTenantId,
      actorId: auth.userId,
      action: 'workspace_switched',
      targetResource: `tenant:${safeTenantId}`,
      metadata: {
        targetTenantId: safeTenantId,
        targetRole,
      },
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Workspace switch failed.' },
      { status: 500 }
    );
  }
}
