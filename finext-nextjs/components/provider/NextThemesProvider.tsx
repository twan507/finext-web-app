// finext-nextjs/@/components/NextThemesProvider.tsx
'use client';

import * as React from 'react';
import { ThemeProvider, ThemeProviderProps } from 'next-themes';

export function NextThemesProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <ThemeProvider
      attribute="data-theme" // Sử dụng data-theme
      defaultTheme="light"     // Light theme làm mặc định
      enableSystem           // Bật chế độ hệ thống
      disableTransitionOnChange // Tắt transition để tránh lỗi render
      {...props}
    >
      {children}
    </ThemeProvider>
  );
}