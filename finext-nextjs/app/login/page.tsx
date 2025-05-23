// finext-nextjs/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient'; // Đảm bảo bạn đang dùng apiClient đã được tách logic refresh
import { saveSession } from '@/lib/session';
import { toast } from "sonner"; // Import toast từ sonner

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  // role_ids: string[]; // Giữ lại nếu bạn cần
}

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const loginParams = new URLSearchParams();
      loginParams.append('username', email);
      loginParams.append('password', password);

      const loginResponse = await apiClient<LoginResponse>({
        url: '/auth/login',
        method: 'POST',
        body: loginParams,
        isUrlEncoded: true,
        requireAuth: false,
      });

      if (loginResponse.status === 200 && loginResponse.data?.access_token) {
        const { access_token, refresh_token } = loginResponse.data;

        const userResponse = await apiClient<UserInfo>({
          url: '/auth/me',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
          // requireAuth: false, // Có thể đặt là true nếu apiClient đã xử lý tốt việc không có token ban đầu
        });

        if (userResponse.status === 200 && userResponse.data) {
          saveSession({
            user: {
              id: userResponse.data.id,
              email: userResponse.data.email,
              full_name: userResponse.data.full_name,
            },
            accessToken: access_token,
            refreshToken: refresh_token,
          });

          // Hiển thị thông báo thành công
          toast.success(`Chào mừng trở lại, ${userResponse.data.full_name || userResponse.data.email}!`, {
            description: "Đăng nhập thành công. Đang chuyển hướng...",
            duration: 3000, // Thông báo tự đóng sau 3 giây
          });

          // Chờ một chút để người dùng đọc thông báo rồi mới redirect
          setTimeout(() => {
            // Chuyển hướng về trang chủ (dashboard)
            // Dựa vào cấu trúc file của bạn, trang chủ dashboard có thể là '/' trong group (dashboard)
            // Hoặc '/dashboard' nếu nó không nằm trong group route đặc biệt.
            // Trong trường hợp này, file page.tsx của dashboard nằm ở app/(dashboard)/page.tsx
            // nên đường dẫn sẽ là '/' (vì (dashboard) là một group layout)
            router.push('/');
          }, 1500); // Chờ 1.5 giây

        } else {
          setError('Không thể lấy thông tin người dùng sau khi đăng nhập.');
          toast.error("Lỗi đăng nhập", { description: "Không thể lấy thông tin người dùng." });
        }
      } else {
        setError(loginResponse.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
        toast.error("Đăng nhập thất bại", { description: loginResponse.message || "Vui lòng kiểm tra lại thông tin." });
      }
    } catch (error: any) {
      setError(error.message || 'Lỗi kết nối đến server hoặc có lỗi xảy ra.');
      toast.error("Lỗi đăng nhập", { description: error.message || "Có lỗi xảy ra trong quá trình đăng nhập." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div>
          {/* Bạn có thể thêm Logo ở đây */}
          {/* <img className="mx-auto h-12 w-auto" src="/path-to-your-logo.svg" alt="Finext" /> */}
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Đăng nhập vào tài khoản
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Bỏ phần hiển thị lỗi cũ nếu muốn dùng toast cho tất cả */}
          {/* {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )} */}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Địa chỉ Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 sm:text-sm"
                placeholder="Địa chỉ Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 sm:text-sm"
                placeholder="Mật khẩu"
              />
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-800"
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}