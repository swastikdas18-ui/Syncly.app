import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.ts';
import type { NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config.ts';

let clientFactoryOverride: ((req?: NextRequest) => any) | null = null;

/**
 * Controlled test injection hook for automated route integration test suites.
 * 
 * SECURITY INVARIANTS:
 * 1. Strictly disabled in production mode (`process.env.NODE_ENV === 'production'`).
 * 2. Cannot be invoked or altered via request parameters, headers, cookies, or user inputs.
 * 3. Throws a fatal security error if called outside an explicit non-production/test execution environment.
 */
export function __setClientFactoryOverride(fn: ((req?: NextRequest) => any) | null) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security Violation] Test client factory overrides are strictly prohibited in production mode.');
  }
  clientFactoryOverride = fn;
}

/**
 * Creates a server-side Supabase client using @supabase/ssr.
 * Handles reading and setting session cookies via Next.js App Router cookies()
 * or directly from a NextRequest when provided.
 */
export async function createClient(req?: NextRequest) {
  // Overrides are only honored in non-production environments
  if (clientFactoryOverride && process.env.NODE_ENV !== 'production') {
    return clientFactoryOverride(req);
  }

  const { url, anonKey } = getSupabaseConfig();

  if (req) {
    const authHeader = req.headers.get('authorization');
    return createServerClient<Database>(
      url,
      anonKey,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
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
    url,
    anonKey,
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
