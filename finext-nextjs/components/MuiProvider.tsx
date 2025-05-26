// finext-nextjs/components/MuiProvider.tsx
'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { ThemeProvider as MuiThemeProvider, createTheme, PaletteMode } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Định nghĩa màu sắc (giữ nguyên)
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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Tạo theme chỉ khi đã mounted và resolvedTheme có giá trị
  const muiTheme = React.useMemo(() => {
    // Nếu chưa mounted hoặc resolvedTheme chưa có (trường hợp hiếm),
    // có thể trả về một theme tạm thời hoặc theme sáng mặc định.
    // Tuy nhiên, logic render bên dưới sẽ không hiển thị children cho đến khi cả hai đều sẵn sàng.
    const mode = (mounted && resolvedTheme ? resolvedTheme : 'light') as PaletteMode;
    return createTheme({
      palette: {
        mode: mode,
        ...(mode === 'light' ? lightPalette : darkPalette),
      },
      components: {
          MuiAppBar: {
              styleOverrides: {
                  root: ({ theme }) => ({
                      backgroundColor: theme.palette.background.paper,
                      color: theme.palette.text.primary,
                      boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      // elevation: 0, // Bỏ đi nếu đã set ở AppBar component
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
                        // boxShadow: 'none', // Có thể bạn muốn giữ lại shadow mặc định của Paper
                    }
                }
            }
      },
    });
  }, [resolvedTheme, mounted]);

  // Chỉ render children khi đã mounted và resolvedTheme có giá trị.
  // Điều này giúp đảm bảo MuiThemeProvider được khởi tạo với theme đúng ngay từ đầu.
  if (!mounted || !resolvedTheme) {
    // Trong thời gian này, RootLayout hoặc DashboardLayout có thể đang hiển thị CircularProgress
    // Hoặc bạn có thể trả về một spinner ở đây nếu MuiProvider là lớp ngoài cùng hiển thị UI
    // return (
    //   <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    //     <CircularProgress />
    //   </Box>
    // );
    // Tạm thời trả về null để layout cấp cao hơn xử lý loading
    return null;
  }

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}