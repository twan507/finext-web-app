// finext-nextjs/app/layout.tsx
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { MuiProvider } from '@/components/provider/MuiProvider';
import { NextThemesProvider } from '@/components/provider/NextThemesProvider';
import { NotificationProvider } from '@/components/provider/NotificationProvider';
import './globals.css';

// Optimized font loading với next/font
import { Roboto, Poppins } from 'next/font/google';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-roboto',
});

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import type { Metadata, Viewport } from 'next';

// Viewport configuration tách riêng (Next.js 14+ best practice)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafbfc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Finext',
    template: '%s | Finext',
  },
  description: 'Finext - Nền tảng phân tích chứng khoán thông minh',
  keywords: ['chứng khoán', 'phân tích', 'đầu tư', 'thị trường', 'cổ phiếu', 'Vietnam stock'],
  authors: [{ name: 'Finext Team' }],
  creator: 'Finext',
  metadataBase: new URL('https://finext.vn'),
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Finext',
    title: 'Finext - Nền tảng phân tích chứng khoán thông minh',
    description: 'Công cụ phân tích chứng khoán chuyên sâu cho nhà đầu tư Việt Nam',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finext - Nền tảng phân tích chứng khoán thông minh',
    description: 'Công cụ phân tích chứng khoán chuyên sâu cho nhà đầu tư Việt Nam',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// Loading fallback component
function RootLoading() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--background, #fafbfc)'
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid #e0e0e0',
        borderTop: '3px solid #8b5cf6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ... imports
import QueryProvider from './QueryProvider';

// ... (RootLoading function)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${roboto.variable} ${poppins.variable}`}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className={roboto.className} style={{ margin: 0 }}>
        {/* AppRouterCacheProvider tối ưu emotion cache cho MUI */}
        <AppRouterCacheProvider options={{ key: 'css' }}>
          <NextThemesProvider>
            <NotificationProvider>
              <AuthProvider>
                <MuiProvider>
                  <QueryProvider>
                    {/* Suspense boundary cho page transitions */}
                    <Suspense fallback={<RootLoading />}>
                      <div style={{ minHeight: '100vh' }}>
                        {children}
                      </div>
                    </Suspense>
                  </QueryProvider>
                </MuiProvider>
              </AuthProvider>
            </NotificationProvider>
          </NextThemesProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}