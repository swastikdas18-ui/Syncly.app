import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syncly-demo-workspace.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key';

/**
 * POST /api/auth/logout
 * Terminates the authenticated user session.
 * 
 * SECURITY RULES:
 * 1. Invokes Supabase Auth signOut() to revoke the server-side refresh token family.
 * 2. Purges all session and tenant cookies by setting Max-Age=0.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully. Session invalidated.',
  });

  try {
    const supabase = createServerClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
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
  const cookiesToClear = [
    'syncly_auth_token',
    'syncly_session',
    'active_tenant_id',
    'active_community_id',
    'x-tenant-id',
    'syncly_role',
  ];

  for (const cookieName of cookiesToClear) {
    response.cookies.set(cookieName, '', {
      path: '/',
      maxAge: 0,
    });
  }

  // Also purge all Supabase Auth session cookies (matching sb-*-auth-token)
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        maxAge: 0,
      });
    }
  }

  return response;
}

