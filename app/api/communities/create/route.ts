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
      if ((rpcError.code === '42883' || rpcError.code === 'PGRST202' || rpcError.message?.includes('Could not find the function')) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        // Fallback for pre-migration-018 environments where RPC is not yet registered
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const serviceHeaders = {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        };
        const tenantUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants`;
        const tRes = await fetch(tenantUrl, {
          method: 'POST',
          headers: serviceHeaders,
          body: JSON.stringify({
            name: name.trim(),
            slug: cleanSlug,
            allowed_domains: parsedDomains,
            requires_approval: requiresApproval === true,
            is_discoverable: isDiscoverable !== false,
          }),
        });
        const createdTenants = await tRes.json();
        const tenant = Array.isArray(createdTenants) ? createdTenants[0] : createdTenants;
        if (tenant?.id) {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/memberships`, {
            method: 'POST',
            headers: serviceHeaders,
            body: JSON.stringify({
              community_id: tenant.id,
              user_id: auth.userId,
              role: 'owner',
            }),
          });

          // Insert audit log
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: serviceHeaders,
            body: JSON.stringify({
              tenant_id: tenant.id,
              actor_id: auth.userId,
              action: 'tenant.created',
              target_resource: `tenant:${tenant.id}`,
              metadata: { name: tenant.name, slug: tenant.slug },
            }),
          }).catch(() => {});

          const response = NextResponse.json({
            success: true,
            data: {
              ...tenant,
              tagline: tagline?.trim() || 'Corporate Workspace',
              industry: industry?.trim() || 'Technology',
              logoUrl: logoUrl?.trim() || null,
            },
            message: `Community created successfully. Creator assigned role = 'owner'.`,
            rlsContextSql: buildTenantSessionSql(tenant.id),
          }, { status: 201 });

          response.cookies.set('active_tenant_id', tenant.id, {
            path: '/',
            maxAge: 86400,
            sameSite: 'lax',
          });
          return response;
        }
      }

      // Fallback for unexpected database errors
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
