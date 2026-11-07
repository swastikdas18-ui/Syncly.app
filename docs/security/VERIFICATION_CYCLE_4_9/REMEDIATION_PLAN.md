# SYNCLY — CYCLE 4.9 SECURITY REMEDIATION PLAN

**Target Project:** Staging (`cgxvhdziefkseqhguedm`)  
**Application Stack:** Next.js 16.4.5, Supabase Auth, PostgreSQL 15, `@supabase/ssr`

---

## 1. Summary of Identified Findings

| ID | Severity | Area | Description | Target Remediation |
|---|---|---|---|---|
| **SEC-49-01** | **Medium** | HTTP Security Headers | Missing strict CSP, HSTS, and X-Content-Type-Options headers in `next.config.ts`. | Add `headers()` async configuration in `next.config.ts`. |
| **SEC-49-02** | **Medium** | Legacy Auth Mock Route | `app/api/auth/login/route.ts` is an obsolete development mock route. | Deprecate and replace with redirect or native Supabase Auth call. |
| **SEC-49-03** | **Low** | CORS and CSRF Defense | State-changing API routes rely on SameSite cookie behavior without an explicit custom Origin-checking header. | Add strict `Origin` header verification in Edge Middleware for mutating methods (`POST`, `PATCH`, `DELETE`). |
| **SEC-49-04** | **Low** | Audit Logging Persistence | Security events (join requests, suspensions, role changes) log to stdout instead of a dedicated append-only `security_audit_logs` table. | Introduce migration for `security_audit_logs` with RLS allowing only server-role writes. |
| **SEC-49-05** | **Informational** | Input Validation Schemas | Input validation is implemented via manual checks rather than unified Zod schemas. | Standardize request body validation using Zod schemas across route handlers. |

---

## 2. Detailed Remediation Actions

### 2.1 Action 1: Implement HTTP Security Headers (SEC-49-01)
Update `next.config.ts` to include standard security headers:
- `Content-Security-Policy`:
  `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://cgxvhdziefkseqhguedm.supabase.co wss://cgxvhdziefkseqhguedm.supabase.co; frame-ancestors 'none';`
- `X-Frame-Options`: `DENY`
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`

### 2.2 Action 2: Edge Origin CSRF Defense (SEC-49-03)
In `middleware.ts`:
- Validate that for mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`), if an `Origin` or `Referer` header is present, it matches the application host (`syncly.app`, `localhost:3000`, etc.).
- Reject mismatched cross-origin mutations with `HTTP 403 Forbidden`.

### 2.3 Action 3: Deprecation of Legacy Mock Route (SEC-49-02)
- Update `app/api/auth/login/route.ts` to reject mock login requests with `HTTP 410 Gone` or delegate directly to `supabase.auth.signInWithPassword`.

### 2.4 Action 4: Centralized Audit Logging Architecture (SEC-49-04)
- Create table `public.audit_logs`:
  ```sql
  CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id UUID REFERENCES public.tenants(id),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
  );
  ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
  -- Only tenant owners and admins may view audit logs for their tenant
  CREATE POLICY audit_logs_tenant_admin ON public.audit_logs
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.memberships
        WHERE community_id = audit_logs.tenant_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    );
  ```

