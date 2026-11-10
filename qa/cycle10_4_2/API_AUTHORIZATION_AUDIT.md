# API Authorization Surface Audit — Syncly Cycle 10.4.2

## Overview

A comprehensive audit of all API endpoints across Syncly was conducted to ensure that:
1. Every endpoint returning or modifying tenant-specific data independently verifies cryptographic authentication and database membership.
2. Edge middleware is not relied upon as the sole authorization boundary.
3. Every route enforces fail-closed error handling (HTTP 503 on database query failure, 401 on missing session, 403 on unauthorized tenant, 400 on malformed input).

---

## Endpoint Authorization Audit Matrix

| Route Endpoint | Method | Identity Authority | Membership Authority | Fail-Closed DB Error | Malformed Header (400) | Cross-Tenant Denied (403) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/notifications` | GET | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/posts` | GET, POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/posts/[postId]` | PATCH, DELETE | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/posts/[postId]/comments` | POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/posts/[postId]/like` | POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/channels` | GET, POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/channels/[channelId]/messages` | GET, POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/events` | GET, POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/events/stream` | GET | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/media/upload` | POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/media/download` | GET | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/tenant/members` | GET | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/communities/[id]/requests` | GET | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/communities/[id]/requests/[requestId]/review` | POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/workspaces/switch` | POST | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | HTTP 403 |
| `/api/profile` | GET, PATCH | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | N/A (Self) |
| `/api/memberships` | GET | `getVerifiedAuthContext` | `public.memberships` | HTTP 503 | HTTP 400 | N/A (Own) |
