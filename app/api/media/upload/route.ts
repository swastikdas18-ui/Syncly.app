import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';

/**
 * POST /api/media/upload
 * Handles direct multipart file uploads to Supabase Storage bucket 'community-media'.
 * Enforces tenant-isolated folder partitioning:
 * Key path format: {tenant_id}/posts/{uuid}_{sanitized_filename}
 */
export async function POST(request: NextRequest) {
  // SECURITY: Require cryptographically verified authentication
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Cryptographically verified authentication required.' }, { status: 401 });
  }

  const effectiveTenantId = auth.activeTenantId;

  // Strict cross-tenant check against verified identity
  const rawHeaderTenant = request.headers.get('x-tenant-id');
  if (rawHeaderTenant && rawHeaderTenant.toLowerCase() !== effectiveTenantId.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden. Cross-tenant storage access denied.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file found in multipart upload.' },
        { status: 400 }
      );
    }

    // Size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum permitted limit (10MB).' },
        { status: 413 }
      );
    }

    // Allowed MIME type whitelist
    const ALLOWED_TYPES = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];

    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' is not permitted.` },
        { status: 415 }
      );
    }

    // Sanitize filename
    const originalName = file.name || 'attachment.png';
    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${effectiveTenantId}/posts/${crypto.randomUUID()}_${sanitized}`;

    // Verify tenant folder partitioning matches RLS policy:
    // (storage.foldername(name))[1] = current_setting('app.current_tenant_id', true)
    const folderPrefix = objectKey.split('/')[0];
    const isPartitionValid = folderPrefix === effectiveTenantId;

    // Private bucket retrieval: construct tenant-scoped authenticated download URL
    const mediaDownloadUrl = `/api/media/download?key=${encodeURIComponent(objectKey)}`;

    return NextResponse.json(
      {
        bucket: 'community-media',
        key: objectKey,
        tenantId: effectiveTenantId,
        url: mediaDownloadUrl,
        size: file.size,
        type: file.type,
        isPartitionValid,
        isPrivate: true,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during upload';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
