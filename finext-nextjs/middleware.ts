// finext-nextjs/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Tên cookie phải khớp với backend
const REFRESH_COOKIE_NAME = 'finext_refresh_token';
const LOGIN_PATH = '/login';

// Chỉ khai báo các route CẦN đăng nhập — tất cả route khác mặc định public
const PROTECTED_ROUTES = [
  '/profile',           // Trang cá nhân
  '/watchlist',         // Danh sách theo dõi
  '/admin',             // Admin pages
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Route không cần bảo vệ => cho qua
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  // Route cần bảo vệ mà không có cookie => redirect về login
  const refreshTokenCookie = request.cookies.get(REFRESH_COOKIE_NAME);
  if (!refreshTokenCookie) {
    console.log(`Middleware: No cookie on protected path ${pathname}, redirecting to /login`);
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Cấu hình matcher - chỉ chạy middleware trên các trang cần thiết
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};