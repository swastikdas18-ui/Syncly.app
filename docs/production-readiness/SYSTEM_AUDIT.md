# SYNCLY SYSTEM AUDIT & ARCHITECTURE OVERVIEW

## 1. System Overview
Syncly is an enterprise-grade multi-tenant corporate communication and knowledge-sharing platform.
Built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, and backed by Supabase (PostgreSQL, Auth, RLS, Storage, Realtime).

## 2. Directory Structure & Key Modules
- `app/`: Next.js App Router containing route handlers and UI views.
  - `(auth)/`: Authentication pages (`login`, `register`, `forgot-password`, `reset-password`, `onboarding`).
  - `(dashboard)/`: Authenticated multi-tenant pages (`feed`, `channels`, `members`, `events`, `profile`, `notifications`, `search`).
  - `api/`: REST endpoints enforcing cryptographic authentication and verified membership tenant context.
- `components/`: UI components (Navigation, Header, Sidebar, BottomNav, PostFeed, ChatWindow).
- `lib/`: Core backend and shared libraries.
  - `auth/server.ts`: Centralized authority for cryptographic identity verification and database membership resolution.
  - `auth/guard.ts`: Unified error-handling mapping for API route authentication.
  - `supabase/`: Isolated client factories (`server.ts`, `client.ts`, `admin.ts`, `config.ts`).
  - `context/`: React context providers (`AuthContext.tsx`, `WorkspaceContext.tsx`).
- `supabase/migrations/`: Canonical PostgreSQL database migrations (001 through 019).

## 3. Security Perimeter
1. **Edge Middleware (`middleware.ts`)**:
   - Performs SSR session refresh via `@supabase/ssr`.
   - Protects dashboard paths against unauthenticated requests.
   - Enforces Origin/Referer CSRF defense on mutating API requests.
2. **Server-Side Route Authentication (`lib/auth/server.ts`)**:
   - Verifies caller token via authoritative `supabase.auth.getUser()`.
   - Fetches verified memberships from `public.memberships`.
   - Enforces fail-closed tenant boundary checks.
3. **Database Row Level Security (RLS)**:
   - Tables partitioned strictly by `tenant_id` or `community_id`.
   - Enforces PostgreSQL engine-level isolation.
