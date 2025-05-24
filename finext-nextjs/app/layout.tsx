// finext-nextjs/app/layout.tsx
import { AuthProvider } from 'components/AuthProvider';
import { MuiProvider } from 'components/MuiProvider';
import { NextThemesProvider } from 'components/NextThemesProvider';
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
      </head>
      <body>
        {/* BỌC BÊN NGOÀI MuiProvider */}
        <AppRouterCacheProvider options={{ key: 'css' }}> 
          <NextThemesProvider>
            <AuthProvider>
              <MuiProvider>
                {children}
              </MuiProvider>
            </AuthProvider>
          </NextThemesProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}