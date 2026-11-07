import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syncly-demo-workspace.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key';

/**
 * POST /api/auth/demo-login
 * Authenticates verified demo personas through Supabase Auth.
 * 
 * SECURITY RULES:
 * 1. Disabled in production unless explicitly enabled via ENABLE_DEMO_LOGIN=true.
 * 2. Authenticates directly against Supabase Auth service (no in-memory token authority).
 * 3. Sets genuine Supabase SSR session cookies on the HTTP response.
 * 4. Strictly validates persona role ('intern' or 'mentor').
 */
export async function POST(request: NextRequest) {
  // 1. Guard against unauthorized demo login in production environments
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEMO_LOGIN !== 'true') {
    return NextResponse.json(
      { error: 'Forbidden. Demo authentication is disabled in production.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { role } = body;

    if (!role || (role !== 'intern' && role !== 'mentor')) {
      return NextResponse.json(
        { error: 'Invalid demo persona. Must be "intern" or "mentor".' },
        { status: 400 }
      );
    }

    const email = role === 'intern' ? 'intern@syncly.internal' : 'mentor@syncly.internal';
    const password = role === 'intern'
      ? (process.env.DEMO_INTERN_PASSWORD || 'DemoInternPass2026!')
      : (process.env.DEMO_MENTOR_PASSWORD || 'DemoMentorPass2026!');

    const response = NextResponse.json({
      success: true,
      role,
      email,
      message: `Authenticated as ${role} via Supabase Auth.`,
    });

    // Initialize Supabase SSR client bound to the response cookie store
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
                sameSite: 'lax',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
              });
            });
          },
        },
      }
    );

    // 2. Authoritative authentication via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        { error: `Supabase authentication failed: ${authError?.message || 'Invalid credentials'}` },
        { status: 401 }
      );
    }

    // 3. Resolve user profile and home tenant from PostgreSQL
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    const tenantId = (profile as any)?.tenant_id || '00000000-0000-0000-0000-000000000001';

    // Set active workspace preference cookie
    response.cookies.set('active_tenant_id', tenantId, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Demo authentication failed.' },
      { status: 500 }
    );
  }
}
