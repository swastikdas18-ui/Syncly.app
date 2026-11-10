import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';
import { getSupabaseConfig } from '@/lib/supabase/config.ts';

/**
 * POST /api/auth/logout
 * Terminates the authenticated user session.
 * 
 * SECURITY RULES:
 * 1. Invokes Supabase Auth signOut() to revoke the server-side refresh token family.
 * 2. Purges all session and tenant cookies by setting Max-Age=0.
 */
export async function POST(request: NextRequest) {
  const { url, anonKey } = getSupabaseConfig();
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully. Session invalidated.',
  });

  try {
    const supabase = createServerClient<Database>(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                path: '/',
                maxAge: 0,
              });
            });
          },
        },
      }
    );

    // Invalidate server session in Supabase Auth
    await supabase.auth.signOut();
  } catch {
    // Graceful handling if network fails
  }

  // Explicitly clear all legacy & standard session cookies
  response.cookies.set('sb-access-token', '', { path: '/', maxAge: 0 });
  response.cookies.set('sb-refresh-token', '', { path: '/', maxAge: 0 });
  response.cookies.set('supabase-auth-token', '', { path: '/', maxAge: 0 });
  response.cookies.set('active_tenant_id', '', { path: '/', maxAge: 0 });
  response.cookies.set('active_community_id', '', { path: '/', maxAge: 0 });
  response.cookies.set('x-tenant-id', '', { path: '/', maxAge: 0 });
  response.cookies.set('syncly_role', '', { path: '/', maxAge: 0 });
  response.cookies.set('syncly_token', '', { path: '/', maxAge: 0 });

  return response;
}
