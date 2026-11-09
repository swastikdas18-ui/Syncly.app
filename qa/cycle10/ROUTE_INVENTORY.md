# Syncly Cycle 10.0 — Route Inventory

**Date:** 2026-11-09  
**Branch:** `fix/cycle-10-global-navigation`  

---

## 1. Complete Route Inventory

### Authenticated Dashboard Routes (`app/(dashboard)/*`)
- `/feed` -> `FeedDashboardPage` (`app/(dashboard)/feed/page.tsx`): Organization updates, rich media posts, comments, reactions.
- `/chat` -> `ChatRedirectPage` (`app/(dashboard)/chat/page.tsx`): Redirects to active workspace channel (`/channels/general`).
- `/channels/[channelId]` -> `ChannelPage` (`app/(dashboard)/channels/[channelId]/page.tsx`): Realtime corporate messaging channel with presence and history.
- `/events` -> `EventsDashboardPage` (`app/(dashboard)/events/page.tsx`): Workspace events, calendar agenda, and RSVP actions.
- `/communities/explore` -> `ExploreCommunitiesPage` (`app/(dashboard)/communities/explore/page.tsx`): Workspace discovery, directory, and instant switching.
- `/communities/new` -> `NewCommunityPage` (`app/(dashboard)/communities/new/page.tsx`): Atomic workspace creation form.
- `/members` -> `MembersPage` (`app/(dashboard)/members/page.tsx`): Enterprise member directory with roles, departments, and search.
- `/notifications` -> `NotificationsPage` (`app/(dashboard)/notifications/page.tsx`): Enterprise workspace alerts, invitations, and approvals.
- `/search` -> `GlobalSearchPage` (`app/(dashboard)/search/page.tsx`): Universal search filter across workspaces, channels, and events.
- `/profile` -> `ProfileDashboardPage` (`app/(dashboard)/profile/page.tsx`): User profile, avatar management, and session control.

### Public & Authentication Routes (`app/(auth)/*`)
- `/` -> `RootPage` (`app/page.tsx`): Landing entrypoint with session evaluation.
- `/login` -> `LoginPage` (`app/(auth)/login/page.tsx`): Corporate email and password authentication.
- `/register` -> `RegisterPage` (`app/(auth)/register/page.tsx`): New corporate user registration.
- `/signup` -> `SignupPage` (`app/(auth)/signup/page.tsx`): Workspace signup portal.
- `/onboarding` -> `OnboardingPage` (`app/(auth)/onboarding/page.tsx`): Post-registration wizard for profile setup.
- `/verify-email` -> `VerifyEmailPage` (`app/(auth)/verify-email/page.tsx`): Email confirmation landing page.

---

## 2. API Endpoints Summary
- `GET /api/memberships` -> User's joined workspaces
- `GET /api/channels` -> Workspace channels
- `GET /api/posts` -> Workspace feed posts
- `GET /api/events` -> Workspace events
- `GET /api/tenant/members` -> Workspace member roster
- `GET /api/notifications` -> Workspace alerts
- `GET /api/communities/[id]/requests` -> Join requests
- `POST /api/workspaces/switch` -> Active tenant context switch
