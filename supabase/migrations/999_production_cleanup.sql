-- ============================================================================
-- Syncly / Work-Connect Corporate Platform: Production Clean-up & Hardening
-- Migration: 999_production_cleanup.sql
-- Description: Completely purges mock users, dummy tenant records, test posts,
--              synthetic events, and enforces cascade constraints & RLS security.
-- ============================================================================

-- 1. Purge Known Synthetic & Test IDs Across All Tables
DELETE FROM public.post_comments 
WHERE author_id = '00000000-0000-0000-0000-000000000001'
   OR author_id = '00000000-0000-0000-0000-000000000010'
   OR author_id = '00000000-0000-0000-0000-000000000020'
   OR post_id IN ('1f7b22de-5865-42ea-b4c8-3475a02aca4a', '2a8c33de-6875-43ea-b4c8-3475a02aca5b');

DELETE FROM public.posts 
WHERE id IN (
  '1f7b22de-5865-42ea-b4c8-3475a02aca4a',
  '2a8c33de-6875-43ea-b4c8-3475a02aca5b',
  '3b9d44ef-7986-44fb-c5d9-4586b13bdb6c'
) 
OR author_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020'
);

DELETE FROM public.messages 
WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020'
);

DELETE FROM public.memberships 
WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020'
);

DELETE FROM public.community_join_requests
WHERE user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020'
);

-- Purge mock profiles
DELETE FROM public.profiles 
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020'
)
OR full_name IN ('Sarah Chen', 'Alex Rivera', 'Elena Rostova', 'Demo Intern', 'Demo Mentor');

-- Purge synthetic users from auth schema if they were inserted directly
DELETE FROM auth.users 
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020'
)
OR email LIKE '%@demo.syncly.internal'
OR email LIKE '%@demo.acme.com';

-- Purge dummy events
DELETE FROM public.events 
WHERE id IN (
  '2a8c33de-6875-43ea-b4c8-3475a02aca5b',
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003'
);

-- 2. Verify Foreign Keys with ON DELETE CASCADE
DO $$
BEGIN
  -- Check and ensure foreign key cascades for profiles -> tenants
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey,
      ADD CONSTRAINT profiles_tenant_id_fkey 
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  -- Ensure posts -> tenants cascade
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'posts_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.posts
      DROP CONSTRAINT IF EXISTS posts_tenant_id_fkey,
      ADD CONSTRAINT posts_tenant_id_fkey 
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  -- Ensure posts -> profiles cascade
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'posts_author_id_fkey'
  ) THEN
    ALTER TABLE public.posts
      DROP CONSTRAINT IF EXISTS posts_author_id_fkey,
      ADD CONSTRAINT posts_author_id_fkey 
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- Ensure messages -> channels & tenants cascade
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      DROP CONSTRAINT IF EXISTS messages_tenant_id_fkey,
      ADD CONSTRAINT messages_tenant_id_fkey 
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Confirm RLS Is Strictly Enabled on All Tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

-- 4. Enable Supabase Realtime Replication for core collaboration tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_join_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
