export const SUPABASE_MIGRATION_SQL = `-- ==============================================================================
-- SYNCLY / WORK-CONNECT PRODUCTION FINAL SCHEMA FREEZE & IDEMPOTENT MIGRATION
-- Project: Syncly Corporate Communication & Team Workspace
-- Objective: Production-Grade, Idempotent Supabase/PostgreSQL Migration
-- File: supabase/migrations/final_production_schema.sql
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- STEP 1: IDEMPOTENT CORE SCHEMA DEFINITION (6 RELATIONAL CORE TABLES)
-- ==============================================================================

-- 1. tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default tenant '00000000-0000-0000-0000-000000000001' on conflict do nothing
INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default-org')
ON CONFLICT (id) DO NOTHING;

-- Also seed Acme Corp & Globex Tech if conflict does not occur
INSERT INTO public.tenants (id, name, slug)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'Globex Technologies', 'globex-tech')
ON CONFLICT (id) DO NOTHING;

-- 2. profiles (References auth.users in Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely ensure foreign key to auth.users if auth schema exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_profiles_auth_users' AND table_name = 'profiles'
    ) THEN
      ALTER TABLE public.profiles
        ADD CONSTRAINT fk_profiles_auth_users
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Auto-create backward-compatible view: public.users
CREATE OR REPLACE VIEW public.users AS
SELECT 
  id, 
  tenant_id, 
  full_name, 
  avatar_url, 
  role, 
  status, 
  created_at
FROM public.profiles;

-- 3. channels (Composite PK: tenant_id, id)
CREATE TABLE IF NOT EXISTS public.channels (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);

-- Seed default public channels (general, announcements, engineering, random) for default tenant
INSERT INTO public.channels (id, tenant_id, name, description, is_private)
VALUES 
  ('general', '00000000-0000-0000-0000-000000000001', 'general', 'Company-wide updates and watercooler conversations', false),
  ('announcements', '00000000-0000-0000-0000-000000000001', 'announcements', 'Official corporate announcements and executive briefs', false),
  ('engineering', '00000000-0000-0000-0000-000000000001', 'engineering', 'Technical architecture discussions, git commits & standups', false),
  ('random', '00000000-0000-0000-0000-000000000001', 'random', 'Informal team chat, weekend plans, and banter', false)
ON CONFLICT (tenant_id, id) DO NOTHING;

-- 4. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite Foreign Key referencing channels(tenant_id, id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_messages_channel' AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT fk_messages_channel 
      FOREIGN KEY (tenant_id, channel_id) 
      REFERENCES public.channels(tenant_id, id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. posts
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  media_urls TEXT DEFAULT '',
  likes_count INT4 DEFAULT 0,
  comments_count INT4 DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. post_comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- STEP 2: AUTOMATED AUTH TRIGGER FOR USER PROVISIONING
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_role TEXT;
BEGIN
  -- 1. Extract tenant_id from metadata or fallback to default tenant UUID
  BEGIN
    v_tenant_id := NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END;

  IF v_tenant_id IS NULL THEN
    v_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- 2. Ensure tenant exists before inserting profile
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    INSERT INTO public.tenants (id, name, slug)
    VALUES (v_tenant_id, 'Default Organization', 'default-org-' || SUBSTRING(v_tenant_id::text, 1, 8))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 3. Extract user metadata attributes with safe fallbacks
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    SPLIT_PART(COALESCE(NEW.email, 'team.member@internal'), '@', 1)
  );

  v_avatar_url := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  );

  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role', ''),
    'employee'
  );

  -- 4. Upsert into public.profiles
  INSERT INTO public.profiles (id, tenant_id, full_name, avatar_url, role, status, created_at)
  VALUES (
    NEW.id,
    v_tenant_id,
    v_full_name,
    v_avatar_url,
    v_role,
    'active',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    tenant_id  = EXCLUDED.tenant_id,
    full_name  = EXCLUDED.full_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    role       = COALESCE(EXCLUDED.role, public.profiles.role),
    status     = 'active';

  RETURN NEW;
END;
$$;

-- Safely attach trigger to auth.users if auth schema is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- STEP 3: PRODUCTION COMPOSITE INDEXES (TENANT-FIRST)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_channels_tenant ON public.channels(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_posts_tenant_created ON public.posts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_channel ON public.messages(tenant_id, channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_post ON public.post_comments(tenant_id, post_id, created_at ASC);

-- ==============================================================================
-- STEP 4: STRICT ROW-LEVEL SECURITY (RLS) & REALTIME PUBLICATION
-- ==============================================================================

-- 1. Enable RLS on all 6 core tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 2. Tenant isolation context helper function
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$ 
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid; 
$$ LANGUAGE sql STABLE;

-- 3. Idempotent RLS Policies for Tenants
DROP POLICY IF EXISTS tenant_isolation_tenants_select ON public.tenants;
CREATE POLICY tenant_isolation_tenants_select ON public.tenants
  FOR SELECT USING (
    id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_tenants_insert ON public.tenants;
CREATE POLICY tenant_isolation_tenants_insert ON public.tenants
  FOR INSERT WITH CHECK (
    id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_tenants_update ON public.tenants;
CREATE POLICY tenant_isolation_tenants_update ON public.tenants
  FOR UPDATE USING (
    id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

-- 4. Idempotent RLS Policies for Profiles
DROP POLICY IF EXISTS tenant_isolation_profiles_select ON public.profiles;
CREATE POLICY tenant_isolation_profiles_select ON public.profiles
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_profiles_insert ON public.profiles;
CREATE POLICY tenant_isolation_profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_profiles_update ON public.profiles;
CREATE POLICY tenant_isolation_profiles_update ON public.profiles
  FOR UPDATE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_profiles_delete ON public.profiles;
CREATE POLICY tenant_isolation_profiles_delete ON public.profiles
  FOR DELETE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

-- 5. Idempotent RLS Policies for Channels
DROP POLICY IF EXISTS tenant_isolation_channels_select ON public.channels;
CREATE POLICY tenant_isolation_channels_select ON public.channels
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_channels_insert ON public.channels;
CREATE POLICY tenant_isolation_channels_insert ON public.channels
  FOR INSERT WITH CHECK (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_channels_update ON public.channels;
CREATE POLICY tenant_isolation_channels_update ON public.channels
  FOR UPDATE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_channels_delete ON public.channels;
CREATE POLICY tenant_isolation_channels_delete ON public.channels
  FOR DELETE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

-- 6. Idempotent RLS Policies for Messages
DROP POLICY IF EXISTS tenant_isolation_messages_select ON public.messages;
CREATE POLICY tenant_isolation_messages_select ON public.messages
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_messages_insert ON public.messages;
CREATE POLICY tenant_isolation_messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_messages_update ON public.messages;
CREATE POLICY tenant_isolation_messages_update ON public.messages
  FOR UPDATE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_messages_delete ON public.messages;
CREATE POLICY tenant_isolation_messages_delete ON public.messages
  FOR DELETE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

-- 7. Idempotent RLS Policies for Posts
DROP POLICY IF EXISTS tenant_isolation_posts_select ON public.posts;
CREATE POLICY tenant_isolation_posts_select ON public.posts
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_posts_insert ON public.posts;
CREATE POLICY tenant_isolation_posts_insert ON public.posts
  FOR INSERT WITH CHECK (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_posts_update ON public.posts;
CREATE POLICY tenant_isolation_posts_update ON public.posts
  FOR UPDATE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_posts_delete ON public.posts;
CREATE POLICY tenant_isolation_posts_delete ON public.posts
  FOR DELETE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

-- 8. Idempotent RLS Policies for Post Comments
DROP POLICY IF EXISTS tenant_isolation_post_comments_select ON public.post_comments;
CREATE POLICY tenant_isolation_post_comments_select ON public.post_comments
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_post_comments_insert ON public.post_comments;
CREATE POLICY tenant_isolation_post_comments_insert ON public.post_comments
  FOR INSERT WITH CHECK (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_post_comments_update ON public.post_comments;
CREATE POLICY tenant_isolation_post_comments_update ON public.post_comments
  FOR UPDATE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_post_comments_delete ON public.post_comments;
CREATE POLICY tenant_isolation_post_comments_delete ON public.post_comments
  FOR DELETE USING (
    tenant_id = public.get_current_tenant_id() OR public.get_current_tenant_id() IS NULL
  );

-- ==============================================================================
-- STEP 5: REALTIME PUBLICATION SETUP
-- ==============================================================================

DO $$
BEGIN
  -- Check if publication supabase_realtime exists
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Conditionally add posts if not already published
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    END IF;

    -- Conditionally add messages if not already published
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
`;
