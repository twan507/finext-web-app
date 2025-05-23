// finext-nextjs/app/layout.tsx
import { AuthProvider } from '@/components/AuthProvider';
import { Toaster } from '@/components/ui/sonner'; // Giả sử bạn tạo file sonner.tsx trong components/ui
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
        <Toaster richColors position="top-right" /> {/* Thêm Toaster ở đây */}
      </body>
    </html>
  );
}