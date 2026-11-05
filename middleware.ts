import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  const synclySession = req.cookies.get('syncly_session')?.value;
  const supabaseToken = req.cookies.get('sb-access-token')?.value;
  const isAuthenticated = Boolean(synclySession || supabaseToken);

  const isProtectedRoute = (
    pathname.startsWith('/feed') ||
    pathname.startsWith('/channels') ||
    pathname.startsWith('/events') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin')
  );

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/feed', req.url));
  }

  const response = NextResponse.next();
  const tenantId = req.cookies.get('active_tenant_id')?.value || '00000000-0000-0000-0000-000000000001';
  response.headers.set('x-tenant-id', tenantId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/events/stream).*)'],
};
