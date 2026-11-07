import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syncly-demo-workspace.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key';

/**
 * Production Supabase Client instance for Auth, Database queries, Storage and Realtime.
 * Aligned with @supabase/ssr cookie storage standard.
 */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
