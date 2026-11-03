export const SUPABASE_MIGRATION_SQL = `-- ==============================================================================
-- SYNCLY / WORK-CONNECT MULTI-TENANT ARCHITECTURE SCHEMA & RLS MIGRATION SCRIPT
-- Idempotent PostgreSQL Migration for Supabase
-- ==============================================================================

-- 1. Enable pgcrypto / uuid-ossp for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Tenants (Idempotent upsert)
INSERT INTO public.tenants (id, name, slug)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Acme Corporation', 'acme-corp'),
  ('00000000-0000-0000-0000-000000000002', 'Globex Technologies', 'globex-tech')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, slug = EXCLUDED.slug;

-- 3. Profiles / Users Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY, -- References auth.users(id) in live Supabase
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Profiles for Testing Both Tenants
INSERT INTO public.profiles (id, tenant_id, full_name, role, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Elena Rostova', 'admin', 'active'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Marcus Vance', 'manager', 'active'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', 'Devon Thorne', 'admin', 'active'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000002', 'Maya Lin', 'employee', 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. Company Updates & Posts Feed Table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('announcement', 'general', 'spotlight', 'qna', 'event')),
  media_urls TEXT[] DEFAULT '{}',
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Post Comments Table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Real-Time Channels Table (Composite PK: tenant_id, id)
CREATE TABLE IF NOT EXISTS public.channels (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);

-- Seed Channels for Acme Corp
INSERT INTO public.channels (id, tenant_id, name, description, is_private)
VALUES
  ('general', '00000000-0000-0000-0000-000000000001', 'general', 'Company-wide updates and watercooler talk', false),
  ('announcements', '00000000-0000-0000-0000-000000000001', 'announcements', 'Official broadcasts and executive news', false),
  ('engineering', '00000000-0000-0000-0000-000000000001', 'engineering', 'Product engineering and architecture', false),
  ('leadership', '00000000-0000-0000-0000-000000000001', 'leadership', 'Private leadership strategy', true)
ON CONFLICT (tenant_id, id) DO NOTHING;

-- Seed Channels for Globex Tech
INSERT INTO public.channels (id, tenant_id, name, description, is_private)
VALUES
  ('general', '00000000-0000-0000-0000-000000000002', 'general', 'Globex team central hub', false),
  ('product-sync', '00000000-0000-0000-0000-000000000002', 'product-sync', 'Product roadmap and spec discussions', false),
  ('design-crit', '00000000-0000-0000-0000-000000000002', 'design-crit', 'Design reviews and token alignment', false)
ON CONFLICT (tenant_id, id) DO NOTHING;

-- 7. Real-Time Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- PERFORMANCE COMPOSITE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_posts_tenant_created 
  ON public.posts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_channel 
  ON public.messages(tenant_id, channel_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_post_comments_post 
  ON public.post_comments(tenant_id, post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant 
  ON public.profiles(tenant_id);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: tenant_id = (current_setting('app.current_tenant_id', true))::uuid
-- ==============================================================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN '00000000-0000-0000-0000-000000000001'::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

DROP POLICY IF EXISTS "Tenant isolated posts select" ON public.posts;
CREATE POLICY "Tenant isolated posts select" ON public.posts
  FOR SELECT USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated posts insert" ON public.posts;
CREATE POLICY "Tenant isolated posts insert" ON public.posts
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated posts update" ON public.posts;
CREATE POLICY "Tenant isolated posts update" ON public.posts
  FOR UPDATE USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated posts delete" ON public.posts;
CREATE POLICY "Tenant isolated posts delete" ON public.posts
  FOR DELETE USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated comments select" ON public.post_comments;
CREATE POLICY "Tenant isolated comments select" ON public.post_comments
  FOR SELECT USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated comments insert" ON public.post_comments;
CREATE POLICY "Tenant isolated comments insert" ON public.post_comments
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated channels select" ON public.channels;
CREATE POLICY "Tenant isolated channels select" ON public.channels
  FOR SELECT USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated channels insert" ON public.channels;
CREATE POLICY "Tenant isolated channels insert" ON public.channels
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated messages select" ON public.messages;
CREATE POLICY "Tenant isolated messages select" ON public.messages
  FOR SELECT USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated messages insert" ON public.messages;
CREATE POLICY "Tenant isolated messages insert" ON public.messages
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolated profiles select" ON public.profiles;
CREATE POLICY "Tenant isolated profiles select" ON public.profiles
  FOR SELECT USING (tenant_id = public.current_tenant_id());

-- ==============================================================================
-- SUPABASE STORAGE BUCKET CONFIGURATION & POLICIES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Tenant scoped uploads" ON storage.objects;
CREATE POLICY "Tenant scoped uploads" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'community-media' 
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
);

DROP POLICY IF EXISTS "Public read community-media" ON storage.objects;
CREATE POLICY "Public read community-media" ON storage.objects FOR SELECT
USING (bucket_id = 'community-media');

-- ==============================================================================
-- REALTIME PUBLICATION SETUP
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
`;
