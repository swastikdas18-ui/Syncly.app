# AUTHENTICATION & RBAC SECURITY AUDIT REPORT

**Project**: Syncly Corporate Platform  
**Scope**: Authentication, Session Management, Cookies, Role-Based Access Control (RBAC)  
**Date**: November 2026  
**Auditor**: Senior Application Security Engineer & Identity Specialist  

---

## 1. Executive Summary

This audit reviewed the client authentication lifecycle, cookie handling in Next.js Edge Middleware, role assignment mechanisms, and session synchronization across `app/(auth)/login/page.tsx`, `middleware.ts`, `lib/context/AuthContext.tsx`, and `app/api/profile/route.ts`.

Three Critical/High-severity vulnerabilities were identified:
1. **Unsigned Client Session Cookie (`syncly_session`)**: Plaintext cookie trusted unconditionally by middleware as authentication.
2. **Missing Server-Side Role Enforcement in Profile API (`/api/profile`)**: Any authenticated user can promote their profile to `'owner'` or `'admin'`.
3. **Cookie-Based Workspace Selection Without Membership Validation**: Switching active workspace sets cookies without verifying that the user is actually a member of the target tenant in PostgreSQL.

---

## 2. Cookie Security & Session Validation Analysis

### 2.1 Inventory of Cookies & Headers

| Key | Type | Set By | Read By | Security Attributes | Risk / Findings |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `syncly_session` | Cookie | Client-side JavaScript | `middleware.ts` | `path=/; max-age=86400; SameSite=Lax` (Missing `HttpOnly`, Missing `Secure`) | **CRITICAL**: Forged client sessions bypass login checks. |
| `active_tenant_id` | Cookie | Client-side JavaScript | `middleware.ts` | `path=/; max-age=86400; SameSite=Lax` | **HIGH**: Can be changed to any arbitrary tenant UUID. |
| `sb-access-token` | Cookie | Supabase Client | `middleware.ts` | Supabase defaults | Valid JWT verified against Supabase Auth secret. |
| `x-tenant-id` | Header | Injected by Middleware or client | API Routes | Injected from cookie/header | **HIGH**: Trusted by route handlers without membership cross-check. |

### 2.2 Detailed Review of Edge Middleware (`middleware.ts`)
```typescript
const synclySession = req.cookies.get('syncly_session')?.value;
const supabaseToken = req.cookies.get('sb-access-token')?.value;
const isAuthenticated = Boolean(synclySession || supabaseToken);

if (isProtectedRoute && !isAuthenticated) {
  return NextResponse.redirect(loginUrl);
}
```
- **Vulnerability**: `Boolean(synclySession || supabaseToken)` only tests for the presence of the string. An attacker executing `document.cookie = "syncly_session=1"` passes the authentication check.
- **Remediation**: Middleware must either verify the cryptographically signed JWT via Supabase Auth or use an HMAC-signed session cookie (`syncly_session`) with server-side validation.

---

## 3. Role-Based Access Control (RBAC) Matrix & Escalation Flaws

### 3.1 Role Hierarchy & Permissions Matrix

| Action | Intern | Employee | Moderator | Admin | Owner | Enforcement Point | Current Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **Read Feed & Announcements** | Yes | Yes | Yes | Yes | Yes | RLS / API | Enforced via tenant ID |
| **Publish Company Post** | No | Yes | Yes | Yes | Yes | API `/api/posts` | Client hides button; API lacks role check! |
| **Delete Any Post/Comment** | No | No | Yes | Yes | Yes | API / DB | Missing moderator check |
| **Post Chat Messages** | Yes | Yes | Yes | Yes | Yes | API | Allowed |
| **Create Channels** | No | No | Yes | Yes | Yes | API `/api/channels` | Not enforced server-side |
| **Delete Channels** | No | No | No | Yes | Yes | DB RLS | Missing; any member can delete |
| **Review Join Requests** | No | No | Yes | Yes | Yes | API `/api/communities/[id]/requests` | Not enforced server-side |
| **Manage Member Roles** | No | No | No | Yes | Yes | DB Memberships | Partially guarded |
| **Workspace Deletion** | No | No | No | No | Yes | DB Tenants | No guard in place |
| **Update Own Role** | No | No | No | No | No | API `/api/profile` | **CRITICAL FLAW**: Open PATCH allowed! |

### 3.2 Privilege Escalation in `/api/profile`
Inspection of `app/api/profile/route.ts`:
```typescript
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, fullName, headline, avatarUrl, role, email } = body;
  
  // Directly updates public.profiles with the incoming role!
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role: role, ... })
    .eq('id', id);
}
```
- **Attack Vector**: Any employee or intern can issue `PATCH /api/profile` with `{"role": "owner"}` or `{"role": "admin"}` to instantly elevate their privileges across the entire corporate workspace.
- **Remediation**: Strip `role` from the allowed self-service update fields. Roles must only be modifiable by verified workspace admins/owners through a dedicated `/api/memberships/[userId]` endpoint.

---

## 4. Demo Persona Safety & Sandbox Containment

- Demo Intern: `00000000-0000-0000-0000-000000000002`, email `intern@syncly.internal`.
- Demo Mentor: `00000000-0000-0000-0000-000000000001`, email `mentor@syncly.internal`.
- **Finding**: While demo accounts are indispensable for seamless demo and local QA evaluation, in production they must:
  1. Never possess access to live production tenant data outside the dedicated Acme Corporation sandbox (`00000000-0000-0000-0000-000000000001`).
  2. Be strictly sandboxed so that setting cookies for demo users cannot authorize queries against arbitrary tenant UUIDs.

