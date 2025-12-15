'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import {
  PersonOutline,
  LockResetOutlined,
  DevicesOutlined,
  CardMembership,
  LogoutOutlined
} from '@mui/icons-material';
import { logoutApi } from 'services/authService';
import { fontSize } from 'theme/tokens';

interface ProfileLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { text: 'Thông tin cơ bản', icon: <PersonOutline />, href: '/profile/information' },
  { text: 'Gói đăng ký', icon: <CardMembership />, href: '/profile/subscriptions' },
  { text: 'Đổi mật khẩu', icon: <LockResetOutlined />, href: '/profile/change-password' },
  { text: 'Session đăng nhập', icon: <DevicesOutlined />, href: '/profile/login-sessions' },
];

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      console.log('Đang đăng xuất...');
      await logoutApi();
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      router.push('/login');
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        bgcolor: 'background.default',
      }}
    >
      {/* Sidebar */}
      <Box
        component="aside"
        sx={{
          width: { xs: 60, md: 260 },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          borderRight: 1,
          borderColor: 'divider',
          py: 1.5,
        }}
      >
        <List sx={{ flex: 1, pr: { xs: 1.5, md: 2 } }}>
          {menuItems.map((item) => (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={pathname === item.href}
                onClick={() => router.push(item.href)}
                sx={{
                  borderRadius: 1.5,
                  minHeight: 44,
                  justifyContent: { xs: 'center', md: 'flex-start' },
                  px: 1.5,
                  '&.Mui-selected': {
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(30, 255, 180, 0.1)'
                        : 'rgba(0, 150, 136, 0.1)',
                    '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? '#00FFAB' : '#00695c',
                    },
                  },
                  '&:hover': {
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'text.secondary',
                    minWidth: { xs: 0, md: 36 },
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    ml: { md: 0.5 },
                    '& .MuiListItemText-primary': {
                      fontSize: fontSize.base.tablet,
                      fontWeight: 500,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <List sx={{ pr: { xs: 1.5, md: 2 } }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 1.5,
                minHeight: 44,
                justifyContent: { xs: 'center', md: 'flex-start' },
                px: 1.5,
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 85, 85, 0.1)'
                      : 'rgba(220, 0, 78, 0.1)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? '#FF5555' : '#dc004e',
                  minWidth: { xs: 0, md: 36 },
                  justifyContent: 'center',
                }}
              >
                <LogoutOutlined />
              </ListItemIcon>
              <ListItemText
                primary="Đăng xuất"
                sx={{
                  display: { xs: 'none', md: 'block' },
                  ml: { md: 0.5 },
                  '& .MuiListItemText-primary': {
                    fontSize: fontSize.base.tablet,
                    fontWeight: 500,
                    color: (theme) =>
                      theme.palette.mode === 'dark' ? '#FF5555' : '#dc004e',
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          p: 2,
          bgcolor: 'background.paper',
          overflowY: 'auto',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}