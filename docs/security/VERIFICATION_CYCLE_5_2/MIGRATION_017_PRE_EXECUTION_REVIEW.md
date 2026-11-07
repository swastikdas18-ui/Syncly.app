# Migration 017 Pre-Execution Security Review (Privilege Boundary Hardening)

**Document ID:** SEC-C52-PRE-04  
**Cycle:** 5.2 — Production RLS Recursion Remediation  
**Target Environment:** Staging Database (`cgxvhdziefkseqhguedm`)  
**Target Migration File:** [`supabase/migrations/017_rls_recursion_remediation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/017_rls_recursion_remediation.sql)  
**Target Rollback File:** [`supabase/migrations/rollback_017_rls_recursion_remediation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/rollback_017_rls_recursion_remediation.sql)  
**Status:** **APPROVED FOR STAGING EXECUTION**  

---

## 1. Section 1: Privileged Role Transitions & Immutability

### 1.1 Trigger Security Architecture: `protect_membership_privileged_fields()`
A dedicated `BEFORE INSERT OR UPDATE` trigger function on `public.memberships` enforces strict privilege boundaries:

1. **Owner-Only Administrative Role Assignment:**
   - Granting `role = 'owner'` or `role = 'admin'` requires `private.is_community_owner(community_id) = TRUE`.
   - Ordinary admins cannot promote anyone to `admin` or `owner`.
2. **Demotion Protection for Administrative Accounts:**
   - Demoting or revoking existing `owner` or `admin` memberships (`OLD.role IN ('owner', 'admin')`) requires `private.is_community_owner(community_id) = TRUE`.
   - Ordinary admins cannot demote fellow admins or owners.
3. **Self-Escalation & Self-Demotion Denial:**
   - Any attempt where `NEW.user_id = auth.uid()` and `NEW.role IS DISTINCT FROM OLD.role` raises exception `42501` (`"Permission denied: Users cannot alter their own membership role"`).
4. **Primary Key & Foreign Key Immutability:**
   - Attempts to mutate `user_id` (`NEW.user_id IS DISTINCT FROM OLD.user_id`) or `community_id` (`NEW.community_id IS DISTINCT FROM OLD.community_id`) are rejected with `42501`.
5. **NULL-Safe Equality:**
   - All comparisons use `IS DISTINCT FROM` to prevent NULL-injection bypasses.
6. **Manager Role Isolation:**
   - Marcus Vance holds `role = 'manager'`. Because `manager` is excluded from `('owner', 'admin')`, `private.is_community_admin()` and `private.is_community_owner()` evaluate to `FALSE`.

---

## 2. Section 2: Trigger Identity Resolution (Fail-Closed)

### 2.1 PostgREST & Database Session Resolution
```sql
BEGIN
  v_req_role := COALESCE(
    auth.role(),
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (auth.jwt() ->> 'role'),
    NULLIF(current_setting('role', true), ''),
    session_user::text
  );
EXCEPTION WHEN OTHERS THEN
  v_req_role := 'authenticated'; -- Default to authenticated (Fail-Closed)
END;
```
- In Supabase PostgREST, client requests run with `auth.role() = 'authenticated'` or `'anon'`.
- If an exception occurs during context extraction, the trigger defaults strictly to `'authenticated'` (fail-closed), ensuring client guards cannot be bypassed by stripping JWT claims.
- Trusted internal database migrations and triggers run as `service_role` or superuser `postgres`.

---

## 3. Section 3: INSERT Privileges & Self-Join Restrictions

### 3.1 Defense-in-Depth on Membership INSERTs
Direct membership insertion is protected by both RLS policy and trigger:
1. **RLS Policy `"Users can self-join communities"`:**
   - Enforces `user_id = auth.uid()`.
   - Restricts role strictly: `role IN ('member', 'employee')`.
   - Verifies community open join eligibility: `requires_approval = false` OR email matches `allowed_domains`.
2. **Trigger Guard (`protect_membership_privileged_fields` ON INSERT):**
   - Rejects any insertion where `NEW.user_id IS DISTINCT FROM auth.uid()` (`42501`).
   - Rejects any attempt to self-assign privileged roles (`NEW.role NOT IN ('member', 'employee')`) (`42501`).
3. **Approved Join Workflow Preserved:**
   - Administrative approval runs through `public.review_join_request()`, a `SECURITY DEFINER` RPC function that runs as `postgres` and safely inserts approved member rows without client interference.

---

## 4. Section 4: Public Helper Exposure (`public.is_tenant_member`)

### 4.1 Security Audit of `public.is_tenant_member(UUID)`
- **Schema:** `public`
- **Security Mode:** `SECURITY DEFINER`
- **Search Path:** `public, pg_temp`
- **Execution Rights:** `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated, service_role;`
- **Enumeration / Probing Risk:**
  - Evaluates `auth.uid() IS NOT NULL AND status = 'active' AND EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND community_id = p_tenant_id)`.
  - It returns `TRUE` ONLY if the caller is already an enrolled active member in `p_tenant_id`. For any other tenant, it returns `FALSE`.
  - Probing arbitrary tenant IDs reveals nothing other than whether the caller themselves belongs to that tenant (which they already know). It leaks zero third-party member IDs, rosters, or tenant metadata.
  - Its presence in `public` is required because downstream RLS policies across `channels`, `messages`, `posts`, and `storage` invoke it.

---

## 5. Section 5: Migration Dependency Ordering & Rollback

1. **Ordering Invariants:**
   - Dedicated `private` schema created first.
   - New `private` helper functions created before policies reference them.
   - Policies dropped and recreated to reference `private` helpers.
   - Any legacy `public` helpers (`public.is_community_admin`, `public.is_community_intern`) dropped safely *after* dependent policies are redirected.
2. **Rollback Safety:**
   - `supabase/migrations/rollback_017_rls_recursion_remediation.sql` cleanly drops the trigger, reinstates pre-017 policies, drops `private` helpers, and removes `private` schema.

---

## 6. Section 6: Complete Policy Inventory

| Table | Command | Policy Name | Predicate |
|---|---|---|---|
| `public.memberships` | `SELECT` | `Users can view their own memberships` | `user_id = auth.uid()` |
| `public.memberships` | `SELECT` | `Community admins can view community members` | `private.is_community_admin(community_id)` |
| `public.memberships` | `INSERT` | `Users can self-join communities` | `user_id = auth.uid() AND role IN ('member', 'employee') AND ...` |
| `public.memberships` | `UPDATE` | `Admins can update memberships` | `USING (private.is_community_admin(community_id)) WITH CHECK (...)` |
| `public.posts` | `SELECT` | `tenant_isolation_posts_select` | `public.is_tenant_member(tenant_id)` |
| `public.posts` | `INSERT` | `tenant_isolation_posts_insert` | `public.is_tenant_member(tenant_id) AND author_id = auth.uid() AND NOT private.is_community_intern(tenant_id)` |
| `public.audit_logs` | `SELECT` | `audit_logs_admin_select` | `private.is_community_admin(tenant_id)` |
| `public.community_join_requests` | `SELECT` | `Admins can view community join requests` | `private.is_community_admin(community_id)` |

---

## 7. Section 7: Final Review Verdict

| Section | Description | Verdict |
|---|---|---|
| **Section 1** | Privileged role transitions, demotion defense, self-escalation block | **PASS** |
| **Section 2** | Fail-closed trigger identity resolution | **PASS** |
| **Section 3** | INSERT privilege controls & self-join boundary | **PASS** |
| **Section 4** | Public helper `is_tenant_member` exposure & privacy analysis | **PASS** |
| **Section 5** | Dependency ordering, safe cleanups, and rollback readiness | **PASS** |

### Final Review Verdict:
**APPROVED FOR STAGING EXECUTION**
