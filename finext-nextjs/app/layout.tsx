// finext-nextjs/app/layout.tsx
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { MuiProvider } from '@/components/provider/MuiProvider';
import { NextThemesProvider } from '@/components/provider/NextThemesProvider';
import { NotificationProvider } from '@/components/provider/NotificationProvider';
import './globals.css';

// Sử dụng local fonts - được bundle vào build, không cần fetch từ Google
import localFont from 'next/font/local';

const roboto = localFont({
  src: [
    { path: './fonts/Roboto-Light.ttf', weight: '300', style: 'normal' },
    { path: './fonts/Roboto-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Roboto-Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/Roboto-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-roboto',
  display: 'swap',
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
    template: 'Finext - %s',
  },
  description: 'Finext - Nền tảng phân tích chứng khoán thông minh',
  keywords: ['chứng khoán', 'phân tích', 'đầu tư', 'thị trường', 'cổ phiếu', 'Vietnam stock'],
  authors: [{ name: 'Finext Team' }],
  creator: 'Finext',
  metadataBase: new URL('https://finext.vn'),
  // Apple Touch Icon for iOS "Add to Home Screen"
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  // iOS PWA configuration
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finext',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Finext',
    title: 'Finext - Nền tảng phân tích chứng khoán thông minh',
    description: 'Công cụ phân tích chứng khoán chuyên sâu cho nhà đầu tư Việt Nam',
    images: [
      {
        url: '/finext-panel.png',
        width: 1200,
        height: 630,
        alt: 'Finext - Nền tảng phân tích chứng khoán thông minh',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finext - Nền tảng phân tích chứng khoán thông minh',
    description: 'Công cụ phân tích chứng khoán chuyên sâu cho nhà đầu tư Việt Nam',
    images: ['/finext-panel.png'],
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

// Loading fallback component - supports light/dark via data-theme & prefers-color-scheme
function RootLoading() {
  return (
    <div className="root-loading">
      <div className="root-loading-content">
        <img
          src="/finext-icon-trans.png"
          alt="Finext"
          width={48}
          height={48}
          className="root-loading-logo"
        />
        <div className="root-loading-dots">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <style>{`
        .root-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          width: 100%;
          background: #fafbfc;
          transition: background 0.2s;
        }
        .root-loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .root-loading-logo {
          width: 48px;
          height: auto;
          animation: logoFadeIn 0.6s ease-out;
        }
        .root-loading-dots {
          display: flex;
          gap: 6px;
        }
        .root-loading-dots > span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: #8b5cf6;
          animation: dotBounce 1.4s ease-in-out infinite both;
        }
        .root-loading-dots > span:nth-child(1) { animation-delay: -0.32s; }
        .root-loading-dots > span:nth-child(2) { animation-delay: -0.16s; }
        .root-loading-dots > span:nth-child(3) { animation-delay: 0s; }
        .root-loading-dots > span:nth-child(4) { animation-delay: 0.16s; }
        @keyframes dotBounce {
          0%, 80%, 100% {
            transform: scale(0.4);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes logoFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Dark mode via data-theme attribute (set by next-themes) */
        [data-theme="dark"] .root-loading {
          background: #0f0f0f;
        }

        /* Fallback: dark mode via system preference (before next-themes hydrates) */
        @media (prefers-color-scheme: dark) {
          html:not([data-theme="light"]) .root-loading {
            background: #0f0f0f;
          }
        }
      `}</style>
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
    <html lang="vi" suppressHydrationWarning className={roboto.variable}>
      <head>
        <meta charSet="utf-8" />
        {/* Register Service Worker for PWA installability */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
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