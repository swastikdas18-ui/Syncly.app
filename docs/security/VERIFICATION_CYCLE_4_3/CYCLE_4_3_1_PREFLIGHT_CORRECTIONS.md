# SYNCLY — SECURITY CYCLE 4.3.1: STAGING PREFLIGHT VERIFICATION & MIGRATION GATE REPORT

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Execution Phase:** Preflight Verification & Live Read-Only Cluster Inspection  
**Date:** 2026-11-07  
**Gate Decision:** **PREFLIGHT PASS — MIGRATION APPROVAL GATE REACHED**  
*(SQL execution and migrations remain blocked pending explicit operator approval)*

---

## 1. Executive Summary & Verification Findings

The operator provided the staging configuration in `.env`. A secure, read-only preflight audit was executed immediately without printing secret values or executing any schema modifications.

### Status Scoreboard
| Verification Item | Result | Evidence / Details |
| :--- | :---: | :--- |
| **Git Hygiene** | **PASS** | `.env` and `.env.local` are untracked and verified ignored by Git (`git check-ignore`). |
| **`NEXT_PUBLIC_SUPABASE_URL`** | **CONFIGURED** | Valid HTTPS URL pointing to dedicated staging reference: `cgxvhdziefkseqhguedm`. |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | **CONFIGURED** | Non-empty cryptographic JWT (208 chars). |
| **`SUPABASE_SERVICE_ROLE_KEY`** | **CONFIGURED** | Non-empty cryptographic JWT (219 chars), restricted to backend provisioning. |
| **Production Isolation** | **PASS** | Project reference does not match production; contains no production keywords. |
| **Auth Service Connectivity** | **PASS** | HTTP 200 on `/auth/v1/settings` (`mailer_autoconfirm: False`). |
| **PostgREST Connectivity** | **PASS** | HTTP 200 on `/rest/v1/` schema endpoint. |
| **Storage API Connectivity** | **PASS** | HTTP 200 on `/storage/v1/bucket`. |

---

## 2. Actual Live Staging Database Inspection (Read-Only)

Using PostgREST and Storage API introspection, the current baseline state of the staging database was mapped:

### A. Existing Relational Tables & Columns
* **`tenants`** (2 rows): Columns: `['id', 'name', 'slug', 'created_at']`.  
  *Finding:* Missing multi-membership columns (`tagline`, `industry`, `requires_approval`, `allowed_domains`, `is_discoverable`, `search_vector`). Migration `010` cannot run without adding these columns first.
* **`profiles`** (4 rows): Columns: `['id', 'tenant_id', 'full_name', 'avatar_url', 'role', 'status', 'created_at']`.
* **`channels`** (8 rows): Columns: `['id', 'tenant_id', 'name', 'description', 'is_private', 'created_at']`.
* **`messages`** (0 rows).
* **`posts`** (0 rows).
* **`post_comments`** (0 rows).
* **`memberships`**: **DOES NOT EXIST** (`HTTP 404 Not Found`). Confirms migration `010` has never been executed on this staging project.

### B. Pre-Existing Data in Staging
* **Tenants (2):**
  1. `00000000-0000-0000-0000-000000000001` (Acme Corporation, `acme-corp`)
  2. `00000000-0000-0000-0000-000000000002` (Globex Technologies, `globex-tech`)
* **Profiles (4):**
  1. Elena Rostova (`11111111-...`, Admin, Acme)
  2. Marcus Vance (`22222222-...`, Manager, Acme)
  3. Devon Thorne (`33333333-...`, Admin, Globex)
  4. Maya Lin (`44444444-...`, Employee, Globex)

> [!IMPORTANT]
> **Isolation Confirmation**: This live inspection proves why using fresh, dynamic UUID fixtures in Cycle 4.3.1 was mandatory. If tests had reused or deleted `00000000-0000-0000-0000-000000000001`, they would have collided with and corrupted this pre-existing staging data. The whitelist teardown manifest guarantees these 4 profiles and 2 baseline tenants will remain untouched.

### C. Live Storage Bucket Configuration
* **Bucket `community-media`**: Discovered existing bucket.
* **Current Public Status:** **`public: True`** (CRITICAL SECURITY FINDING SEC-CRIT-01).  
  *Remediation Plan:* Migration `012` Checkpoint 5 will patch this bucket to `public: False` and attach strict RLS download/upload policies.

---

## 3. Dynamic Staging Fixture Manifest

The following dynamic fixtures will be provisioned during the test execution phase:

```json
{
  "manifest_version": "4.3.1",
  "staging_project_ref": "cgxvhdziefkseqhguedm",
  "tenants": {
    "tenant_a": {
      "id": "9d4dfa59-7a8a-4987-a0d7-8507511e2b38",
      "name": "Enterprise Alpha Corp",
      "slug": "enterprise-alpha",
      "requires_approval": false,
      "allowed_domains": ["alphacorp.com"]
    },
    "tenant_b": {
      "id": "27e6b66b-ef4f-4388-a6fe-2f3f6d496b44",
      "name": "Enterprise Beta Dynamics",
      "slug": "enterprise-beta",
      "requires_approval": true,
      "allowed_domains": ["betadynamics.com"]
    }
  },
  "channels": {
    "channel_a_general": "508ae33b-741b-45f8-a7a4-a094ef3c974f",
    "channel_b_general": "7b79ab2e-30cc-4249-aa46-0bb30cee4d79"
  },
  "users": {
    "user_a_admin": "e911d923-4564-485a-9e17-724b16f3ac0d",
    "user_b_employee": "5aa65c28-e735-4d88-b5e4-d4a786512c82",
    "user_c_dual": "aa0e809c-1887-4bb1-9a0a-d0b8c8193c1e",
    "user_intern_a": "0beb23b1-77e1-4a6a-88f2-3aa853a72339",
    "user_pending": "7eef5f8d-222e-4ecf-9226-caec8ff56d9f",
    "user_suspended": "4bc1f3b7-853f-4f7b-b721-7979eefcaf35",
    "user_revoked": "27e523ca-4201-46ba-8bbd-09ecd3a4e0b3",
    "user_unverified": "830dd70e-cb37-452c-93b2-a0415264a945"
  }
}
```

---

## 4. Staged Migration Sequence & Execution Plan

Before executing migrations on this staging database, the following sequential execution order must be observed:

```
[Step 1] Baseline Prerequisite Patch:
         ALTER TABLE public.tenants 
           ADD COLUMN IF NOT EXISTS tagline TEXT,
           ADD COLUMN IF NOT EXISTS industry TEXT,
           ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
           ADD COLUMN IF NOT EXISTS allowed_domains TEXT[] DEFAULT '{}',
           ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT TRUE;

[Step 2] Apply Migration 010 (010_multi_memberships.sql):
         - Creates public.memberships table with unique constraint.
         - Adds generated column search_vector and GIN index.
         - Applies membership RLS policies 1-4.

[Step 3] Apply Migration 011 (011_rls_security_hardening.sql):
         - Hardens get_current_tenant_id().
         - Eradicates all null-bypass permissive policies.
         - Establishes tenant isolation on all core tables.

[Step 4] Apply Migration 012 (012_membership_auth_hardening.sql):
         - Re-anchors is_tenant_member() to enforce profiles.status = 'active' and public.memberships.
         - Hardens storage bucket community-media to public = false.
         - Attaches tenant prefix RLS on storage.objects.

[Step 5] Execute Test Harness:
         - Provisions synthetic test users and tenants via Fixture Manifest.
         - Runs all 17 authorization, Realtime, and signed URL test cases.
         - Runs strict whitelist teardown.
```

---

## 5. Execution Approval Gate

### Current Gate Status: **READY FOR OPERATOR AUTHORIZATION**
All preflight verifications have passed:
1. Environment variables and staging project reference verified.
2. Production isolation guaranteed.
3. Live schema deficiencies diagnosed and resolved in the migration sequence.
4. Fixture manifest ready with dynamic UUIDs.

**Rule Check:** In accordance with the execution protocol ("Do not execute migrations yet"), database migrations will NOT be executed until explicit confirmation is provided by the user.
