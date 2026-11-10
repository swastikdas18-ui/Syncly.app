# SECURITY REMEDIATION REPORT

## 1. Perimeter Hardening
- **HTTPS Enforcement**: In `lib/supabase/config.ts`, remote Supabase endpoints are strictly required to use HTTPS protocol. Insecure plain HTTP connections to remote hosts are rejected at boot.
- **CSRF Defense**: Edge middleware verifies `Origin` and `Host` headers on mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) to `/api/` endpoints.

## 2. Cryptographic Authentication & RBAC
- **Authoritative Identity**: Identity is verified exclusively through `supabase.auth.getUser()`. Manual JWT parsing or untrusted request headers are rejected.
- **Fail-Closed Membership Resolution**: Every request requiring a tenant context resolves candidate workspaces strictly against `public.memberships`. Unauthorized workspaces return HTTP 403 Forbidden.
- **RPC Contract Alignment**: Community join request reviews strictly adhere to the canonical 2-argument signature `review_join_request(p_request_id, p_action)`. Privileged roles are server-assigned to prevent role forgery.
- **Client Factory Protection**: Test injection hooks in `lib/supabase/server.ts` are guarded against execution in `NODE_ENV === 'production'`.
