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

  const handleLogout = () => {
    console.log('Đăng xuất...');
    router.push('/login');
  };

  return (
    <Box
      sx={{
        height: '100%', // Sử dụng 100% thay vì 100vh
        width: '100%',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' },
        bgcolor: 'background.default', // Sử dụng màu nền mặc định của theme
        overflow: 'hidden', // Ngăn overflow
      }}
    >
      {/* ===== SIDEBAR CODE STARTS HERE ===== */}
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', md: 'flex' }, // Ẩn trên mobile
          flexDirection: 'column',
          height: '100%', // Sử dụng 100% thay vì 100vh
          bgcolor: 'background.paper',
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          px: 2,
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
                  minWidth: 40
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
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
              justifyContent: 'flex-start',
              textTransform: 'none',
              color: (theme) =>
                theme.palette.mode === 'dark'
                  ? '#FF5555'  // Bright red for dark
                  : '#dc004e', // Darker red for light mode
              p: '12px 16px',
              borderRadius: 2,
              fontSize: '0.875rem',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 85, 85, 0.1)'
                    : 'rgba(220, 0, 78, 0.1)', // Darker red tint for light mode
              },
            }}
          >
            Đăng xuất
          </Button>
        </Box>
      </Box>
      {/* ===== SIDEBAR CODE ENDS HERE ===== */}

      {/* Vùng nội dung chính của các trang con */}
      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          overflowY: 'auto',
          height: '100%', // Sử dụng 100% thay vì 100vh
          bgcolor: 'background.defult',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}