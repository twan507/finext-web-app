// finext-nextjs/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Tên cookie phải khớp với backend
const REFRESH_COOKIE_NAME = 'finext_refresh_token';
const LOGIN_PATH = '/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshTokenCookie = request.cookies.get(REFRESH_COOKIE_NAME);

  // Bỏ qua các đường dẫn không cần check (API, static files, etc.)
  // Mặc dù matcher đã xử lý, kiểm tra ở đây để tăng độ an toàn.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.') // Bỏ qua các file có phần mở rộng (như favicon.ico)
  ) {
    return NextResponse.next();
  }

  // Nếu người dùng đã ở trang login, cho phép họ ở lại.
  // Trang login sẽ tự xử lý redirect nếu cần (client-side).
  if (pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  // --- Logic chính: Chỉ kiểm tra các trang được bảo vệ ---
  // Nếu không có cookie và đang cố truy cập trang bảo vệ => redirect
  if (!refreshTokenCookie) {
      console.log(`Middleware: No cookie on protected path ${pathname}, redirecting to /login`);
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // Nếu có cookie, cho phép truy cập. Client-side sẽ xác thực chi tiết.
  return NextResponse.next();
}

// Cấu hình matcher để chỉ chạy middleware trên các trang cần thiết.
// QUAN TRỌNG: Bỏ qua /login để tránh vòng lặp.
export const config = {
  matcher: [
      /*
       * Match all request paths except for the ones starting with:
       * - api (API routes)
       * - _next/static (static files)
       * - _next/image (image optimization files)
       * - favicon.ico (favicon file)
       * Và cũng loại trừ /login
       */
      '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
      // Thêm / nếu bạn muốn bảo vệ trang gốc
      '/',
  ],
};