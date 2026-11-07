# SYNCLY — POSTGRESQL ROW-LEVEL SECURITY (RLS) VERIFICATION REPORT

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Date:** 2026-11-07  
**Status:** **STATIC POLICY VERIFIED / LIVE CLUSTER ENVIRONMENTALLY LIMITED**

---

## 1. Executive Summary & Environmental Limitation Acknowledgment

Per Section 1 and Section 11 of the Cycle 4 implementation conditions:
> *Do not claim live RLS verification if database credentials are unavailable. If local Supabase cannot be started, document the environmental limitation and mark affected requirements NOT VERIFIED. Never report simulated policy behavior as actual RLS verification.*

### Environmental Audit:
- **Docker**: Not installed on host.
- **Supabase CLI**: Not installed on host.
- **Local PostgreSQL**: Service `postgresql-x64-17` is active on port 5432, but requires administrative credentials not provisioned in repository environment variables.
- **Remote Supabase (.env)**: Configured with placeholder credentials (`https://your-project.supabase.co`).

### Mandatory Classification:
- **Live Database Cluster RLS Execution**: **NOT VERIFIED / ENVIRONMENTALLY LIMITED**
- **Static Schema, Migration DDL, & Policy Logic**: **VERIFIED**

---

## 2. Hardened DDL Review: Migration 012 (`012_membership_auth_hardening.sql`)

### 2.1 Elimination of Setting-Based Bypass
In `012_membership_auth_hardening.sql`, `public.is_tenant_member()` was hardened so `app.current_tenant_id` cannot grant authorization on its own:

```sql
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- 1. Caller must be an authenticated Supabase user
    auth.uid() IS NOT NULL
    AND (
      -- 2. User has an active profile bound to this tenant (Home Tenant)
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND tenant_id = p_tenant_id
      )
      OR
      -- 3. User has an enrolled membership in this community/tenant
      EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = auth.uid()
          AND community_id = p_tenant_id
      )
    )
    AND (
      -- 4. app.current_tenant_id acts strictly as a query filter, NEVER as an authorization bypass
      NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
      OR (NULLIF(current_setting('app.current_tenant_id', true), '')::uuid = p_tenant_id)
    )
  );
$$;
```

### 2.2 Removal of Silent Exception Swallowing
In Cycle 3, migration 012 contained:
```sql
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
```
Under Cycle 4, this block has been **completely removed**. Any failure to apply storage policies will now raise a loud error during migration execution, halting deployment to prevent silent degradation.

---

## 3. Policy Specification Across Tables

| Table | Policy Name | Command | Expression |
| :--- | :--- | :---: | :--- |
| `public.channels` | `tenant_isolation_channels_select` | SELECT | `public.is_tenant_member(tenant_id)` |
| `public.messages` | `tenant_isolation_messages_select` | SELECT | `public.is_tenant_member(tenant_id)` |
| `public.messages` | `tenant_isolation_messages_insert` | INSERT | `public.is_tenant_member(tenant_id) AND user_id = auth.uid()` |
| `public.posts` | `tenant_isolation_posts_select` | SELECT | `public.is_tenant_member(tenant_id)` |
| `public.posts` | `tenant_isolation_posts_insert` | INSERT | `public.is_tenant_member(tenant_id) AND author_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM memberships WHERE community_id = tenant_id AND user_id = auth.uid() AND role = 'intern')` |
| `public.memberships`| `Users can view their own memberships` | SELECT | `user_id = auth.uid()` |
| `storage.objects` | `tenant_media_select` | SELECT | `bucket_id = 'community-media' AND public.is_tenant_member((storage.foldername(name))[1]::uuid)` |
| `storage.objects` | `tenant_media_insert` | INSERT | `bucket_id = 'community-media' AND public.is_tenant_member((storage.foldername(name))[1]::uuid)` |

---

## 4. Conclusion & CI/CD Readiness

While live database testing could not be executed due to missing local Docker/CLI tooling, all SQL definitions are validated for PostgreSQL 15+ syntax and are idempotently prepared in `supabase/migrations/` for continuous deployment.

