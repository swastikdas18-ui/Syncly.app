import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';
import { getSupabaseConfig } from '@/lib/supabase/config.ts';

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

  const { url, anonKey } = getSupabaseConfig();

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
        console.error('[Auth Callback OTP Verification Error]:', error.message);
        return NextResponse.redirect(new URL('/login?error=otp_failed', request.url));
      }
    }
  } catch (err) {
    console.error('[Auth Callback Unexpected Error]:', err);
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url));
  }

  return response;
}
