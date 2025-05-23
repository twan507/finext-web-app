// finext-nextjs/app/layout.tsx
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css'; // Đảm bảo globals.css được import

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}