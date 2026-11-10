import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.ts';
import { getSupabaseAdminConfig } from '@/lib/supabase/config.ts';

/**
 * Creates an admin/service-role Supabase client.
 * RESTRICTED: Strictly for server-side trusted operations (e.g. atomic join request processing
 * and synthetic test teardown). Must NEVER be exposed to client/browser.
 */
export function createAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  return createClient<Database>(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
