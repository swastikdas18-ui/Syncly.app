import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syncly-demo-workspace.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key';

/**
 * GET /auth/callback
 * Exchanges Supabase Auth OTP or code for a cryptographically verified server session.
 * Stores genuine session cookies via @supabase/ssr.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as any;
  const next = requestUrl.searchParams.get('next') || '/feed';

  const response = NextResponse.redirect(new URL(next, request.url));

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
            });
          });
        },
      },
    }
  );

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('[Auth Callback Code Exchange Error]:', error.message);
        return NextResponse.redirect(new URL('/login?error=verification_failed', request.url));
      }
    } else if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });
      if (error) {
        console.error('[Auth Callback OTP Verify Error]:', error.message);
        return NextResponse.redirect(new URL('/login?error=token_expired', request.url));
      }
    }
  } catch (err: any) {
    console.error('[Auth Callback Exception]:', err?.message || err);
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', request.url));
  }

  return response;
}

