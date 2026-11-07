# VERIFICATION CYCLE 2: TENANT CONTEXT & MEMBERSHIP INTEGRITY REPORT

**System**: Syncly Enterprise Platform  
**Target Component**: Multi-Tenant Context Resolution & Membership Lifecycle  
**Files Audited**:
- `lib/tenant/context.ts`
- `middleware.ts`
- `lib/context/WorkspaceContext.tsx`
- `lib/context/AuthContext.tsx`
- `src/lib/api.ts`  
**Evaluation Status**: **CONDITIONALLY VERIFIED** (API routes guard against cross-tenant session mismatches, but client-side cookie switching lacks synchronous server-side membership validation)

---

## 1. Tenant Context Derivation Mechanism

### 1.1 Server-Side Context Extraction (`lib/tenant/context.ts`)

```typescript
export async function getTenantContext(): Promise<TenantContext> {
  try {
    const cookieStore = await cookies();
    const activeTenantCookie = cookieStore.get('active_tenant_id')?.value;
    if (activeTenantCookie && isValidUUID(activeTenantCookie)) {
      return {
        tenantId: activeTenantCookie.trim().toLowerCase(),
        source: 'cookie',
        isValid: true,
      };
    }

    const synclySession = cookieStore.get('syncly_session')?.value;
    if (synclySession) {
      try {
        const parsed = JSON.parse(decodeURIComponent(synclySession));
        const sessionTenant = parsed?.user?.tenantId || parsed?.user?.tenant_id;
        if (sessionTenant && isValidUUID(sessionTenant)) {
          return {
            tenantId: sessionTenant.trim().toLowerCase(),
            source: 'cookie',
            isValid: true,
          };
        }
      } catch {}
    }

    const headersList = await headers();
    const rawHeader = headersList.get('x-tenant-id');
    if (rawHeader && isValidUUID(rawHeader)) {
      return {
        tenantId: rawHeader.trim().toLowerCase(),
        source: 'header',
        isValid: true,
      };
    }
  } catch {}

  return {
    tenantId: DEFAULT_TENANT_ID,
    source: 'fallback',
    isValid: true,
  };
}
```

### 1.2 Edge Middleware Normalization (`middleware.ts`)
In `middleware.ts` (lines 29–38):
```typescript
const tenantId = req.headers.get('x-tenant-id') || req.cookies.get('active_tenant_id')?.value || '00000000-0000-0000-0000-000000000001';
const requestHeaders = new Headers(req.headers);
requestHeaders.set('x-tenant-id', tenantId);

const response = NextResponse.next({
  request: {
    headers: requestHeaders,
  },
});
response.headers.set('x-tenant-id', tenantId);
return response;
```

---

## 2. Adversarial Test Findings

| Test Scenario | Vector / Input | Observed Behavior | Security Status |
| :--- | :--- | :--- | :---: |
| **Authorized Workspace Switch** | User selects enrolled workspace | `active_tenant_id` cookie updated; views reload with new tenant data | **PASS** |
| **Unauthorized Workspace Switch** | Attacker manually sets `active_tenant_id` to unenrolled tenant | Context switches to unenrolled tenant at HTTP header level | **RISK** |
| **Forged `x-tenant-id` Header on API** | Session = Tenant B, Header = Tenant A | Route handlers reject request with **HTTP 403 Forbidden** | **VERIFIED PASS** |
| **Cross-Tenant Message Dispatch** | POST `/api/channels/general/messages` targeted at foreign tenant | Route handler detects mismatch and returns **HTTP 403 Forbidden** | **VERIFIED PASS** |
| **Connection-Pool Leakage** | Concurrent DB connections sharing pooled session | `buildTenantSessionSql()` generates `SET LOCAL` scoped strictly to transaction | **VERIFIED PASS** |
| **Missing Tenant Context** | Request lacks header, cookie, and session | Safely falls back to `DEFAULT_TENANT_ID` ('0000...001') | **VERIFIED PASS** |
| **NULL / Malformed Tenant Context** | Header = `"default"`, `""`, or SQL injection string | `resolveTenantId()` validates UUID via regex; invalid strings fallback to default | **VERIFIED PASS** |

---

## 3. Findings & Remaining Risks

1. **Client-Controlled Workspace Cookie**:
   - `active_tenant_id` is written directly by client-side code in `WorkspaceContext.tsx`:
     ```typescript
     document.cookie = `active_tenant_id=${tenant.id}; path=/; max-age=2592000; SameSite=Lax`;
     ```
   - While API route mutations reject actions when the session tenant does not match, read endpoints (or client components reading `useWorkspace()`) will render UI frames under the spoofed tenant ID.
2. **Remediation**:
   - Workspace switching should occur via a server-validated route (`POST /api/workspaces/switch`), which queries `public.memberships` to ensure `auth.uid()` has an active membership in the target workspace before issuing a signed context cookie.

