import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  // Check for 'auth' cookie
  const token = request.cookies.get('auth')?.value;
  const secret = new TextEncoder().encode(process.env.SERVICE_USER_ADMIN!);
  const isApiButNotLogin = request.nextUrl.pathname.startsWith('/api/') && request.nextUrl.pathname !== '/api/login';
  if (request.nextUrl.pathname === '/login') {
    if (token) {
      try {
        await jwtVerify(token, secret);
        // If token is valid, redirect to home
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = '/';
        return NextResponse.redirect(homeUrl);
      } catch {}
    }
    // If not authenticated, allow to proceed to /login
    return NextResponse.next();
  }
  if (!token) {
    if (isApiButNotLogin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    } else {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
  }
  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (isApiButNotLogin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    } else {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
  }
}

export const config = {
  matcher: [
    '/((?!api/login|_next/static|favicon.ico|public).*)',
  ],
}; 