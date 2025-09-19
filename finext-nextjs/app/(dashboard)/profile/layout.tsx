'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Button, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import {
  PersonOutline,
  LockResetOutlined,
  DevicesOutlined,
  LogoutOutlined
} from '@mui/icons-material';
import { logoutApi } from 'services/authService';

interface ProfileLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { text: 'Thông tin cơ bản', icon: <PersonOutline />, href: '/profile/information' },
  { text: 'Đổi mật khẩu', icon: <LockResetOutlined />, href: '/profile/change-password' },
  { text: 'Session đăng nhập', icon: <DevicesOutlined />, href: '/profile/login-sessions' },
];

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      console.log('Đang đăng xuất...');
      await logoutApi(); // Gọi API logout để xóa cookie và session
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      // Vẫn redirect về login nếu có lỗi
      router.push('/login');
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: { xs: '64px minmax(0, 1fr)', md: '280px minmax(0, 1fr)' },
        bgcolor: 'background.default', // Sử dụng màu nền mặc định của theme
      }}
    >
      {/* ===== SIDEBAR CODE STARTS HERE ===== */}
      <Box
        component="aside"
        sx={{
          display: 'flex', // Luôn hiển thị sidebar
          flexDirection: 'column',
          bgcolor: 'background.default',
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          px: { xs: 1, md: 2 }, // Giảm padding trên mobile
          py: 2,
          overflow: 'hidden', // Ngăn overflow cho sidebar
        }}
      >
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {menuItems.map((item) => (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                selected={pathname === item.href}
                onClick={() => router.push(item.href)}
                sx={{
                  borderRadius: 2,
                  minHeight: 48, // Đảm bảo chiều cao tối thiểu
                  justifyContent: { xs: 'center', md: 'flex-start' }, // Center icon trên mobile
                  px: { xs: 0, md: 2 }, // Không padding horizontal trên mobile
                  '&.Mui-selected': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(30, 255, 180, 0.1)'
                        : 'rgba(0, 150, 136, 0.1)', // Green tint for light mode
                    '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
                      color: (theme) =>
                        theme.palette.mode === 'dark'
                          ? '#00FFAB'  // Bright green for dark
                          : '#00695c', // Darker green for light mode
                    },
                  },
                  '&:hover': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <ListItemIcon sx={{
                  color: 'text.secondary',
                  minWidth: { xs: 'unset', md: 40 }, // Không minWidth trên mobile
                  justifyContent: 'center'
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    display: { xs: 'none', md: 'block' }, // Ẩn text trên mobile
                    color: 'text.primary',
                    '& .MuiListItemText-primary': {
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ mt: 'auto' }}>
          <Button
            fullWidth
            startIcon={<LogoutOutlined />}
            onClick={handleLogout}
            sx={{
              justifyContent: { xs: 'center', md: 'flex-start' }, // Center trên mobile
              textTransform: 'none',
              color: (theme) =>
                theme.palette.mode === 'dark'
                  ? '#FF5555'  // Bright red for dark
                  : '#dc004e', // Darker red for light mode
              p: { xs: '12px 8px', md: '12px 16px' }, // Giảm padding trên mobile
              borderRadius: 2,
              fontSize: '0.875rem',
              fontWeight: 500,
              minWidth: { xs: 48, md: 'auto' }, // Đảm bảo chiều rộng tối thiểu trên mobile
              '&:hover': {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 85, 85, 0.1)'
                    : 'rgba(220, 0, 78, 0.1)', // Darker red tint for light mode
              },
              '& .MuiButton-startIcon': {
                margin: { xs: 0, md: '0 8px 0 0' }, // Không margin trên mobile
              },
            }}
          >
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              Đăng xuất
            </Box>
          </Button>
        </Box>
      </Box>
      {/* ===== SIDEBAR CODE ENDS HERE ===== */}

      {/* Vùng nội dung chính của các trang con */}
      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          bgcolor: 'background.paper',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}