import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required to create workspaces.' },
      { status: 401 }
    );
  }

  // Fail-closed membership verification status handling:
  // 1. Database/membership query error -> Fail closed with HTTP 503
  if (auth.membershipStatus === 'error') {
    return NextResponse.json(
      { error: 'Membership verification service temporarily unavailable.' },
      { status: 503 }
    );
  }

  // 2. Canonical Workspace Creation Authorization Policy:
  // - Verified Account with 0 memberships (membershipStatus = 'empty'): Allowed for first-workspace onboarding
  // - Account with existing verified memberships (membershipStatus = 'success'): Restricted strictly to 'admin' and 'owner'
  // - Managers, Members, Interns, Employees, and Inactive profiles: Denied (403)
  // - Missing or unverified roles: Denied (Fail-closed)
  if (auth.membershipStatus === 'empty') {
    // Permitted: first-workspace onboarding
  } else if (auth.membershipStatus === 'success') {
    // Strict canonical alignment: caller must be Admin or Owner in their active workspace context
    // or hold an verified Admin/Owner role across their memberships
    const hasAdminOrOwnerMembership = auth.memberships.some((m) => m.role === 'admin' || m.role === 'owner');
    const isPrivilegedRole = (auth.role === 'admin' || auth.role === 'owner') || hasAdminOrOwnerMembership;
    if (!isPrivilegedRole) {
      return NextResponse.json(
        { error: 'Forbidden. Workspace creation is restricted to Organization Administrators and Owners.' },
        { status: 403 }
      );
    }
  } else {
    // Fail-closed on any unrecognized membership status
    return NextResponse.json(
      { error: 'Forbidden. Unable to verify workspace creation permissions.' },
      { status: 403 }
    );
  }

  // Rate limit community creation
  const rl = await checkRateLimit('community_create', auth.userId);
  if (!rl.isAllowed) {
    if (rl.isServiceUnavailable) {
      return NextResponse.json(
        { error: 'Rate limiting service temporarily unavailable. Please retry shortly.' },
        { status: 503, headers: { 'Retry-After': '60' } }
      );
    }
    return NextResponse.json(
      { error: 'Too many communities created. Please wait before creating another.' },
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
    const body = await request.json();
    const { name, slug, tagline, description, logoUrl, allowedDomains, requiresApproval, isDiscoverable, industry } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Community name is required.' }, { status: 400 });
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sanitizedDomains = Array.isArray(allowedDomains)
      ? allowedDomains
          .map((d: any) => String(d).trim().toLowerCase().replace(/^@/, ''))
          .filter(Boolean)
      : [];

    const supabase = await createClient(request);

    // Call atomic PostgreSQL RPC to create tenant, initial owner membership, and audit log
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('create_workspace', {
      p_name: name.trim(),
      p_slug: cleanSlug,
      p_tagline: tagline?.trim() || null,
      p_description: description?.trim() || null,
      p_logo_url: logoUrl?.trim() || null,
      p_industry: industry?.trim() || null,
      p_allowed_domains: sanitizedDomains,
      p_requires_approval: requiresApproval === true,
      p_is_discoverable: isDiscoverable !== false,
    });

    if (rpcError) {
      console.error('[create_workspace RPC Error]:', rpcError);
      return NextResponse.json(
        { error: 'Failed to create workspace: ' + (rpcError.message || 'Database error') },
        { status: 500 }
      );
    }

    if (!rpcResult || !rpcResult.success) {
      const statusCode = rpcResult?.status || 400;
      return NextResponse.json(
        { error: rpcResult?.error || 'Workspace creation rejected.' },
        { status: statusCode }
      );
    }

    const createdData = rpcResult.data;
    const response = NextResponse.json({
      success: true,
      data: createdData,
      message: `Community created successfully. Creator assigned role = 'owner'.`,
    }, { status: 201 });

    response.cookies.set('active_tenant_id', createdData.id, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }
}
