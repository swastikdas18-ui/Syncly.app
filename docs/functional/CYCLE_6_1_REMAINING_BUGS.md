# Syncly Cycle 6.1: Remaining Bugs, Limitations & Audit Discrepancies

**Date**: November 8, 2026  
**Audience**: Engineering Leadership & Product Management

---

## 1. Investigation of `npm test` Failure

In the previous cycle, running `npm test` returned:
```
npm error Missing script: "test"
```
### Root Cause Analysis:
Inspection of `package.json` revealed:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "echo 'No linter configured'"
}
```
Syncly does not have a `"test"` script registered in `package.json`. Test automation is implemented using standalone test runner scripts:
- Python test suites under `scripts/test_*.py`
- Playwright browser test runners under `scripts/run_*.py` and `scripts/verify_*.py`

**Conclusion**: This was a configuration/script naming absence rather than an application test failure.

---

## 2. Investigation of Database Channel Baseline Discrepancy

### Observation:
- Cycle 6.0 summary reported:
  - Acme: 4 channels
  - Globex: 4 channels
- Previous Cycle 4.4 / 5.1 baseline reports recorded:
  - Acme: 5 channels (`general`, `announcements`, `engineering`, `leadership`, `random`)
  - Globex: 3 channels (`general`, `product-sync`, `design-crit`)

### Live Database Audit:
A direct administrative query against `public.channels` on staging (`https://cgxvhdziefkseqhguedm.supabase.co`) returned the following 8 rows:
1. `general` — `00000000-0000-0000-0000-000000000001` (Acme)
2. `announcements` — `00000000-0000-0000-0000-000000000001` (Acme)
3. `engineering` — `00000000-0000-0000-0000-000000000001` (Acme)
4. `leadership` — `00000000-0000-0000-0000-000000000001` (Acme)
5. `random` — `00000000-0000-0000-0000-000000000001` (Acme)
6. `general` — `00000000-0000-0000-0000-000000000002` (Globex)
7. `product-sync` — `00000000-0000-0000-0000-000000000002` (Globex)
8. `design-crit` — `00000000-0000-0000-0000-000000000002` (Globex)

### Conclusion:
- The actual staging database has **5 channels in Acme** and **3 channels in Globex**, totaling 8 channels.
- The baseline data was **never modified or corrupted**.
- The Cycle 6.0 report contained a **typographical reporting error** stating "4 Acme channels, 4 Globex channels". The actual records match the historical baseline exactly.

---

## 3. Product Limitations & Technical Debt Ledger

The following items are intentionally scoped product characteristics or technical limitations identified during the audit:

| Priority | Component | Item | Description / Architecture Status |
|---|---|---|---|
| **P2** | Feed Likes | User Reaction Table | Current likes are stored on `posts.likes_count` and toggled via `/api/posts/[postId]/like`. The current staging schema does not have a dedicated `post_reactions` table (which was omitted from early schema migrations). Reactions update live and are bound to user session state on the client, but per-user reaction histories across re-logins should be backed by a relational `post_likes (user_id, post_id)` table in a future non-frozen schema migration. |
| **P2** | Realtime | SSE vs Supabase Realtime | Server-sent events (`/api/events/stream`) maintain connection heartbeats with cryptographically verified auth tokens. When webhooks or Supabase Realtime pub/sub channels are scaled, migrating chat to direct `@supabase/supabase-js` realtime channel subscriptions will provide lower serverless latency. |
| **P3** | Notifications | Mock Alerts vs System Events | `GET /api/notifications` returns clean empty data arrays for users with no pending alerts. In-app alerts are triggered dynamically by pending join requests in `layout.tsx`. Full activity stream notifications for mentions and comments can be introduced once an activity table is deployed. |
| **P3** | Global Search | Scope Filtering | Global search at `/search` filters workspaces and default directory channels dynamically. Cross-post body search is available on the local `/feed` search bar (with keyboard shortcut `/` or `Cmd+K`). |

