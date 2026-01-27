// finext-nextjs/app/layout.tsx
import { AuthProvider } from '@/components/auth/AuthProvider';
import { MuiProvider } from '@/components/provider/MuiProvider';
import { NextThemesProvider } from '@/components/provider/NextThemesProvider';
import { NotificationProvider } from '@/components/provider/NotificationProvider';
import './globals.css';

// Import Roboto font
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// THÊM IMPORT NÀY
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter'; // Hoặc v14/v15 nếu có, nhưng v13 thường dùng cho App Router
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Finext',
    template: '%s | Finext',
  },
  description: 'Finext - Nền tảng phân tích chứng khoán thông minh',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
        {/* Add Poppins font from Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, height: '100vh', overflow: 'auto' }}>
        {/* BỌC BÊN NGOÀI MuiProvider */}
        <AppRouterCacheProvider options={{ key: 'css' }}>
          <NextThemesProvider>
            <NotificationProvider>
              <AuthProvider>
                <MuiProvider>
                  <div style={{ minHeight: '100vh' }}>
                    {children}
                  </div>
                </MuiProvider>
              </AuthProvider>
            </NotificationProvider>
          </NextThemesProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}