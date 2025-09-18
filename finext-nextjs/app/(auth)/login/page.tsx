'use client';

import React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { GoogleOAuthProvider } from '@react-oauth/google';

import ThemeToggleButton from 'components/ThemeToggleButton';
import Gallery, { Slide } from 'components/Gallery';
import SignInForm from 'components/SignInForm';
import { layoutTokens } from 'theme/tokens';

const gallerySlides: Slide[] = [
  {
    overline: 'THẤU HIỂU DỮ LIỆU · CHINH PHỤC THỊ TRƯỜNG',
    headline: 'Insight đầu tư theo ngành',
    description:
      'Thông qua hệ thống các chỉ báo chuyên sâu, Findicator mang đến góc nhìn của những chuyên gia đầu ngành, giúp nhà đầu tư có thể tìm kiếm các cơ hội và ý tưởng đầu tư chất lượng.',
  },
  {
    overline: 'PHÂN TÍCH CHUYÊN SÂU · QUYẾT ĐỊNH ĐỘT PHÁ',
    headline: 'Báo cáo thị trường độc quyền',
    description:
      'Nhận các báo cáo phân tích chuyên sâu về từng ngành, xu hướng thị trường, và các yếu tố vĩ mô ảnh hưởng đến danh mục đầu tư của bạn. Luôn đi trước một bước với thông tin chi tiết.',
  },
  {
    overline: 'CÔNG CỤ HỖ TRỢ · TỐI ƯU HÓA LỢI NHUẬN',
    headline: 'Danh mục đầu tư thông minh',
    description:
      'Sử dụng các công cụ mạnh mẽ để xây dựng và quản lý danh mục đầu tư cá nhân hóa. Tối ưu hóa lợi nhuận và giảm thiểu rủi ro với các khuyến nghị được hỗ trợ bởi AI.',
  },
];

export default function SignInPage() {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const defaultChartComponent = (
    <Box
      sx={{
        position: 'relative',
        width: { md: '100%' },
        height: { md: layoutTokens.authGalleryHeight },
        borderRadius: 2,
        background: 'linear-gradient(180deg, rgba(10,8,20,0.86) 0%, rgba(12,10,28,0.92) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 60%, rgba(140,90,255,0.18), transparent 40%), radial-gradient(circle at 70% 30%, rgba(80,140,255,0.16), transparent 45%)',
        }}
      />
    </Box>
  );

  return (
    <>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 420px' },
          alignItems: 'center',
          width: 'min(1400px, 100%)',
          mx: 'auto',
          px: { xs: 2.5, lg: 6 },
          columnGap: { lg: 6 },
        }}
      >
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Gallery
            slides={gallerySlides}
            chartComponent={defaultChartComponent}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: { xs: 6, lg: 0 },
          }}
        >
          <Box sx={{ position: 'fixed', top: 16, right: 16 }}>
            <ThemeToggleButton />
          </Box>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            {googleClientId ? (
              <GoogleOAuthProvider clientId={googleClientId}>
                <SignInForm />
              </GoogleOAuthProvider>
            ) : (
              <SignInForm />
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}