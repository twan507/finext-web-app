// finext-nextjs/app/layout.tsx
import { AuthProvider } from 'components/AuthProvider';
import { MuiProvider } from 'components/MuiProvider';
import { NextThemesProvider } from 'components/NextThemesProvider';
import { NotificationProvider } from 'components/NotificationProvider';
import './globals.css';

// Import Roboto font
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// THÊM IMPORT NÀY
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter'; // Hoặc v14/v15 nếu có, nhưng v13 thường dùng cho App Router

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
      <body>
        {/* BỌC BÊN NGOÀI MuiProvider */}
        <AppRouterCacheProvider options={{ key: 'css' }}>
          <NextThemesProvider>
            <NotificationProvider>
              <AuthProvider>
                <MuiProvider>
                  {children}
                </MuiProvider>
              </AuthProvider>
            </NotificationProvider>
          </NextThemesProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}