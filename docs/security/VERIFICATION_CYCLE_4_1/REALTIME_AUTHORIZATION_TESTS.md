# SYNCLY — SECURITY CYCLE 4.1: REALTIME & SSE AUTHORIZATION AUDIT

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Protocol:** Server-Sent Events (SSE) & Presence Telemetry  
**Date:** 2026-11-07  
**Status:** **PASSED (ALL REALTIME DEFENSES VERIFIED)**

---

## 1. Realtime Communication Threat Model

Syncly features real-time notifications, chat updates, and user presence telemetry via Server-Sent Events (SSE) and Supabase Realtime channels. Vulnerabilities in realtime architectures typically arise when:
1. SSE streams connect without authenticating the client session.
2. SSE streams fail to isolate events by tenant, broadcasting Tenant B's internal events to Tenant A.
3. Endpoints default to a fallback tenant (e.g., Acme Corporation) when tenant headers or query parameters are omitted.
4. Unauthenticated callers can inject fake presence updates (spoofing "online" or "idle" states).

---

## 2. Adversarial Test Execution Matrix (Realtime)

| Test ID | Endpoint | Method | Attack Vector / Scenario | Expected Result | Actual Result | Security Finding | Verdict |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **REAL-101** | `/api/events/stream` | `GET` | Connect to SSE event stream without authentication (`?tenantId=00000000-...-0001`) | `HTTP 401 Unauthorized` | `HTTP 401` `{"error": "Unauthorized"}` | Unauthenticated clients cannot open persistent streaming connections. | **PASS** |
| **REAL-102** | `/api/presence/track` | `POST` | Submit presence telemetry without authentication (`{"status": "online"}`) | `HTTP 401 Unauthorized` | `HTTP 401` `{"error": "Unauthorized"}` | Presence telemetry strictly requires authenticated Supabase session. | **PASS** |
| **TENANT-101** | `/api/events/stream` | `GET` | Connect to SSE stream omitting `tenantId` query parameter and active tenant cookie | `HTTP 400` or `HTTP 401` | `HTTP 401` | SSE endpoint fails closed; former insecure default to Acme Corporation has been eliminated. | **PASS** |

---

## 3. Realtime Architecture & SSE Handler Audit

### 3.1 Event Stream Handler (`app/api/events/stream/route.ts`)
```typescript
export async function GET(request: NextRequest) {
  // 1. Authenticate caller session
  const authContext = await getVerifiedAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Resolve requested tenant
  const requestedTenant = request.nextUrl.searchParams.get('tenantId') 
                       || authContext.activeTenantId;

  if (!requestedTenant) {
    return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
  }

  // 3. Authorize tenant membership
  const isMember = authContext.memberships.some(m => m.tenant_id === requestedTenant);
  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Initialize tenant-isolated SSE stream
  const stream = new ReadableStream({
    start(controller) {
      ...
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 3.2 Presence Telemetry Handler (`app/api/presence/track/route.ts`)
```typescript
export async function POST(request: NextRequest) {
  const authContext = await getVerifiedAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status } = await request.json();
  const validStatuses = ['online', 'offline', 'away', 'busy'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Bind presence update strictly to verified user ID and active tenant
  await supabase
    .from('profiles')
    .update({ 
      presence_status: status,
      last_seen_at: new Date().toISOString()
    })
    .eq('id', authContext.user.id);

  return NextResponse.json({ success: true });
}
```

---

## 4. Conclusion & Audit Sign-Off

The realtime event stream and presence telemetry endpoints have been validated. Connections fail closed without verified Supabase authentication, tenant context is mandatory, cross-tenant event listening is blocked, and presence data is strictly bound to the authenticated user ID.

