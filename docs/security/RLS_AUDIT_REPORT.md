# POSTGRESQL & ROW-LEVEL SECURITY (RLS) AUDIT REPORT

**Project**: Syncly Corporate Platform  
**Target Schema**: Public Schema & Core Tables  
**Date**: November 2026  
**Auditor**: Principal PostgreSQL Security Specialist  

---

## 1. Executive Summary

A comprehensive line-by-line inspection of `supabase/migrations/final_production_schema.sql`, `supabase/migrations/010_multi_memberships.sql`, `supabase/migrations/999_production_cleanup.sql`, and `src/db/migration.sql` was conducted.

The current database architecture contains a **P0 Critical Isolation Flaw**: RLS policies for all primary application entities (`tenants`, `profiles`, `channels`, `messages`, `posts`, `post_comments`) contain a universal fallback `OR public.get_current_tenant_id() IS NULL`. Because direct client queries or connection poolers do not set `app.current_tenant_id` on every query, the fallback evaluates to `TRUE`, completely defeating RLS.

---

## 2. Table-by-Table Policy Inventory & Threat Assessment

### 2.1 Table: `public.tenants`
- **Columns**: `id UUID PK`, `name TEXT`, `slug TEXT UNIQUE`, `created_at TIMESTAMPTZ`.
- **Current RLS Enabled**: YES (`ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY`).
- **FORCE ROW LEVEL SECURITY**: NO (Table owners and superusers bypass RLS).
- **Existing Policies**:
  - `tenant_isolation_tenants_select`: `FOR SELECT USING (id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL)`
  - `tenant_isolation_tenants_insert`: `FOR INSERT WITH CHECK (id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL)`
  - `tenant_isolation_tenants_update`: `FOR UPDATE USING (id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL)`
- **Vulnerabilities**:
  1. `OR public.get_current_tenant_id() IS NULL` permits anonymous and unauthenticated users to enumerate all tenants in the system.
  2. Any tenant can update another tenant's metadata if the session variable is unset.
  3. No role checks on update/delete (e.g. only `owner` should be able to update tenant name or slug).

---

### 2.2 Table: `public.profiles`
- **Columns**: `id UUID PK`, `tenant_id UUID FK`, `full_name TEXT`, `avatar_url TEXT`, `role TEXT`, `status TEXT`, `created_at TIMESTAMPTZ`.
- **Existing Policies**:
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE` all use `tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL`.
- **Vulnerabilities**:
  1. **Privilege Escalation**: Users can update their own `role` column to `'owner'` or `'admin'`.
  2. **Tenant Hopping**: A user can update their `tenant_id` to another tenant's UUID because the `UPDATE` policy checks `USING` but lacks a distinct `WITH CHECK` enforcing immutable `tenant_id`.
  3. Cross-tenant user directory harvesting when context is null.

---

### 2.3 Table: `public.channels`
- **Columns**: `id TEXT`, `tenant_id UUID FK`, `name TEXT`, `description TEXT`, `is_private BOOLEAN`, `created_at TIMESTAMPTZ`, `PRIMARY KEY (tenant_id, id)`.
- **Existing Policies**:
  - Standard tenant setting check with NULL fallback.
- **Vulnerabilities**:
  1. **Private Channel Data Leak**: `is_private` channels are readable by all members of the tenant (and anyone if context is null) because policies do not join against a channel membership or invite table.
  2. Any employee or intern can delete channels (`DELETE` policy has no role check).

---

### 2.4 Table: `public.messages`
- **Columns**: `id UUID PK`, `tenant_id UUID FK`, `channel_id TEXT`, `user_id UUID FK`, `content TEXT`, `media_urls TEXT`, `created_at TIMESTAMPTZ`.
- **Foreign Keys**: `(tenant_id, channel_id) REFERENCES public.channels(tenant_id, id) ON DELETE CASCADE`.
- **Existing Policies**:
  - `tenant_isolation_messages_*` with NULL fallback.
- **Vulnerabilities**:
  1. **Identity Spoofing**: `INSERT` check does not verify `user_id = auth.uid()`. An attacker can insert messages as any other user.
  2. **Cross-Tenant Message Injection**: Attacker can insert into another tenant's channel when context is unset.
  3. **Unauthorized Message Deletion**: Any tenant member can delete another member's messages.

---

### 2.5 Table: `public.posts` & `public.post_comments`
- **Columns**:
  - `posts`: `id UUID PK`, `tenant_id UUID FK`, `author_id UUID FK`, `title TEXT`, `content TEXT`, `category TEXT`, `media_urls TEXT`, `likes_count INT4`, `comments_count INT4`.
  - `post_comments`: `id UUID PK`, `tenant_id UUID FK`, `post_id UUID FK`, `author_id UUID FK`, `content TEXT`.
- **Existing Policies**:
  - Standard tenant setting check with NULL fallback.
- **Vulnerabilities**:
  1. Cross-tenant reading of announcements and internal discussions.
  2. Lack of author ownership validation on update/delete (`author_id = auth.uid()` missing).

---

### 2.6 Table: `public.memberships`
- **Columns**: `id UUID PK`, `user_id UUID FK`, `community_id UUID FK`, `role TEXT CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'intern'))`, `joined_at TIMESTAMPTZ`.
- **Existing Policies** (from `010_multi_memberships.sql`):
  - `Users can view their own memberships`: `USING (user_id = auth.uid())`
  - `Community admins can view community members`: `USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.community_id = memberships.community_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))`
  - `Users can self-join communities`: `WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = memberships.community_id AND (t.requires_approval = false OR ...)))`
  - `Admins can update memberships`: `FOR UPDATE USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.community_id = memberships.community_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))`
- **Strengths**: This table properly leverages `auth.uid()` rather than session variable settings.
- **Deficiencies**:
  - Missing `DELETE` policy: Admins cannot remove members or users cannot leave communities cleanly.
  - Self-join with check allows role assignment if not constrained (users could pass `role: 'owner'` in the insert payload!).

---

## 3. SECURITY DEFINER Functions & Triggers

### 3.1 `public.handle_new_user()`
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
...
```
- **Audit Findings**:
  - Good: Explicit `SET search_path = public` prevents search-path hijacking attacks.
  - Vulnerability: Automatically reads `NEW.raw_user_meta_data->>'role'`. If an unauthenticated user signs up through Supabase Auth passing `{ role: 'owner' }`, the trigger assigns them the `owner` role in `public.profiles`.

---

## 4. Remediation Blueprint: True Multi-Tenant RLS Architecture

To establish verifiable, unbreakable multi-tenant isolation, policies must derive authorization directly from `auth.uid()` and the trusted `public.memberships` table, rather than relying exclusively on a mutable session setting with a dangerous `IS NULL` escape hatch.

### Proposed Production-Grade Policy Template:
```sql
-- 1. Helper Function: Check User Tenant Membership
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE community_id = p_tenant_id 
      AND user_id = auth.uid()
  );
$$;

-- 2. Helper Function: Check User Tenant Admin/Owner Role
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE community_id = p_tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  );
$$;

-- 3. Strict Messages Policy Example (Eliminating IS NULL hole)
CREATE POLICY messages_select_policy ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY messages_insert_policy ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND public.is_tenant_member(tenant_id)
  );
```

