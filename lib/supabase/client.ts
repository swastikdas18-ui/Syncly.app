import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';
import { getSupabaseConfig } from '@/lib/supabase/config.ts';

/**
 * Creates a browser-side Supabase client using @supabase/ssr.
 * Persists session cookies in browser storage aligned with SSR standards.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient<Database>(
    url,
    anonKey
  );
}
