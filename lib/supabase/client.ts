import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syncly-demo-workspace.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key';

/**
 * Creates a browser-side Supabase client using @supabase/ssr.
 * Persists session cookies in browser storage aligned with SSR standards.
 */
export function createClient() {
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}

