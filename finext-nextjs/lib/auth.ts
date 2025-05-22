// filepath: finext-nextjs/lib/auth.ts
import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from 'next-auth/providers/google';
import { apiClient, ApiErrorResponse, StandardApiResponse } from "./apiClient"; // Import thêm các kiểu

interface AuthenticatedUser {
  id: string;
  email?: string | null;
  name?: string | null;
  accessToken: string;
  refreshToken: string;
}

interface FastAPIUserPublic {
  id: string;
  email: string;
  full_name: string;
  role_ids: string[];
}

interface FastAPILoginResponseData {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: {  label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
          console.error("[Auth] Định dạng email hoặc mật khẩu không hợp lệ.");
          return null;
        }

        const loginParams = new URLSearchParams();
        loginParams.append('username', credentials.email);
        loginParams.append('password', credentials.password);

        try {
          // Gọi API đăng nhập của FastAPI
          const loginApiResponse = await apiClient<FastAPILoginResponseData>({
            url: '/auth/login/credentials',
            method: 'POST',
            body: loginParams, // URLSearchParams object
            isUrlEncoded: true, // Đánh dấu để apiClient xử lý Content-Type và body đúng cách
          });

                    // Nếu loginApiResponse không thành công hoặc thiếu token
          if (!(loginApiResponse.status === 200 && loginApiResponse.data?.access_token)) {
            // Ném AuthError với message từ API, hoặc một message chung
            throw new AuthError(loginApiResponse.message || "Thông tin đăng nhập không hợp lệ từ API.");
          }

          // Kiểm tra status bên trong payload của StandardApiResponse từ FastAPI
          if (loginApiResponse.status === 200 && loginApiResponse.data?.access_token) {
            const { access_token, refresh_token } = loginApiResponse.data;

            // Lấy thông tin user từ /auth/me bằng token vừa nhận
            const meApiResponse = await apiClient<FastAPIUserPublic>({
              url: '/auth/me',
              method: 'GET',
              headers: { // Truyền token mới một cách tường minh
                'Authorization': `Bearer ${access_token}`,
              }
            });

            if (meApiResponse.status === 200 && meApiResponse.data) {
              const userFromApi = meApiResponse.data;
              return {
                id: userFromApi.id,
                email: userFromApi.email,
                name: userFromApi.full_name,
                accessToken: access_token,
                refreshToken: refresh_token,
              } as AuthenticatedUser;
            } else {
              console.error("[Auth] /auth/me không thành công hoặc không có data:", meApiResponse.message || "Lỗi không xác định từ /auth/me");
              // Ném lỗi để NextAuth biết xác thực thất bại và truyền message
              throw new AuthError(meApiResponse.message || "Không thể lấy thông tin người dùng.");
            }
          } else {
            // Trường hợp loginApiResponse.status không phải 200 hoặc không có access_token
            // (mặc dù apiClient sẽ ném lỗi nếu HTTP status code không phải 2xx)
            console.error("[Auth] Đăng nhập API không thành công hoặc không có token:", loginApiResponse.message || "Dữ liệu token không hợp lệ.");
            throw new AuthError(loginApiResponse.message || "Thông tin đăng nhập không hợp lệ.");
          }
        } catch (error: any) {
          // error ở đây là ApiErrorResponse được ném từ apiClient
          console.error("[Auth] Lỗi trong quá trình authorize (từ apiClient):", JSON.stringify(error, null, 2));
          
          // Ném AuthError với message từ lỗi để NextAuth hiển thị
          // error.message ở đây là từ ApiErrorResponse
          throw new AuthError(error.message || "Lỗi xác thực từ máy chủ.");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      const authenticatedUser = user as AuthenticatedUser | undefined;
      if (account?.provider === "credentials" && authenticatedUser) {
        token.accessToken = authenticatedUser.accessToken;
        token.refreshToken = authenticatedUser.refreshToken;
        token.id = authenticatedUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accessToken) session.accessToken = token.accessToken as string;
      if (token.refreshToken) session.refreshToken = token.refreshToken as string;
      if (token.id && session.user) (session.user as any).id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    // error: '/auth/error', 
  },
  session: {
    strategy: "jwt",
  },
});