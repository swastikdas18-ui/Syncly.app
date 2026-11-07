import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.ts';
import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syncly-demo-workspace.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key';

/**
 * Creates a server-side Supabase client using @supabase/ssr.
 * Handles reading and setting session cookies via Next.js App Router cookies()
 * or directly from a NextRequest when provided.
 */
export async function createClient(req?: NextRequest) {
  if (req) {
    return createServerClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {
            // Read-only inspection on NextRequest
          },
        },
      }
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Invoked from Server Component where cookies cannot be mutated
          }
        },
      },
    }
  );
}
