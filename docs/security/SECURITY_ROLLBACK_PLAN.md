# SECURITY REMEDIATION PLAN & ROLLBACK SPECIFICATION

**Project**: Syncly Corporate Platform  
**Target Areas**:
1. Server-Side Membership Verification & Context Resolution (`lib/tenant/context.ts`, `middleware.ts`).
2. Privilege Escalation Elimination (`app/api/profile/route.ts`).
3. Realtime SSE Authorization Guard (`app/api/events/stream/route.ts`).
4. Database RLS Hardening (`supabase/migrations/final_production_schema.sql`).
5. Storage Partition Policy Hardening.

---

## 1. Prioritized Remediation Roadmap

### Priority 0 (Critical - Immediate Action)
1. **Remediate Privilege Escalation in `/api/profile`**:
   - Prevent self-assigned roles (`role: 'owner'`, `role: 'admin'`). Strip `role` from the allowed self-service update fields.
2. **Harden Edge Middleware & Tenant Context Resolution**:
   - Never blindly trust client-supplied `x-tenant-id` or cookies without matching the authenticated user's active membership.
   - For demo logins, restrict demo tokens to the dedicated Acme sandbox (`00000000-0000-0000-0000-000000000001`).
3. **Secure Edge SSE Stream (`/api/events/stream`)**:
   - Verify caller session before establishing SSE stream. Reject unauthorized tenant subscriptions.

### Priority 1 (High - Immediate Action)
1. **Fix PostgreSQL RLS Policies**:
   - Remove the dangerous open-door `OR public.get_current_tenant_id() IS NULL` fallback.
   - Anchor RLS policies in trusted `public.memberships` checking `auth.uid()`.
2. **Channel Message & Media Upload IDOR Protection**:
   - Verify that caller is a member of the target channel and tenant before saving messages or files.

---

## 2. Rollback Strategy

Every remediation must follow this strict rollback protocol:
1. **Database Schema / RLS Policies**:
   - Save prior policy definitions in `docs/security/SECURITY_ROLLBACK_PLAN.md`.
   - Idempotent rollback script provided to restore previous policy states if needed.
2. **Application Code**:
   - Versioned via git commits.
   - Run quality gate tests (`npx tsc --noEmit && npm run build && python verify_syncly_qa.py`) after each remediation.

