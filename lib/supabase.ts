import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';
import { getSupabaseConfig } from '@/lib/supabase/config.ts';

/**
 * Production Supabase Client instance for Auth, Database queries, Storage and Realtime.
 * Aligned with @supabase/ssr cookie storage standard.
 */
function createSupabaseInstance() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}

export const supabase = createSupabaseInstance();
