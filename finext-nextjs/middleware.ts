// finext-nextjs/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isBlockedRoute } from './lib/blocked-routes';

// Tên cookie phải khớp với backend
const REFRESH_COOKIE_NAME = 'finext_refresh_token';
// Cookie indicator FE tự set (xem services/core/session.ts). Dùng để middleware
// nhận biết session khi FE/BE khác origin (dev), khi refresh cookie HttpOnly
// không gửi qua được FE origin.
const SESSION_FLAG_COOKIE = 'finext_session_active';
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

  // Blocked routes (compliance pivot) => trả 403
  if (isBlockedRoute(pathname)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Route không cần bảo vệ => cho qua
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  // Route cần bảo vệ: pass nếu CÓ refresh cookie (BE set, same-origin) HOẶC
  // session flag cookie (FE set, hoạt động khi BE khác origin trong dev).
  const refreshTokenCookie = request.cookies.get(REFRESH_COOKIE_NAME);
  const sessionFlagCookie = request.cookies.get(SESSION_FLAG_COOKIE);
  if (!refreshTokenCookie && !sessionFlagCookie) {
    console.log(`Middleware: No auth cookie on protected path ${pathname}, redirecting to /login`);
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
    '/((?!api|_next/static|_next/image|favicon.ico|sw\\.js).*)',
  ],
};