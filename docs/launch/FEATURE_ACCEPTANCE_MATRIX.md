# FEATURE ACCEPTANCE MATRIX

| Module / Feature | UI Implementation | API Route Handler | Database Schema / RPC | Security & RLS Enforced | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Session** | `app/(auth)/login`, `app/(auth)/register` | `/api/auth/login`, `/api/auth/logout` | `auth.users`, `public.profiles` | Session token validation via Supabase Auth | **COMPLETE** |
| **Workspace Creation (RBAC)** | `CreateCommunityModal.tsx`, `communities/new/page.tsx` | `/api/communities/create` | `public.create_workspace` (Migration 020) | Admin/Owner check; `FOR UPDATE` row lock; 0-mem onboarding | **COMPLETE** |
| **Workspace Switching** | `Header.tsx` workspace dropdown | `/api/workspaces/switch` | `public.memberships`, `public.tenants` | Validates membership; sets secure `active_tenant_id` cookie | **COMPLETE** |
| **Join Requests & Review** | `JoinRequestsModal.tsx` | `/api/communities/[id]/requests` | `public.review_join_request` (Migration 017) | Canonical 2-arg signature; Admin-only review | **COMPLETE** |
| **Post Feed & Creation** | `PostFeed.tsx` | `/api/posts`, `/api/posts/[postId]` | `public.posts` | Tenant isolation RLS; rate limiting | **COMPLETE** |
| **Durable Post Reactions** | `PostFeed.tsx` like button | `/api/posts/[postId]/like` | `public.toggle_post_reaction` (Migration 019) | Unique `(post_id, user_id)`; ACID atomic counts | **COMPLETE** |
| **Channels Directory** | `ChannelChat.tsx` | `/api/channels` | `public.channels` | Tenant-scoped channel queries; cross-tenant 403 | **COMPLETE** |
| **Real-Time Chat & Messages** | `ChannelChat.tsx` | `/api/channels/[channelId]/messages` | `public.messages` | Tenant & channel filtering; rate limiting | **COMPLETE** |
| **Member Directory** | `app/(dashboard)/members/page.tsx` | `/api/tenant/members` | `public.memberships`, `public.profiles` | Migration 017 RLS; sanitized roster (no SQL leaks) | **COMPLETE** |
| **Persistent Notifications** | `app/(dashboard)/notifications/page.tsx` | `/api/notifications` | `public.notifications` (Migration 021) | Recipient-scoped RLS; PATCH mark-as-read | **COMPLETE** |
| **Events & RSVP** | `app/(dashboard)/events/page.tsx` | `/api/events` | `public.events` | Tenant-scoped queries; RSVP persistence | **COMPLETE** |
| **User Profile & Settings** | `app/(dashboard)/profile/page.tsx` | `/api/profile` | `public.profiles` | Own-profile update RLS (`auth.uid() = id`) | **COMPLETE** |
| **Tenant Search** | `app/(dashboard)/search/page.tsx` | `/api/communities/search`, `/api/posts` | `public.posts`, `public.channels` | Scoped strictly to active workspace | **COMPLETE** |
| **Presence & Activity** | `ChannelChat.tsx` presence rail | `/api/presence`, `/api/presence/track` | Supabase Realtime / Redis | Workspace-scoped tracking | **COMPLETE** |
| **Media Upload & Download** | Media upload dialogs | `/api/media/upload`, `/api/media/download` | Supabase Storage (`community-media`) | Workspace path validation; authenticated upload | **COMPLETE** |
