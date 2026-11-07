# VERIFICATION CYCLE 2: SUPABASE STORAGE AUTHORIZATION REPORT

**System**: Syncly Enterprise Platform  
**Target Component**: Supabase Storage (`community-media`), File Uploads & RLS Policies  
**Files Audited**:
- `app/api/media/upload/route.ts`
- `supabase/migrations/011_rls_security_hardening.sql`  
**Evaluation Status**: **CONDITIONALLY VERIFIED** (API upload route enforces authentication, MIME whitelisting, and tenant prefix matching; storage bucket public status represents a residual risk)

---

## 1. Storage Architecture & Folder Partitioning

Syncly stores attachments, post images, and profile assets within the Supabase Storage bucket **`community-media`**.

### Folder Path Specification:
```
{tenant_id}/posts/{uuid}_{sanitized_filename}
```
- **Folder Prefix**: `{tenant_id}` is enforced as the top-level folder name.
- **Partition Verification**: The system verifies that `(storage.foldername(name))[1] === tenant_id`.

---

## 2. API Route Security Hardening (`/api/media/upload`)

In `app/api/media/upload/route.ts`:

1. **Authentication Enforcement**:
   - Requires `syncly_session`, `sb-access-token`, or `x-user-id`.
   - Anonymous requests return **HTTP 401 Unauthorized** (Verified via SEC-009).
2. **Tenant Partitioning Guard**:
   - Compares the caller's verified session tenant against the destination folder prefix.
   - Cross-tenant upload attempts return **HTTP 403 Forbidden** (Verified via SEC-010).
3. **MIME Type Whitelist**:
   - Permitted: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`.
   - Disallowed executable/script types (`.sh`, `.exe`, `.html`, `.js`) return **HTTP 415 Unsupported Media Type** (Verified via SEC-012).
4. **Payload Size Limit**:
   - Enforces a strict 10MB maximum file size limit (HTTP 413 on excess).
5. **Path Traversal Sanitization**:
   - `originalName.replace(/[^a-zA-Z0-9\._-]/g, '_')` eliminates directory traversal sequences (`../`, `..\\`).

---

## 3. Database-Level Storage Policies (`storage.objects`)

In `supabase/migrations/011_rls_security_hardening.sql`:

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "tenant_media_select" ON storage.objects;
    CREATE POLICY "tenant_media_select" ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'community-media' 
      AND (
        (storage.foldername(name))[1] IS NULL 
        OR public.is_tenant_member((storage.foldername(name))[1]::uuid)
      )
    );

    DROP POLICY IF EXISTS "tenant_media_insert" ON storage.objects;
    CREATE POLICY "tenant_media_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'community-media' 
      AND public.is_tenant_member((storage.foldername(name))[1]::uuid)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
```

---

## 4. Residual Risks & Production Recommendations

1. **Public Bucket Exposure**:
   - If the `community-media` bucket is configured with `public = true` in Supabase Storage, direct GET requests to `https://<project>.supabase.co/storage/v1/object/public/community-media/...` bypass Storage RLS and do not check authentication.
   - **Recommendation**: Set `public = false` for the `community-media` bucket and serve sensitive corporate attachments via short-lived signed URLs (`supabase.storage.from('community-media').createSignedUrl(path, 60)`).

