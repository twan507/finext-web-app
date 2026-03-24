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
    default: 'Finext - Phân Tích và Sàng Lọc Cổ Phiếu Thông Minh',
    template: '%s | Finext',
  },
  description:
    'Nền tảng phân tích chứng khoán thông minh cho nhà đầu tư Việt Nam. ' +
    'Cung cấp dữ liệu thị trường, phân tích nhóm ngành, bộ lọc cổ phiếu, ' +
    'báo cáo chuyên sâu và công cụ hỗ trợ ra quyết định đầu tư.',
  keywords: [
    'finext',
    'chứng khoán',
    'phân tích cổ phiếu',
    'cổ phiếu Việt Nam',
    'thị trường chứng khoán',
    'VNINDEX',
    'VN30',
    'phân tích kỹ thuật',
    'phân tích cơ bản',
    'dòng tiền thị trường',
    'nhóm ngành chứng khoán',
    'bộ lọc cổ phiếu',
    'báo cáo thị trường',
    'đầu tư chứng khoán',
    'stock screener Vietnam',
  ],
  authors: [{ name: 'Finext Team' }],
  creator: 'Finext',
  publisher: 'Finext',
  metadataBase: new URL('https://finext.vn'),
  alternates: {
    canonical: 'https://finext.vn',
  },
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
    title: 'Finext - Phân Tích và Sàng Lọc Cổ Phiếu Thông Minh',
    description:
      'Nền tảng phân tích chứng khoán thông minh cho nhà đầu tư Việt Nam. ' +
      'Dữ liệu thị trường, phân tích nhóm ngành, bộ lọc cổ phiếu và báo cáo chuyên sâu.',
    url: 'https://finext.vn',
    images: [
      {
        url: '/finext-panel.png',
        width: 1200,
        height: 630,
        alt: 'Finext - Phân Tích và Sàng Lọc Cổ Phiếu Thông Minh',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finext - Phân Tích và Sàng Lọc Cổ Phiếu Thông Minh',
    description:
      'Nền tảng phân tích chứng khoán thông minh cho nhà đầu tư Việt Nam.',
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
        {/* JSON-LD Structured Data — WebSite + SiteNavigationElement for Google Sitelinks */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': 'https://finext.vn/#website',
                  url: 'https://finext.vn',
                  name: 'Finext',
                  alternateName: 'Finext - Your Next Financial Step',
                  description:
                    'Nền tảng phân tích chứng khoán thông minh cho nhà đầu tư Việt Nam',
                  inLanguage: 'vi',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: 'https://finext.vn/stocks?q={search_term_string}',
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://finext.vn/#organization',
                  name: 'Finext',
                  url: 'https://finext.vn',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://finext.vn/icons/icon-512x512.png',
                    width: 512,
                    height: 512,
                  },
                  contactPoint: {
                    '@type': 'ContactPoint',
                    email: 'finext.vn@gmail.com',
                    contactType: 'customer support',
                    availableLanguage: 'Vietnamese',
                  },
                  sameAs: [],
                },
                {
                  '@type': 'SiteNavigationElement',
                  name: 'Tổng quan thị trường',
                  url: 'https://finext.vn/markets',
                },
                {
                  '@type': 'SiteNavigationElement',
                  name: 'Cổ phiếu',
                  url: 'https://finext.vn/stocks',
                },
                {
                  '@type': 'SiteNavigationElement',
                  name: 'Tin tức',
                  url: 'https://finext.vn/news',
                },
                {
                  '@type': 'SiteNavigationElement',
                  name: 'Nhóm ngành',
                  url: 'https://finext.vn/sectors',
                },
                {
                  '@type': 'SiteNavigationElement',
                  name: 'Báo cáo',
                  url: 'https://finext.vn/reports',
                },
                {
                  '@type': 'SiteNavigationElement',
                  name: 'Chính sách bảo mật',
                  url: 'https://finext.vn/policies/privacy',
                },
              ],
            }),
          }}
        />
        {/* Register Service Worker for PWA installability */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
              (function() {
                var isPWA = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
                if (!isPWA) return;
                var suffix = ' | Finext';
                function strip() { if (document.title.endsWith(suffix)) document.title = document.title.slice(0, -suffix.length); }
                strip();
                new MutationObserver(strip).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
              })();
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