// finext-nextjs/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Tên cookie phải khớp với backend
const REFRESH_COOKIE_NAME = 'finext_refresh_token';
const LOGIN_PATH = '/login';

// Các route PUBLIC - không cần đăng nhập
const PUBLIC_ROUTES = [
  '/',                  // Trang chủ
  '/home',              // Home pages
  '/markets',           // Thị trường
  '/money-flow',        // Dòng tiền
  '/sectors',           // Nhóm ngành
  '/stocks',            // Cổ phiếu
  '/login',             // Đăng nhập
  '/register',          // Đăng ký
  '/forgot-password',   // Quên mật khẩu
  '/auth',              // Auth routes (Google callback, etc.)
];

// Các route CẦN đăng nhập (protected)
const PROTECTED_ROUTES = [
  '/profile',           // Trang cá nhân
  '/watchlist',         // Danh sách theo dõi
  '/group-analysis',    // Phân tích nhóm
  '/sector-analysis',   // Phân tích ngành
  '/stock-analysis',    // Phân tích cổ phiếu
  '/admin',             // Admin pages
];

function isPublicRoute(pathname: string): boolean {
  // Exact match hoặc bắt đầu với route + /
  return PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshTokenCookie = request.cookies.get(REFRESH_COOKIE_NAME);

  // Bỏ qua các đường dẫn không cần check (API, static files, etc.)
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.') // Bỏ qua các file có phần mở rộng (như favicon.ico)
  ) {
    return NextResponse.next();
  }

  // Nếu là route PUBLIC => cho phép truy cập không cần đăng nhập
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Nếu là route PROTECTED và không có cookie => redirect về login
  if (isProtectedRoute(pathname) && !refreshTokenCookie) {
    console.log(`Middleware: No cookie on protected path ${pathname}, redirecting to /login`);
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // Lưu URL gốc để sau khi login có thể redirect về
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Các route khác (không trong danh sách) => cho phép truy cập
  // Client-side sẽ xử lý xác thực chi tiết nếu cần
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