// finext-nextjs/app/login/page.tsx
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

          // Thông báo cơ bản nếu cần
          alert(`Chào mừng trở lại, ${userResponse.data.full_name || userResponse.data.email}! Đăng nhập thành công. Đang chuyển hướng...`);
          
          setTimeout(() => {
            router.push('/');
          }, 1500);

        } else {
          setError('Không thể lấy thông tin người dùng sau khi đăng nhập.');
        }
      } else {
        setError(loginResponse.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (error: any) {
      setError(error.message || 'Lỗi kết nối đến server hoặc có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        <div>
          {/* Bạn có thể thêm Logo ở đây */}
          {/* <img src="/path-to-your-logo.svg" alt="Finext" /> */}
          <h2>
            Đăng nhập vào tài khoản
          </h2>
        </div>
        
        <form onSubmit={handleSubmit}>
          {error && (
            <div>
              <p>{error}</p>
            </div>
          )}
          
          <div>
            <div>
              <label htmlFor="email">
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
                placeholder="Địa chỉ Email"
              />
            </div>
            <div>
              <label htmlFor="password">
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
                placeholder="Mật khẩu"
              />
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}