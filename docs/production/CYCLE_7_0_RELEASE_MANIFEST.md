# Syncly Release v0.1.0 — Release Manifest

**Date:** 2026-11-09  
**Release Tag:** `v0.1.0`  
**Release Candidate Branch:** `release/v0.1.0-rc1`  
**Target Production Branch:** `main`  
**Production URL:** https://syncly-app.vercel.app  
**Hosting Provider:** Vercel  
**Database Provider:** Supabase PostgreSQL  

---

## 1. Exact Release Commit Identification

| Property | Value |
| :--- | :--- |
| **Branch** | `release/v0.1.0-rc1` |
| **HEAD Commit Hash** | `0c80a6dcb5409e1a6c8e4dbac58ecb27b4e261e4` |
| **Short Hash** | `0c80a6d` |
| **Commit Message** | `docs(release): Cycle 6.6 staging migration report, live test harness, and operator execution instructions` |
| **Author** | Swastik Das |
| **Base Commit on Main** | `987ffab8addab2afe56b3c8945e038804c4d1bef` |
| **Commits Ahead of Main** | 6 commits |
| **Tree Cleanliness** | Verified (0 uncommitted modifications to tracked files) |

---

## 2. Commit Lineage from Main

The following 6 commits represent the exact functional and security enhancements included in this release candidate beyond `main`:

```
0c80a6d docs(release): Cycle 6.6 staging migration report, live test harness, and operator execution instructions
029e9f6 fix(reactions): eliminate non-durable reaction fallback, enforce 503 fail-closed, and update test classifications
eebcd9c feat(release): Syncly Cycle 6.5 - durable post_reactions schema, concurrency verification, and production parity audit
c2dd88f feat(release): Syncly Cycle 6.4 - final release sign-off, atomic RPC fallback elimination, and feature classification
0fff046 feat(release): Syncly Cycle 6.3 - final release acceptance, missing workflow completion, and verified test ledger
e86f611 feat(release-candidate): Syncly Cycle 6.2 - functional completion, verified browser tests, and release candidate v0.1.0-rc1
```

---

## 3. Build & Quality Verification Ledger

| Verification Step | Command | Result | Details |
| :--- | :--- | :---: | :--- |
| **Static Typecheck** | `npm run typecheck` | **PASSED** | 0 TypeScript errors across entire application |
| **Automated Test Suite** | `npm test` | **PASSED** | 101 / 101 assertions passing (30 workspace + 44 join requests + 27 reaction contracts) |
| **Production Build** | `npm run build` | **PASSED** | 34 / 34 Next.js routes compiled & statically optimized via Turbopack |
| **Secret Scan** | Git diff & tracked source audit | **PASSED** | Zero credentials or live tokens committed; service-role keys isolated server-side |

---

## 4. Product Release Scope (v0.1.0)

### 4.1 Core Fully Verified Features
- **Multi-Tenant Authentication**: Sign up, email confirmation, sign in, logout, session persistence across page refreshes.
- **Tenant Isolation**: Strict PostgreSQL RLS enforcing complete cross-tenant boundary isolation across posts, channels, memberships, and join requests.
- **Feed & Reactions**: Post creation, author post editing, author post deletion, durable like/unlike toggle via atomic RPC, concurrent reaction counting, and cross-tenant reaction isolation.
- **Workspaces & Communities**: Explore workspaces, atomic workspace creation (`create_workspace` RPC) with owner role assignment and audit logging, workspace switching.
- **Join Request Workflow**: Requesting membership, reviewing join requests (approve/reject), role protection.
- **Direct & Channel Messaging (Chat)**: Sending messages, receiving messages, sender verification, tenant-scoped channel listings.
- **User Profiles**: View profile, edit profile name and bio, deterministic avatar selection.

### 4.2 Documented Upcoming / Deferred Features
- **Persistent Events CRUD & RSVP**: Calendar UI present; full persistent CRUD deferred to v0.2.0.
- **Real-time Push Notifications**: Notification center UI present; background web push workers deferred to v0.2.0.
- **Custom Avatar File Upload**: Gravatar and DiceBear identity avatar generation operational; direct binary file upload to Supabase Storage bucket pending production bucket policy verification.

---

## 5. Sign-Off Verdict

**Status:** `RELEASE CANDIDATE FROZEN & VERIFIED`  
**Ready for Phase 2 (Production Database Preparation) and Operator Approval.**
