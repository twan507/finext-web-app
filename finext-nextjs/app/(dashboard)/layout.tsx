// finext-nextjs/app/(dashboard)/layout.tsx
'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Thêm usePathname
import Link from 'next/link'; // Thêm Link
import { useAuth } from 'components/AuthProvider';

// MUI Components
import {
  AppBar, Box, CssBaseline, Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, TextField, InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Dashboard as DashboardIcon, People as PeopleIcon, BarChart as BarChartIcon, // Giả sử Reports dùng BarChartIcon
  Layers as LayersIcon, // Giả sử Integrations dùng LayersIcon
  VpnKey as VpnKeyIcon, // Icon cho Roles
  Security as SecurityIcon, // Icon cho Permissions
  Search as SearchIcon,
  VpnLockOutlined as SessionsIcon, // Thêm icon cho Sessions
} from '@mui/icons-material';
import UserMenu from './_components/UserMenu';
import ThemeToggleButton from 'components/ThemeToggleButton';

const drawerWidth = 240;

interface NavItem {
  text: string;
  href: string;
  icon: React.ReactElement;
}

const navItems: NavItem[] = [
  { text: 'Dashboard', href: '/', icon: <DashboardIcon /> },
  { text: 'Users', href: '/users', icon: <PeopleIcon /> },
  { text: 'Roles', href: '/roles', icon: <VpnKeyIcon /> },
  { text: 'Permissions', href: '/permissions', icon: <SecurityIcon /> },
  { text: 'Sessions', href: '/sessions', icon: <SessionsIcon /> },
  // { text: 'Reports', href: '/reports', icon: <BarChartIcon /> },
  // { text: 'Integrations', href: '/integrations', icon: <LayersIcon /> },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  console.log("DashboardLayout: session", session);

  useEffect(() => {
    if (!authLoading && !session) {
        router.push('/login');
    }
  }, [session, authLoading, router]);

  if (authLoading || !session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
        }}
        elevation={0}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search..."
            InputProps={{
              startAdornment: ( <InputAdornment position="start"> <SearchIcon /> </InputAdornment> ),
              sx: { borderRadius: '8px' }
            }}
            sx={{ width: '300px' }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ThemeToggleButton />
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Finext Admin
          </Typography>
        </Toolbar>
        <List>
          {navItems.map((item) => {
            // Kiểm tra xem href có phải là trang gốc không và pathname có khớp chính xác không
            // Hoặc nếu href không phải trang gốc, kiểm tra pathname có bắt đầu bằng href không
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <ListItem key={item.text} disablePadding sx={{ px: 2, mb: 1 }}>
                <Link href={item.href} passHref style={{ textDecoration: 'none', width: '100%' }}>
                  <ListItemButton
                    selected={isActive}
                    sx={{
                        borderRadius: '8px',
                        color: isActive ? 'primary.main' : 'text.primary', // Màu chữ khi active
                        '&.Mui-selected': { // Style khi selected
                            backgroundColor: 'action.selected',
                            '&:hover': {
                                backgroundColor: 'action.hover',
                            },
                        },
                        '& .MuiListItemIcon-root': { // Màu icon khi active
                            color: isActive ? 'primary.main' : 'inherit',
                        }
                    }}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </Link>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          minHeight: '100vh'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}