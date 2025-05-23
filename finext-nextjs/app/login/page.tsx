'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { saveSession } from '@/lib/session';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role_ids: string[];
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
      // Gọi trực tiếp API đăng nhập của FastAPI
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

        // Lấy thông tin user từ FastAPI
        const userResponse = await apiClient<UserInfo>({
          url: '/auth/me',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
          requireAuth: false,
        });

        if (userResponse.status === 200 && userResponse.data) {
          // Lưu session vào localStorage
          saveSession({
            user: {
              id: userResponse.data.id,
              email: userResponse.data.email,
              full_name: userResponse.data.full_name,
            },
            accessToken: access_token,
            refreshToken: refresh_token,
          });

          // Redirect đến dashboard
          router.push('/dashboard');
        } else {
          setError('Không thể lấy thông tin người dùng');
        }
      } else {
        setError(loginResponse.message || 'Đăng nhập thất bại');
      }
    } catch (error: any) {
      setError(error.message || 'Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold">Đăng nhập</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}