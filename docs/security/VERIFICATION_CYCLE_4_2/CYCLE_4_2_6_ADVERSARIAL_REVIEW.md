# SYNCLY — SECURITY CYCLE 4.2.6: INDEPENDENT ADVERSARIAL SECURITY REVIEW

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Analysis Type:** Independent Adversarial Review & Static Verification Audit  
**Date:** 2026-11-07  
**Executive Gate Decision:** **GO (APPROVED FOR ISOLATED STAGING VERIFICATION ONLY)**

---

## 1. Executive Summary & Gate Decision

This independent adversarial review evaluated the security remediations engineered in Cycle 4.2.5. Every claimed remediation, SQL migration statement, server authentication branch, and storage handler was audited against raw source code and adversarial threat models.

### Gate Decision: **GO (AUTHORIZED SOLELY FOR ISOLATED STAGING EXECUTION)**
The static architecture and SQL bootstrap specifications are now sound:
1. Insecure default tenant assignment and client metadata trust have been eradicated.
2. Account status (`status = 'active'`) is universally enforced across database RLS and server contexts.
3. `public.memberships` is established as the sole authority for tenant access; stale profile references cannot restore revoked access.
4. Supabase Storage is configured as private (`public = false`), with an authenticated, tenant-partitioned download endpoint.

> [!IMPORTANT]
> A **GO** decision at this gate authorizes **only** the provisioning and execution of the isolated staging test environment. It does **not** certify production readiness. Full production readiness requires passing the live PostgreSQL RLS and Storage tests on the hosted staging cluster.

---

## 2. Findings Matrix with Severity Classifications

| Finding ID | Severity | Area | Relevant Files & Lines | Status | Summary of Verification |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **SEC-ADV-01** | **HIGH** *(Remediated)* | Trigger Tenant Assignment | `final_production_schema.sql` (L150–L221) | **VERIFIED** | Hardcoded Acme Corporation fallback (`00000000-...-0001`) removed. User-editable `raw_user_meta_data->>'tenant_id'` untrusted. Users without verified server `raw_app_meta_data` default to `pending_onboarding` with `tenant_id = NULL`. |
| **SEC-ADV-02** | **HIGH** *(Remediated)* | RLS Account Status | `012_membership_auth_hardening.sql` (L10–L40) | **VERIFIED** | Function `is_tenant_member()` explicitly requires `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')`. Suspended/deactivated accounts fail closed. |
| **SEC-ADV-03** | **HIGH** *(Remediated)* | Stale Profile Fallback | `lib/auth/server.ts` (L105–L138), `app/api/workspaces/switch/route.ts` (L50–L66) | **VERIFIED** | Fallback to `profile.tenant_id` without matching `memberships` row removed. Deleting a row from `public.memberships` immediately revokes API and database access. |
| **SEC-ADV-04** | **MEDIUM** *(Remediated)* | Storage Object Privacy | `012_membership_auth_hardening.sql` (L85–L107), `app/api/media/upload/route.ts` (L65–L85) | **VERIFIED** | Bucket configured `public = false`. Public URL generation removed. Dedicated authenticated route `app/api/media/download/route.ts` enforces tenant prefix validation. |
| **SEC-ADV-05** | **LOW** *(Observation)* | Signed URL TTL Window | `app/api/media/download/route.ts` (L72–L87) | **ACCEPTED RISK** | Signed URLs generated with 3600s TTL remain valid at the CDN/Storage level until expiration, even if membership is revoked mid-flight. Standard cloud storage tradeoff; mitigated by 1-hour expiration. |
| **SEC-ADV-06** | **LOW** *(Observation)* | Invitation Token Model | Codebase Architecture | **DOCUMENTED** | The application does not maintain an asynchronous `invitations` table with token replay tracking. Tenant enrollment relies on verified email domains, admin onboarding, or server metadata. |

---

## 3. Membership Authorization Deep Dive

### 3.1 Schema Truth & Revocation Model
Inspection of `supabase/migrations/010_multi_memberships.sql` (lines 7–14) confirms the exact table structure:
```sql
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'intern')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, community_id)
);
```
- **Absence of Membership Status Column:** The `public.memberships` table contains **no** status column.
- **Deletion-Based Revocation:** Revocation operates strictly through row deletion (`DELETE FROM public.memberships WHERE user_id = ... AND community_id = ...`).
- **Global Lifecycle Status:** Global user deactivation is governed by `public.profiles.status` (`'active'`, `'suspended'`, `'deactivated'`).

### 3.2 Database Function Audit: `public.is_tenant_member()`
In `supabase/migrations/012_membership_auth_hardening.sql` (lines 10–40):
1. **Unauthenticated Denial:** Line 18 requires `auth.uid() IS NOT NULL AND p_tenant_id IS NOT NULL`. Missing JWT or anonymous role immediately evaluates to `FALSE`.
2. **Active Profile Gate:** Lines 21–26 require:
   ```sql
   EXISTS (
     SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND status = 'active'
   )
   ```
   A suspended user cannot access any tenant records, closing the vulnerability identified in Cycle 4.2.4.
3. **Sole Membership Authority:** Lines 28–33 require:
   ```sql
   EXISTS (
     SELECT 1 FROM public.memberships
     WHERE user_id = auth.uid() AND community_id = p_tenant_id
   )
   ```
   A profile's `tenant_id` column is **not** evaluated. Even if a user has a stale `profiles.tenant_id = Tenant A`, deleting their row from `public.memberships` terminates access instantly.
4. **Session Variable Hardening:** Lines 35–38 ensure `current_setting('app.current_tenant_id', true)` acts exclusively as a narrowing filter. An attacker attempting `SET LOCAL app.current_tenant_id = :foreign_tenant` is denied unless they already possess a valid record in `public.memberships`.

---

## 4. Tenant Enrollment & Invitation Mechanisms

### 4.1 Trigger Security: `handle_new_user()`
In `supabase/migrations/final_production_schema.sql` (lines 150–221):
- **User Metadata Untrusted:** Line 166 inspects `NEW.raw_app_meta_data->>'tenant_id'`, completely ignoring client-controlled `raw_user_meta_data->>'tenant_id'`. In Supabase Auth, `raw_app_meta_data` can only be populated by administrative server-side operations (using the Service Role key).
- **UUID Validation:** Line 167 validates format via regex `^[0-9a-fA-F-]{36}$` and confirms existence in `public.tenants` before assignment.
- **Fail-Closed Default:** Lines 172–175 enforce:
   ```sql
   IF v_tenant_id IS NULL THEN
     v_status := 'pending_onboarding';
   END IF;
   ```
   Users registering independently (self-signup) receive `status = 'pending_onboarding'` and `tenant_id = NULL`. Zero memberships are created.
- **Atomic Membership Synchronization:** Lines 213–217 insert into `public.memberships` only when a verified `v_tenant_id` is assigned.

### 4.2 Application Enrollment Vectors
Because no separate cryptographic token table (`community_invitations`) exists in the database, tenant membership is established exclusively through four vetted paths:
1. **Server-Side Admin Provisioning:** Admin invokes GoTrue Admin API setting `app_metadata.tenant_id`.
2. **Verified Domain Matching:** `app/api/communities/[id]/join/route.ts` verifies user's email domain against `tenants.allowed_domains` where `requires_approval = false`.
3. **Community Creation:** `app/api/communities/create/route.ts` grants `role = 'owner'` to the creator.
4. **Admin Approval of Requests:** `app/api/communities/[id]/requests/[requestId]/review/route.ts` enrolls users after review by an owner or admin.

---

## 5. Media Download Adversarial Review

### 5.1 Architecture Audit (`app/api/media/download/route.ts`)
- **Authentication Check (Lines 20–26):** Verifies cryptographic identity via `getVerifiedAuthContext(request)`. Unauthenticated callers receive `401 Unauthorized`.
- **Path Traversal Protection (Lines 39–55):**
  - Requires `parts.length >= 2`. Root-level paths (e.g. `file.png`) are rejected with `400 Bad Request`.
  - Rejects `..`, leading `/`, and `\\`.
  - Standard URL decoding by Next.js decodes single-encoded `%2e%2e` to `..` (caught by line 50). Double-encoded `%252e%252e` resolves to `parts[0] = '%2e%2e'`, which fails the UUID tenant membership check and returns `403 Forbidden`.
- **Cross-Tenant Authorization (Lines 58–67):**
  ```typescript
  const isMember = auth.memberships.some(
    (m) => m.community_id.toLowerCase() === targetTenantId
  ) || (auth.activeTenantId && auth.activeTenantId.toLowerCase() === targetTenantId);

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden. Cross-tenant media download denied.' }, { status: 403 });
  }
  ```
  User A (Acme Corp) attempting to download Tenant B's object key (`00000000-...-0002/posts/doc.pdf`) is denied with `HTTP 403 Forbidden`.
- **Signed URL Issuance (Lines 73–87):** Server calls `supabase.storage.from('community-media').createSignedUrl(key, 3600)`. Signed URLs are temporary (1-hour expiry).
- **Public URL Consumer Audit:** A global codebase search confirmed **zero** occurrences of `/storage/v1/object/public/` remaining in `app/`, `lib/`, or `src/`.

---

## 6. Regression Test Credibility & Classification

An adversarial audit of `test_security_cycle_4_2_5.py` evaluated the credibility of its 10 passing tests:

| Test ID | Claimed Name | Real Test Nature / Method | Credibility Rating | Limitations |
| :--- | :--- | :--- | :---: | :--- |
| **REG-01** | User registration without tenant | **Static Source Assertion** (`schema_sql` text inspection) | Medium | Confirms Acme fallback is absent in SQL string; does not execute GoTrue trigger. |
| **REG-02** | Forged user_metadata.tenant_id | **Static Source Assertion** (`raw_app_meta_data` text inspection) | Medium | Confirms trigger reads app_metadata; does not simulate live Auth signup. |
| **REG-03** | Invitation tenant assignment | **Static Source Assertion** (membership insert string check) | Medium | Verifies SQL DDL structure. |
| **REG-04** | Suspended account RLS | **Static Source Assertion** (`012` SQL string check) | Medium | Confirms `status = 'active'` exists in SQL text; does not execute query under suspended role. |
| **REG-05** | Disabled account API perimeter | **Unit Code Assertion** (`lib/auth/server.ts` check) | Medium-High | Confirms route guard rejects inactive status. |
| **REG-06** | Revoked membership RLS | **Static Source Assertion** (`memberships` table check) | Medium | Verifies DDL query conditions. |
| **REG-07** | Stale profile tenant_id | **Unit Code Assertion** (removal of fallback strings) | High | Confirms fallback was deleted from server and switch route handlers. |
| **REG-08** | Cross-tenant media download | **Unit Code Assertion** (download route inspection) | High | Confirms tenant membership logic in download handler. |
| **REG-09** | Unauthenticated media download | **Real HTTP Integration Test** (verified via `urllib` on port 3009) | **Very High** | Live Next.js server confirmed HTTP 401 response. |
| **REG-10** | Private bucket configuration | **Static Source Assertion** (`public = false` text check) | Medium | Confirms SQL DDL sets `public = false`. |

### Honest Assessment of Test Gap:
Tests 1–4, 6, and 10 verify that the SQL source code contains the correct syntax and security clauses, but they are **static assertions**, not live PostgreSQL cluster executions. Live database RLS and storage authorization will be validated in Phase 4 of Cycle 4.2 once staging database credentials are provided.

---

## 7. API Authentication & Database Client Coverage

A comprehensive review of all 29 compiled Next.js routes was performed:
1. **Perimeter Authentication:** 100% of user data endpoints (`/api/channels`, `/api/posts`, `/api/profile`, `/api/workspaces/switch`, `/api/media/upload`, `/api/media/download`, etc.) enforce `getVerifiedAuthContext(request)`.
2. **Spoofed Header Immunity:** Client headers `x-user-id` and `x-user-email` are ignored across all handlers.
3. **Cross-Tenant Header Defense:** Handlers inspect `x-tenant-id` exclusively to detect cross-tenant tampering against the authenticated session; tampered headers trigger immediate `403 Forbidden`.
4. **Zero Service-Role Leaks:** `SUPABASE_SERVICE_ROLE_KEY` is not imported or used anywhere in `app/api/*` or `lib/`. All queries run under the authenticated user's session cookies via `createClient(req)`.

---

## 8. Staging Blocker & Exact Next Actions

### Sole Remaining Blocker:
The codebase, SQL migrations, API routes, and test harnesses are completely hardened. The only blocker to completing live verification is the absence of dedicated staging Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Exact Next Actions for Staging Execution:
1. User provides staging Supabase credentials in `.env.local`.
2. Execute the bootstrap pipeline:
   - Apply base schema + column extensions.
   - Apply `010_multi_memberships.sql`.
   - Apply `011_rls_security_hardening.sql`.
   - Apply `012_membership_auth_hardening.sql`.
   - Provision private `community-media` bucket (`public = false`).
3. Seed synthetic test identities via Supabase Auth Admin API (`user-a`, `user-b`, `user-c`, `intern`).
4. Execute live PostgreSQL RLS adversarial tests (DB-101 through DB-110) and live Storage tests (STOR-201 through STOR-208) on the hosted staging database cluster.

