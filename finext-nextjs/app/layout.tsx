// finext-nextjs/app/layout.tsx
import { AuthProvider } from '@/components/AuthProvider';
import { MuiProvider } from '@/components/MuiProvider';
import { NextThemesProvider } from '@/components/NextThemesProvider';
import './globals.css';

// Import Roboto font
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // QUAN TRỌNG: Đảm bảo không có bất kỳ khoảng trắng, comment,
    // hay biểu thức JSX nào (như {" "}) giữa thẻ <html> mở và thẻ <head>.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Các thẻ meta, title, và link nên được đặt ở đây */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
        {/* Ví dụ: <title>Finext App</title> */}
      </head>
      <body>
        <NextThemesProvider>
          <AuthProvider>
            <MuiProvider>
              {children}
            </MuiProvider>
          </AuthProvider>
        </NextThemesProvider>
      </body>
    </html>
  );
}
