import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syncly-demo-workspace.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key';

/**
 * Edge Middleware for Supabase SSR Session Refresh & Navigation Protection.
 * 
 * SECURITY RULES:
 * 1. Uses @supabase/ssr createServerClient to refresh authentication tokens.
 * 2. Does NOT author or trust custom HMAC tokens.
 * 3. Protected UI routes redirect unauthenticated visitors to /login.
 * 4. Fails closed: Never injects a default tenant (Acme) when tenant context is missing.
 * 5. Downstream API routes must independently verify identity and permissions.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  let isAuthenticated = false;
  let verifiedUserId: string | null = null;
  let verifiedTenantId: string | null = null;

  try {
    const supabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            response = NextResponse.next({
              request: {
                headers: req.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Authoritative check with Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      verifiedUserId = user.id;
      verifiedTenantId = user.user_metadata?.tenant_id || null;
    }
  } catch {
    // Supabase Auth unreachable, token malformed, or offline
    isAuthenticated = false;
  }

  const isProtectedRoute = (
    pathname.startsWith('/feed') ||
    pathname.startsWith('/channels') ||
    pathname.startsWith('/events') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/admin')
  );

  // 1. Unauthenticated access to protected UI routes redirects to /login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated access to /login redirects to /feed
  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/feed', req.url));
  }

  // 3. Edge perimeter check: Intercept cross-tenant tampering on API routes
  if (isAuthenticated && verifiedTenantId && pathname.startsWith('/api/')) {
    const rawHeaderTenant = req.headers.get('x-tenant-id');
    const rawCookieTenant = req.cookies.get('active_tenant_id')?.value;

    if (rawHeaderTenant && rawHeaderTenant.toLowerCase() !== verifiedTenantId.toLowerCase()) {
      return NextResponse.json(
        { error: 'Forbidden. Cross-tenant header tampering denied.' },
        { status: 403 }
      );
    }
    if (rawCookieTenant && rawCookieTenant.toLowerCase() !== verifiedTenantId.toLowerCase()) {
      return NextResponse.json(
        { error: 'Forbidden. Cross-tenant cookie tampering denied.' },
        { status: 403 }
      );
    }
  }

  // 4. CSRF Defense: For state-changing mutations on API routes, verify Origin / Referer
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host && !originHost.endsWith('.supabase.co') && !originHost.includes('localhost') && !originHost.includes('127.0.0.1')) {
          return NextResponse.json(
            { error: 'Forbidden. Untrusted cross-origin request rejected.' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Forbidden. Malformed request origin.' },
          { status: 403 }
        );
      }
    }
  }

  // 4. Fail-closed: Propagate verified tenant ONLY if authenticated and present
  if (verifiedTenantId) {
    response.headers.set('x-tenant-id', verifiedTenantId);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/events/stream).*)'],
};
