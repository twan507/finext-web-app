// filepath: finext-nextjs/types/next-auth.d.ts
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    accessToken?: string; // FastAPI access token
    refreshToken?: string; // FastAPI refresh token
    user: {
      id?: string | null; // FastAPI user ID
    } & DefaultSession['user']; // Giữ lại các trường mặc định của user
  }

  // Mở rộng đối tượng User được trả về bởi callback `authorize` và dùng trong callback `jwt`
  interface User {
    id?: string | null;
    accessToken?: string;
    refreshToken?: string;
    // Các trường khác bạn có thể trả về từ `authorize`
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    id?: string | null; // Thêm id từ FastAPI
  }
}