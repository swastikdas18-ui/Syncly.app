import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseConfig } from '@/lib/supabase/config.ts';

/**
 * Edge Middleware for Supabase SSR Session Refresh & Navigation Protection.
 * 
 * SECURITY RULES (Cycle 10.4):
 * 1. Uses @supabase/ssr createServerClient to refresh authentication tokens.
 * 2. Does NOT author or trust custom HMAC tokens.
 * 3. Protected UI routes redirect unauthenticated visitors to /login.
 * 4. Fails closed: Never injects a default tenant when tenant context is missing.
 * 5. Does NOT treat user_metadata.tenant_id as authoritative membership truth.
 *    Authoritative workspace authorization is delegated to the server-side route
 *    authorization layer (lib/auth/server.ts), which queries public.memberships.
 * 6. Preserves CSRF origin protection on API mutations.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  let isAuthenticated = false;

  try {
    const { url, anonKey } = getSupabaseConfig();
    const supabase = createServerClient(
      url,
      anonKey,
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
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (user && !userErr) {
      isAuthenticated = true;
    }
  } catch {
    // Supabase Auth unreachable, token malformed, or offline -> fail closed
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

  // 3. CSRF Defense: For state-changing mutations on API routes, verify Origin / Referer
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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/events/stream).*)'],
};
