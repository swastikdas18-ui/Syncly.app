import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';
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

    const parsedDomains = Array.isArray(allowedDomains)
      ? allowedDomains.map((d: string) => d.trim().replace(/^@/, '').toLowerCase()).filter(Boolean)
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
      p_allowed_domains: parsedDomains,
      p_requires_approval: requiresApproval === true,
      p_is_discoverable: isDiscoverable !== false,
    });

    if (rpcError) {
      if (rpcError.code === '42883' || rpcError.code === 'PGRST202' || rpcError.message?.includes('Could not find the function')) {
        console.error('[WorkspaceCreate] Atomic RPC unavailable (Migration 018 required):', {
          code: rpcError.code,
          message: rpcError.message,
        });
        return NextResponse.json(
          {
            error: 'Atomic workspace creation service is unavailable. Database migration 018 (create_workspace RPC) must be applied to ensure transactional consistency.',
            code: 'RPC_UNAVAILABLE',
          },
          { status: 503 }
        );
      }

      console.error('[WorkspaceCreate] Database error executing create_workspace RPC:', {
        code: rpcError.code,
        message: rpcError.message,
      });
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
      rlsContextSql: buildTenantSessionSql(createdData.id),
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
