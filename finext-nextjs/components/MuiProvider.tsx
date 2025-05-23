// finext-nextjs/@/components/MuiProvider.tsx
'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { ThemeProvider as MuiThemeProvider, createTheme, PaletteMode } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Định nghĩa màu sắc (giống như trước)
const lightPalette = {
  primary: { main: '#1976d2' },
  secondary: { main: '#dc004e' },
  background: { default: '#f5f5f5', paper: '#ffffff' },
};

const darkPalette = {
  primary: { main: '#90caf9' },
  secondary: { main: '#f48fb1' },
  background: { default: '#121212', paper: '#1e1e1e' },
};

export function MuiProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme(); // Lấy theme đã giải quyết (light/dark)
  const [mounted, setMounted] = React.useState(false);

  // Đảm bảo chỉ render khi đã ở client side để lấy resolvedTheme chính xác
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const muiTheme = React.useMemo(() => {
    // Chỉ tạo theme khi đã mount và có resolvedTheme
    const mode = (mounted ? resolvedTheme : 'light') as PaletteMode;
    return createTheme({
      palette: {
        mode: mode,
        ...(mode === 'light' ? lightPalette : darkPalette),
      },
      // Thêm các overrides component MUI ở đây nếu cần (giống như trước)
      components: {
          MuiAppBar: {
              styleOverrides: {
                  root: ({ theme }) => ({
                      backgroundColor: theme.palette.background.paper,
                      color: theme.palette.text.primary,
                      boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      elevation: 0,
                  }),
              },
          },
          MuiDrawer: {
               styleOverrides: {
                  paper: ({ theme }) => ({
                      backgroundColor: theme.palette.background.paper,
                      borderRight: `1px solid ${theme.palette.divider}`,
                  }),
               }
          },
          MuiTableHead: {
               styleOverrides: {
                  root: ({ theme }) => ({
                       backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#2a2a2a',
                  }),
               }
          },
           MuiChip: {
            styleOverrides: {
              root: ({ theme, ownerState }) => ({
                 ...(ownerState.color === 'success' && {
                    backgroundColor: theme.palette.mode === 'light' ? '#e6f7ff' : '#003768',
                    color: theme.palette.mode === 'light' ? '#1890ff' : '#90caf9',
                 }),
                 ...(ownerState.color === 'default' && {
                    backgroundColor: theme.palette.mode === 'light' ? '#f5f5f5' : '#303030',
                    color: theme.palette.mode === 'light' ? '#595959' : '#bdbdbd',
                 })
              })
            }
          },
           MuiPaper: {
                styleOverrides: {
                    root: {
                        boxShadow: 'none',
                    }
                }
            }
      },
    });
  }, [resolvedTheme, mounted]);

  // Trong lần render đầu tiên phía client hoặc server, có thể render 1 loading state
  // hoặc theme mặc định để tránh FOUC, nhưng next-themes đã xử lý phần lớn
  // Ở đây chúng ta chỉ cần đảm bảo MuiThemeProvider nhận đúng theme khi client mount
  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}