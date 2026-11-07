# SYNCLY — SECURITY CYCLE 4.2.4: PRE-STAGING INDEPENDENT SECURITY SIGN-OFF

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Analysis Type:** Final Static SQL Review & Bootstrap Safety Gate  
**Date:** 2026-11-07  
**Gate Decision:** **NO-GO (BLOCKED PENDING 3 MANDATORY SQL BASELINE REMEDIATIONS)**

---

## 1. Executive Summary & Gate Decision

This report represents the independent pre-staging security sign-off for Syncly. In accordance with strict static audit rules, all migration files (`010_multi_memberships.sql`, `011_rls_security_hardening.sql`, `012_membership_auth_hardening.sql`, `final_production_schema.sql`, and `src/db/migration.sql`), database trigger functions, application API endpoints, and storage policies were scrutinized with exact line-number citations.

### Sign-off Decision: **NO-GO**
Execution against a staging cluster is **blocked** until the following 3 specific security issues in the baseline scripts are formally patched:

1. **Unsafe Tenant Fallback in Auth Trigger (`final_production_schema.sql` L164–L171):** Function `handle_new_user()` assigns users without metadata to hardcoded tenant UUID `00000000-0000-0000-0000-000000000001` (Acme Corporation), permitting unauthorized tenant injection.
2. **Missing Inactive Status Check in RLS (`012_membership_auth_hardening.sql` L21–L25):** Function `is_tenant_member()` checks `profiles.tenant_id = p_tenant_id` without verifying `profiles.status = 'active'`. A suspended or deactivated user presenting a valid unexpired Supabase JWT passes database-level RLS for their home tenant.
3. **Public Storage Bucket Exposure (`src/db/migration.sql` L198 & `app/api/media/upload/route.ts` L72):** The legacy script sets `public: true` and the upload API constructs public object URLs. If created public, Supabase Storage serves assets directly without evaluating PostgreSQL RLS.

---

## 2. Table-by-Table RLS Policy Matrix

The table below records every policy across all migrations, citing exact file names and line numbers:

| Table | Command | Policy Name | Source File & Line | Status / Replacement | Permissive / Restrictive | Applicable Roles | USING / WITH CHECK Expression | Security Finding |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`memberships`** | `SELECT` | `"Users can view their own memberships"` | `010`: L33 | Active | Permissive | `public` | `USING (user_id = auth.uid())` | **SAFE:** Self-roster only. |
| **`memberships`** | `SELECT` | `"Community admins can view community members"` | `010`: L39 | Active | Permissive | `public` | `USING (EXISTS (SELECT 1 FROM memberships m WHERE m.community_id = memberships.community_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))` | **SAFE:** Admin scope only. |
| **`memberships`** | `INSERT` | `"Users can self-join communities"` | `010`: L52 | Active | Permissive | `public` | `WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = memberships.community_id AND (t.requires_approval = false OR auth.jwt()->>'email' LIKE ANY(...))))` | **SAFE:** Domain / open community join. |
| **`memberships`** | `UPDATE` | `"Admins can update memberships"` | `010`: L70 | Active | Permissive | `public` | `USING (EXISTS (SELECT 1 FROM memberships m WHERE m.community_id = memberships.community_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))` | **SAFE:** Admin role update only. |
| **`memberships`** | `DELETE` | *None* | N/A | Default Deny | N/A | All | N/A | **SAFE:** No client direct delete. Handled via admin. |
| **`tenants`** | `SELECT` | `tenant_isolation_tenants_select` | `011`: L45 | Active | Permissive | `public` | `USING (public.is_tenant_member(id) OR is_discoverable = true)` | **SAFE:** Calls `is_tenant_member`. |
| **`tenants`** | `INSERT` | `tenant_isolation_tenants_insert` | `011`: L52 | Active | Permissive | `public` | `WITH CHECK (auth.uid() IS NOT NULL)` | **SAFE:** Authenticated creation. |
| **`tenants`** | `UPDATE` | `tenant_isolation_tenants_update` | `011`: L58 | Active | Permissive | `public` | `USING (EXISTS (SELECT 1 FROM memberships WHERE community_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin')))` | **SAFE:** Owner/Admin only. |
| **`profiles`** | `SELECT` | `tenant_isolation_profiles_select` | `011`: L68 | Active | Permissive | `public` | `USING (public.is_tenant_member(tenant_id) OR id = auth.uid())` | **SAFE:** Self or co-member. |
| **`profiles`** | `INSERT` | `tenant_isolation_profiles_insert` | `011`: L74 | Active | Permissive | `public` | `WITH CHECK (id = auth.uid() AND (public.is_tenant_member(tenant_id) OR public.get_current_tenant_id() = tenant_id))` | **SAFE:** Self-profile creation only. |
| **`profiles`** | `UPDATE` | `tenant_isolation_profiles_update` | `011`: L80 | Active | Permissive | `public` | `USING (id = auth.uid())` | **SAFE:** Self-mutation only. |
| **`profiles`** | `DELETE` | `tenant_isolation_profiles_delete` | `011`: L86 | Active | Permissive | `public` | `USING (id = auth.uid() OR EXISTS (SELECT 1 FROM memberships WHERE community_id = tenant_id AND user_id = auth.uid() AND role IN ('owner', 'admin')))` | **SAFE:** Self or admin only. |
| **`channels`** | `SELECT` | `tenant_isolation_channels_select` | `011`: L96 | **REPLACED** in `012`: L44 | Permissive | `public` | `USING (public.is_tenant_member(tenant_id))` | **SAFE:** Replaced cleanly. |
| **`channels`** | `INSERT` | `tenant_isolation_channels_insert` | `011`: L102 | Active | Permissive | `public` | `WITH CHECK (public.is_tenant_member(tenant_id) AND EXISTS (SELECT 1 FROM memberships WHERE community_id = tenant_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'moderator')))` | **SAFE:** Leader creation only. |
| **`channels`** | `UPDATE` | `tenant_isolation_channels_update` | `011`: L111 | Active | Permissive | `public` | `USING (public.is_tenant_member(tenant_id) AND EXISTS (... role IN ('owner', 'admin')))` | **SAFE:** Admin only. |
| **`channels`** | `DELETE` | `tenant_isolation_channels_delete` | `011`: L120 | Active | Permissive | `public` | `USING (public.is_tenant_member(tenant_id) AND EXISTS (... role IN ('owner', 'admin')))` | **SAFE:** Admin only. |
| **`messages`** | `SELECT` | `tenant_isolation_messages_select` | `011`: L130 | **REPLACED** in `012`: L51 | Permissive | `public` | `USING (public.is_tenant_member(tenant_id))` | **SAFE:** Replaced cleanly. |
| **`messages`** | `INSERT` | `tenant_isolation_messages_insert` | `011`: L136 | **REPLACED** in `012`: L57 | Permissive | `public` | `WITH CHECK (public.is_tenant_member(tenant_id) AND user_id = auth.uid())` | **SAFE:** Replaced cleanly. |
| **`messages`** | `UPDATE` | `tenant_isolation_messages_update` | `011`: L142 | Active | Permissive | `public` | `USING (user_id = auth.uid())` | **SAFE:** Author only. |
| **`messages`** | `DELETE` | `tenant_isolation_messages_delete` | `011`: L148 | Active | Permissive | `public` | `USING (user_id = auth.uid() OR EXISTS (... role IN ('owner', 'admin', 'moderator')))` | **SAFE:** Author or leadership. |
| **`posts`** | `SELECT` | `tenant_isolation_posts_select` | `011`: L158 | **REPLACED** in `012`: L64 | Permissive | `public` | `USING (public.is_tenant_member(tenant_id))` | **SAFE:** Replaced cleanly. |
| **`posts`** | `INSERT` | `tenant_isolation_posts_insert` | `011`: L164 | **REPLACED** in `012`: L70 | Permissive | `public` | `WITH CHECK (public.is_tenant_member(tenant_id) AND author_id = auth.uid() AND NOT intern)` | **SAFE:** `012` blocks intern posts. |
| **`posts`** | `UPDATE` | `tenant_isolation_posts_update` | `011`: L175 | Active | Permissive | `public` | `USING (author_id = auth.uid())` | **SAFE:** Author only. |
| **`posts`** | `DELETE` | `tenant_isolation_posts_delete` | `011`: L181 | Active | Permissive | `public` | `USING (author_id = auth.uid() OR EXISTS (... role IN ('owner', 'admin', 'moderator')))` | **SAFE:** Author or leadership. |
| **`post_comments`** | `SELECT` | `tenant_isolation_post_comments_select` | `011`: L191 | Active | Permissive | `public` | `USING (public.is_tenant_member(tenant_id))` | **SAFE:** Calls `is_tenant_member`. |
| **`post_comments`** | `INSERT` | `tenant_isolation_post_comments_insert` | `011`: L197 | Active | Permissive | `public` | `WITH CHECK (public.is_tenant_member(tenant_id) AND author_id = auth.uid())` | **SAFE:** Calls `is_tenant_member`. |
| **`post_comments`** | `UPDATE` | `tenant_isolation_post_comments_update` | `011`: L203 | Active | Permissive | `public` | `USING (author_id = auth.uid())` | **SAFE:** Author only. |
| **`post_comments`** | `DELETE` | `tenant_isolation_post_comments_delete` | `011`: L209 | Active | Permissive | `public` | `USING (author_id = auth.uid() OR EXISTS (... role IN ('owner', 'admin', 'moderator')))` | **SAFE:** Author or leadership. |
| **`storage.objects`** | `SELECT` | `"tenant_media_select"` | `011`: L222 | **REPLACED** in `012`: L89 | Permissive | `authenticated` | `USING (bucket_id = 'community-media' AND (storage.foldername(name))[1] IS NOT NULL AND public.is_tenant_member(...))` | **SAFE:** Root `IS NULL` closed. |
| **`storage.objects`** | `INSERT` | `"tenant_media_insert"` | `011`: L232 | **REPLACED** in `012`: L99 | Permissive | `authenticated` | `WITH CHECK (bucket_id = 'community-media' AND (storage.foldername(name))[1] IS NOT NULL AND public.is_tenant_member(...))` | **SAFE:** Tenant path match enforced. |

---

## 3. Function & Privilege Matrix

| Function Name | Defined In | Language & Security | Search Path | Grant Privileges | Security Vulnerabilities & Findings |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`public.get_current_tenant_id()`** | `011`: L10–L13 | `sql STABLE` | Default | `EXECUTE TO PUBLIC` | **SAFE:** Reads `current_setting('app.current_tenant_id', true)`. Returns `NULL` when unset. Does not bypass RLS. |
| **`public.is_tenant_member(UUID)`** | `012`: L9–L40 | `sql STABLE SECURITY DEFINER` | `SET search_path = public` | `EXECUTE TO PUBLIC` | **FINDING:** Line 23 checks `profiles.tenant_id = p_tenant_id` without `AND status = 'active'`. Deactivated accounts with live JWTs pass RLS. |
| **`public.handle_new_user()`** | `final_production_schema`: L150–L218 | `plpgsql SECURITY DEFINER` | `SET search_path = public` | Trigger on `auth.users` | **VULNERABLE:** Lines 164–171 fall back to hardcoded Acme UUID (`00000000-...-0001`). Lines 174–178 auto-create tenant. Must be patched. |
| **`storage.foldername(TEXT)`** | Built-in | System | System | System | Splits string by `/`. Safe. |

---

## 4. Membership Authorization Analysis

### 4.1 Profile vs. Membership Access Vector
In `012_membership_auth_hardening.sql`:
```sql
-- Lines 20-33:
(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND tenant_id = p_tenant_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid() AND community_id = p_tenant_id
  )
)
```
- **Primary Tenant:** Derived from `profiles.tenant_id`.
- **Secondary Workspaces:** Derived from `memberships.community_id`.
- **Membership Revocation Analysis:**
  - Deleting a row from `public.memberships` immediately revokes access to secondary workspaces.
  - Revoking access to the primary workspace requires re-assigning `profiles.tenant_id` or changing `profiles.status = 'suspended'`.
  - **Identified Defect:** Because line 23 lacks `AND status = 'active'`, a suspended user continues to pass `is_tenant_member()` at the raw PostgreSQL layer until their Supabase JWT expires.

---

## 5. Route-to-Database-Client Matrix

Every API route and server client was audited to confirm client context:

| Route Path | Method | Database Client | Client Identity Context | Service-Role Used? | Pre-Query Auth Check |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/channels` | `GET` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/channels/[id]/messages` | `GET, POST` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/posts` | `GET, POST` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/profile` | `GET, PATCH` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/workspaces/switch` | `POST` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/communities/create` | `POST` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/communities/[id]/join` | `POST` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/memberships/batch-join` | `POST` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/tenant/onboarding` | `POST` | `createClient(req)` | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |
| `/api/media/upload` | `POST` | Built-in Validation | Authenticated User Session | **NO** | `getVerifiedAuthContext(req)` |

**Finding:** 100% of API routes operate under the authenticated caller's session cookies (`SUPABASE_ANON_KEY`). `SUPABASE_SERVICE_ROLE_KEY` is not imported or utilized by any runtime route.

---

## 6. Storage & Realtime Assessment

### 6.1 Supabase Storage
- **Bucket Visibility:** `community-media` must be created as `public: false`.
- **Policy Enforcement:** Migration `012` lines 89–105 enforces `(storage.foldername(name))[1] IS NOT NULL AND public.is_tenant_member(...)`.
- **Remediation Required:** `app/api/media/upload/route.ts` line 72 currently outputs a `/public/` URL (`https://supabase.internal/storage/v1/object/public/...`). In private bucket mode, client downloads must use signed URLs generated via `createSignedUrl()`.

### 6.2 Supabase Realtime
- **Publication Tables:** `public.posts` and `public.messages` (`final_production_schema.sql` L418–L426).
- **WAL Authorization:** Realtime honors PostgreSQL RLS. Non-members subscribing to foreign tenant channels receive 0 WAL replication events.

---

## 7. Bootstrap Execution Inventory & Atomic Limitations

### Can this execute in a single atomic transaction?
**NO.** The bootstrap cannot be executed as a single database transaction because:
1. `CREATE EXTENSION` statements in PostgreSQL cannot run inside certain transactional blocks or multi-tenant hosting sandboxes.
2. User identity provisioning occurs through Supabase Auth (GoTrue API), which is an HTTP-driven microservice operating outside the PostgreSQL transaction manager.

### Staging Pipeline Stages:
- **Stage 1 (SQL Transaction):** Base table DDL + column extensions + `010` + `011` + `012`.
- **Stage 2 (Storage Admin):** Bucket creation (`public = false`) and policy validation.
- **Stage 3 (Auth Admin API):** Synthetic test accounts creation (`user-a`, `user-b`, `user-c`, `intern`).

---

## 8. Exact Mandatory Patches Required for Staging Approval

Before running migrations on staging, apply these 3 exact fixes:

### Patch 1: Update `handle_new_user()` in baseline script
```sql
-- Remove hardcoded fallback to Acme Corporation (00000000-0000-0000-0000-000000000001)
-- Require metadata->>'tenant_id'. If null, raise exception or do not assign tenant.
```

### Patch 2: Add `status = 'active'` to `is_tenant_member()`
```sql
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND tenant_id = p_tenant_id AND status = 'active'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = auth.uid() AND community_id = p_tenant_id
      )
    )
    AND (
      NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
      OR (NULLIF(current_setting('app.current_tenant_id', true), '')::uuid = p_tenant_id)
    )
  );
$$;
```

### Patch 3: Configure `community-media` Storage Bucket as Private
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;
```

---

## 9. Final Decision: **NO-GO**

In accordance with the directive's strict decision rule (*"Return NO-GO if any authorization bypass, unsafe function privilege, incomplete schema dependency, service-role misuse or unresolved tenant-isolation issue remains"*):

The decision is **NO-GO** until Patches 1, 2, and 3 are integrated into the bootstrap definition and staging credentials are provided.

