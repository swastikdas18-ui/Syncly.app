# Syncly — Multi-Tenant Corporate Communication & Chat Platform

An enterprise-grade, multi-tenant workspace communication platform providing segregated company feeds, drag-and-drop media announcements, threaded discussions, real-time channel messaging, and verifiable cross-tenant isolation with full Supabase PostgreSQL migration scripts.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been locked in based on your specifications and Turn 1 preferences:
> - **Backend & Persistence Engine**: Integrated full-stack Express service with high-fidelity tenant-isolated data stores, real-time Server-Sent Events (SSE) streaming, multipart media uploading, and an interactive idempotent Supabase PostgreSQL migration exporter (`schema.sql`).
> - **Visual Identity**: Sleek modern enterprise SaaS aesthetic inspired by Linear and modern Slack/Notion layouts (neutral slate canvas, crisp hairline dividers, zero-pill metadata discipline, and high-density typography with tabular figures).
> - **Default Multi-Tenant Workspaces**: Pre-seeded with **Acme Corporation** (`00000000-0000-0000-0000-000000000001`) and **Globex Technologies** (`00000000-0000-0000-0000-000000000002`), plus interactive tenant switching to test and verify strict zero-leakage isolation.

---

### 1. Overview & Core Concept

- **What It Does**: Syncly enables organizations to run dedicated internal communication hubs. Each tenant workspace features an isolated Company Updates feed (announcements, spotlights, general, Q&A, and event posts with multi-image gallery attachments), threaded comments, and real-time chat channels (`#general`, `#announcements`, `#engineering`, `#watercooler`).
- **Target Audience / Persona**: Corporate teams, department leads, and employees collaborating across distributed organizations requiring clear company-wide announcements and team chat without cross-company data leakage.
- **Key Value**: Guarantees strict multi-tenant boundary isolation at the database, API middleware, and client layers, backed by verified row-level security (RLS) policies and production-ready PostgreSQL migration scripts.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Tenant Switch & Isolation Verification**:
   - The user selects the active organization from the top workspace header (e.g. *Acme Corp* vs *Globex Tech*).
   - The UI immediately swaps context headers (`x-tenant-id`), refreshing channels, messages, posts, and media attachments with zero leakage between companies.
   - An interactive "Tenant Isolation Inspector" badge demonstrates that queries targeting Tenant A return exactly zero rows from Tenant B.
2. **Company Feed & Media Composer**:
   - Filter announcements by category (`All`, `Announcements`, `General`, `Spotlight`, `Q&A`, `Events`) via clean segmented controls.
   - Author rich updates with title, markdown body, category tags, and multi-file drag-and-drop image uploads with live preview thumbnails.
   - Interact with posts via optimistic like toggles and threaded discussion drawers.
3. **Real-Time Channel Chat**:
   - Switch between public and private channels (`#general`, `#product-sync`, `#leadership`).
   - Read chronological messages grouped by sender with optimistic delivery indicators.
   - Broadcast messages over real-time stream; test multi-window / simulated incoming messages.
4. **Database & Storage Blueprint Modal**:
   - Inspect and export the complete idempotent Supabase PostgreSQL migration script, including RLS policies, indexes, and storage bucket configuration.

#### Visual Identity & Theme
- **Aesthetic Direction**: High-trust, sleek modern enterprise SaaS with crisp geometry and purposeful whitespace.
- **Palette & Mood**:
  - Dominant Neutral (60%): Clean white (`#FFFFFF`) / light slate background (`#F8FAFC`) with deep slate typography (`#0F172A`).
  - Structural Surfaces (30%): Pure white cards (`#FFFFFF`) with subtle hairline borders (`border border-slate-200`) and soft elevation (`shadow-xs`).
  - Accent Budget (10%): High-intent Indigo/Blue (`#2563EB` / `#1D4ED8`) reserved for active tabs, primary action buttons, and send triggers.
- **Typography & Hierarchy**:
  - Display & Headings: `Plus Jakarta Sans`, font-semibold, letter-spacing `-0.02em`.
  - Body & Chat: `Plus Jakarta Sans`, 14px–15px, relaxed line height.
  - Telemetry & Identifiers: Tabular numerals (`tabular-nums font-mono`) for timestamps, UUIDs, likes, and reply counts.
- **Zero-Pill Discipline**:
  - Metadata (author, timestamp, category, tenant ID) is rendered as clean unboxed text separated by subtle typographic bullets (`·`).
  - Interactive filters use crisp segmented controls, never floating candy badges.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-Stack Express Server with Native Server-Sent Events (SSE)**
  - *Chosen Approach*: Implement an Express backend mounted in `server.ts` with `/api/posts`, `/api/channels/:channelId/messages`, `/api/media/upload`, and `/api/stream/events`.
  - *Why*: Provides immediate, runnable, full-stack multi-tenancy in the AI Studio container without requiring external credentials, while preserving 100% API fidelity with the requested Next.js / Supabase contracts.
  - *Alternatives Considered*: Pure client-side mock was rejected because the prompt requested backend middleware (`x-tenant-id` header validation) and API endpoints.

- **Decision 2: Strict UUID Validation & Safe Default Fallback**
  - *Chosen Approach*: Validate all tenant IDs with regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. Fallback strictly to `'00000000-0000-0000-0000-000000000001'` instead of invalid string literals like `'tenant-default'`, preventing PostgreSQL `22P02` syntax exceptions.
  - *Why*: Eliminates type crashes and guarantees schema compliance.

- **Decision 3: Complete Idempotent PostgreSQL Migration Script & Storage RLS**
  - *Chosen Approach*: Embed the production-grade SQL migration script directly in the app with copy/download options, covering `tenants`, `profiles`, `posts`, `post_comments`, `channels`, `messages`, composite indexes, RLS policies, and `community-media` bucket rules.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Syncly Enterprise Web Client                    │
│   ┌───────────────────────────────┬────────────────────────────────┐   │
│   │   Tenant Workspace Selector   │    Isolation Inspector Bar     │   │
│   └───────────────────────────────┴────────────────────────────────┘   │
│   ┌─────────────────────────┬──────────────────────────────────────┐   │
│   │ Channels & DMs Sidebar  │  Active View: Feed / Chat / Schema   │   │
│   │  · #general             │  ┌─────────────────────────────────┐ │   │
│   │  · #announcements       │  │ PostFeed & Drag-Drop Composer   │ │   │
│   │  · #product-updates     │  │ Real-Time Chat Stream (SSE)     │ │   │
│   │  · #leadership (lock)   │  │ Supabase SQL Migration Viewer   │ │   │
│   └─────────────────────────┴──┴─────────────────────────────────┴─┘   │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ x-tenant-id: UUID
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend Engine                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Tenant Context Middleware (UUID validation, fallback default)  │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │
│   ┌───────────────┬────────────────┼───────────────┬───────────────┐   │
│   ▼               ▼                ▼               ▼               ▼   │
│ /api/posts    /api/messages   /api/channels   /api/media/upload /api/sse
│ (Paginated)   (Chronological) (Tenant Scoped) (Bucket storage)  (PubSub)
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
               ┌───────────────────────────────────────────┐
               │    Tenant-Isolated Multi-Store Engine     │
               │   · tenants (id, name, slug)              │
               │   · profiles (id, tenant_id, role)        │
               │   · posts (id, tenant_id, category, media)│
               │   · channels & messages (tenant_id scoped)│
               │   · storage: community-media/{tenant_id}  │
               └───────────────────────────────────────────┘
```

#### Data Entities & RLS Contract
- **`tenants`**: `id UUID PK`, `name TEXT`, `slug TEXT UNIQUE`, `created_at TIMESTAMPTZ`.
- **`profiles`**: `id UUID PK`, `tenant_id UUID REFERENCES tenants`, `full_name`, `avatar_url`, `role`, `status`.
- **`posts`**: `id UUID PK`, `tenant_id UUID`, `author_id UUID`, `title`, `content`, `category ('announcement'|'general'|'spotlight'|'qna'|'event')`, `media_urls TEXT[]`, `likes_count INT`, `comments_count INT`.
- **`channels`**: `(tenant_id, id) PRIMARY KEY`, `name`, `description`, `is_private`.
- **`messages`**: `id UUID PK`, `tenant_id UUID`, `channel_id TEXT`, `user_id UUID`, `content TEXT`, `media_urls TEXT[]`.

#### Verification Plan
1. **Tenant Isolation Test**: Verify querying with Tenant A's ID yields zero records from Tenant B across posts, messages, and channels.
2. **Media Upload & Preview**: Upload multiple images in the composer, verify thumbnail rendering, and check persistent URL assignment.
3. **Real-Time Delivery**: Test sending messages in channel chat with optimistic UI updates and instant live synchronization.
4. **Build & Type Check**: Run `compile_applet` and `lint_applet` to guarantee clean TypeScript compilation.
