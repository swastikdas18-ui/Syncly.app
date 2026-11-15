import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';

/**
 * GET /api/media/download?key={objectKey}
 * 
 * Authenticated & tenant-isolated media retrieval endpoint.
 * 
 * SECURITY RULES:
 * 1. Cryptographically verifies caller session via Supabase Auth.
 * 2. Extracts tenant prefix from key ({tenant_id}/posts/...) and verifies caller holds active
 *    membership in that specific tenant.
 * 3. Rejects cross-tenant access with HTTP 403 Forbidden.
 * 4. Rejects unauthenticated callers with HTTP 401 Unauthorized.
 * 5. Issues short-lived signed URL (TTL: 3600s) from Supabase Storage or returns signed asset.
 */
export async function GET(request: NextRequest) {
  // 1. Authenticate caller
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Cryptographically verified session required.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json(
      { error: 'Missing object key parameter.' },
      { status: 400 }
    );
  }

  // 2. Validate key format and extract tenant ID prefix
  const parts = key.split('/');
  if (parts.length < 2) {
    return NextResponse.json(
      { error: 'Invalid object key structure. Must be tenant-partitioned.' },
      { status: 400 }
    );
  }

  const targetTenantId = parts[0].toLowerCase();

  // 3. Prevent path traversal attacks
  if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    return NextResponse.json(
      { error: 'Path traversal detected.' },
      { status: 400 }
    );
  }

  // 4. Verify tenant membership: caller MUST be an active member of target tenant
  const isMember = auth.memberships.some(
    (m) => m.community_id.toLowerCase() === targetTenantId
  ) || (auth.activeTenantId && auth.activeTenantId.toLowerCase() === targetTenantId);

  if (!isMember) {
    return NextResponse.json(
      { error: 'Forbidden. Cross-tenant media download denied.' },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient(request);

    // Create a short-lived signed URL and redirect the browser to the private
    // Storage object. This keeps the persisted message URL stable while ensuring
    // the file bytes never pass through the Vercel Function response.
    const { data, error } = await supabase.storage
      .from('community-media')
      .createSignedUrl(key, 300);

    if (error || !data?.signedUrl) {
      console.error('[media/download] Signed URL creation failed:', error);
      return NextResponse.json(
        { error: 'Media file is unavailable or you no longer have access to it.' },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    return NextResponse.redirect(data.signedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Storage signing error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

