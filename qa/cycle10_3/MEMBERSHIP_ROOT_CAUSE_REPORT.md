# Cycle 10.3 — Membership Root Cause Analysis Report

## Executive Summary

During Cycle 10.2 investigation and production observation, users reported seeing **Acme Corporation** as their active/connected workspace even when they had never joined it, or when they held zero memberships in any tenant. This report documents the precise root cause identified in the database and application codebase, along with the verification that eliminated this defect.

---

## 1. Operator Account State Investigation

A read-only investigation was conducted against the production database targeting the operator account `swastikgame777@gmail.com` using `scripts/diagnose_account_state.mjs`:

```json
{
  "user_id": "002541c9-b3ea-4d34-b177-2330214ad8f2",
  "email": "swastikgame777@gmail.com",
  "profile_found": true,
  "profile_data": {
    "role": "member",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "department": null
  },
  "memberships_count": 0,
  "memberships": []
}
```

### Key Findings:
1. **Zero Active Memberships**: In `public.memberships`, the operator account had `0` records. The user was never enrolled into Acme Corporation (`00000000-0000-0000-0000-000000000001`) or Globex Corporation (`00000000-0000-0000-0000-000000000002`).
2. **Legacy `profiles.tenant_id` Column**: The `public.profiles` table contained a legacy column `tenant_id` populated with `'00000000-0000-0000-0000-000000000001'`.
3. **Application Fallback Flaw**: `lib/context/AuthContext.tsx` previously fell back to `typedProfile.tenant_id` whenever a membership record was not immediately found or when resolving initial tenant context:
   ```typescript
   // Flawed legacy code:
   const resolvedTenantId = memRecord?.community_id || typedProfile.tenant_id;
   ```
4. **Hardcoded Fallbacks in UI Pages**: Multiple pages (Feed, Channels, Events, Profile) contained fallbacks to `'00000000-0000-0000-0000-000000000001'` or `'Acme Corporation'` if `currentTenant` or `activeTenant` evaluated to null or empty.

---

## 2. Invalidation of Non-Authoritative Tenant Sources

To achieve true Multi-Tenant Truth, the single authoritative source for organization association is now:

$$\text{User} \xrightarrow{\quad} \text{Active Membership} \xrightarrow{\quad} \text{Tenant}$$

The following data sources are strictly invalidated as proof of membership:
- `profiles.tenant_id` — Legacy column, ignored for tenant authorization and workspace selection.
- `user.user_metadata.tenant_id` — User metadata, untrusted and ignored.
- `active_tenant_id` Cookie — Client-controlled cookie. Only accepted if the tenant ID matches a verified active row in `public.memberships` for that user.
- `localStorage` ('active_tenant_id') — Client cache. Treated as an unverified preference and validated against `public.memberships`.

---

## 3. Remediation Verification

- **Elimination of Fallbacks**: All hardcoded fallback UUIDs (`00000000-0000-0000-0000-000000000001`) and fallback tenant names were removed from `lib/context/AuthContext.tsx`, `lib/auth/server.ts`, `app/(dashboard)/feed/page.tsx`, `app/(dashboard)/channels/[channelId]/page.tsx`, `app/(dashboard)/events/page.tsx`, `app/(dashboard)/members/page.tsx`, and `src/components/ProfileView.tsx`.
- **Zero-Membership State**: When a user logs in with zero active memberships, `activeTenant` resolves to `null`. The user remains authenticated, but is shown a clear, friendly onboarding state rather than Acme Corporation.
