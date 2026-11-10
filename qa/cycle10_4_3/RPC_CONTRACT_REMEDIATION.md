# RPC Contract Remediation — Syncly Cycle 10.4.3

## 1. Executive Summary

In Migration 017 (`supabase/migrations/017_rls_recursion_remediation.sql`), PostgreSQL defines the canonical atomic join review procedure:
```sql
CREATE OR REPLACE FUNCTION public.review_join_request(
  p_request_id UUID,
  p_action TEXT
)
RETURNS JSONB
```
Permissions:
```sql
REVOKE ALL ON FUNCTION public.review_join_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_join_request(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_join_request(UUID, TEXT) TO authenticated, service_role;
```

When approving a join request, the database procedure executes the following atomically within a locked row transaction:
```sql
-- Create exactly one membership with server-controlled role 'member'
INSERT INTO public.memberships (user_id, community_id, role, joined_at)
VALUES (v_req.user_id, v_req.community_id, 'member', NOW())
RETURNING id INTO v_new_membership_id;
```

---

## 2. Identified Defect & Root Cause

The Next.js route handler in `app/api/communities/[id]/requests/[requestId]/review/route.ts` was invoking:
```typescript
await supabase.rpc('review_join_request', {
  p_request_id: requestId,
  p_action: action,
  p_assigned_role: action === 'approve' ? role : null, // UNSUPPORTED PARAMETER
});
```
This mismatched the canonical database contract by attempting to pass an invented third parameter (`p_assigned_role`). In PostgreSQL, function calls must match argument signatures exactly; passing unexpected parameters causes invocation failures.

---

## 3. Remediation Details

1. **Parameter Removal**:
   - Removed `p_assigned_role` from the RPC call in `app/api/communities/[id]/requests/[requestId]/review/route.ts`.
   - The route now passes strictly `(p_request_id, p_action)`.
2. **Server-Controlled Role Enforcement**:
   - Removed client-supplied role parameters (`body.role`).
   - Standard join approvals grant the database-mandated `'member'` role. Organization roles (`admin`, `moderator`) must be explicitly managed through separate RBAC endpoints by workspace owners.
3. **Response Status Normalization**:
   - Aligned return handling with the database function's response payload (`result.action = 'approved' | 'rejected'`).
   - Normalizes status output to `status: 'approved' | 'rejected'`.
4. **No Migration Tampering**:
   - Deployed Migration 017 remains unchanged and fully respected as the single source of truth.
