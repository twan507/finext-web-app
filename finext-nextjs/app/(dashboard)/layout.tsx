// finext-nextjs/app/(dashboard)/layout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link'; // Using Next.js Link
import { useAuth } from 'components/AuthProvider';

// MUI Components
import {
  AppBar, Box, CssBaseline, Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, TextField, InputAdornment,
  CircularProgress, useTheme, IconButton as MuiIconButton,
  Tooltip,
  useMediaQuery,
  Badge,
  Breadcrumbs,
  alpha, // Thêm alpha để điều chỉnh độ trong suốt của màu
} from '@mui/material';
import MuiLink from '@mui/material/Link';

// Icons
import {
  Dashboard as DashboardIcon,
  PeopleOutline as PeopleIcon,
  Inventory2Outlined as ProductsIcon,
  BarChartOutlined as AnalyticsIcon,
  MailOutline as MessagesIcon,
  DescriptionOutlined as InvoicesIcon,
  SettingsOutlined as SettingsIcon,
  Logout as LogoutIcon,
  NotificationsNoneOutlined as NotificationsIcon,
  Search as SearchIcon,
  Menu as MenuIcon,
  ChevronRight as ChevronRightIcon,
  DiamondOutlined as LogoIcon,
} from '@mui/icons-material';

import UserMenu from './_components/UserMenu';
import ThemeToggleButton from 'components/ThemeToggleButton';

import { layoutTokens } from '../../theme/tokens';

const mainNavItems = [
  { text: 'Dashboard', href: '/', icon: <DashboardIcon /> },
  { text: 'Users', href: '/users', icon: <PeopleIcon /> },
  { text: 'Products', href: '/products', icon: <ProductsIcon /> },
  { text: 'Analytics', href: '/analytics', icon: <AnalyticsIcon /> },
  { text: 'Messages', href: '/messages', icon: <MessagesIcon /> },
  { text: 'Invoices', href: '/invoices', icon: <InvoicesIcon /> },
];

const bottomNavItems = [
  { text: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const currentPathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerWidth = layoutTokens.compactDrawerWidth;

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  if (authLoading || !session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  const drawerLinkStyles = (isActive: boolean) => ({
    p: theme.spacing(1.5),
    borderRadius: '8px',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // Màu chữ mặc định và khi active
    color: isActive
      ? (theme.palette.mode === 'light' ? theme.palette.grey[800] : theme.palette.primary.light) // Chữ active
      : theme.palette.text.secondary, // Chữ inactive
    // Màu nền khi active
    backgroundColor: isActive
      ? (theme.palette.mode === 'light' ? theme.palette.grey[200] : alpha(theme.palette.primary.light, 0.12)) // Nền active
      : 'transparent',
    '&:hover': {
      transform: 'scale(1.1)',
      // Màu nền khi hover (dù active hay inactive)
      backgroundColor: isActive
        ? (theme.palette.mode === 'light' ? theme.palette.grey[300] : alpha(theme.palette.primary.light, 0.20)) // Hover trên active
        : (theme.palette.mode === 'light' ? theme.palette.grey[100] : alpha(theme.palette.common.white, 0.08)), // Hover trên inactive
      // Màu chữ khi hover (dù active hay inactive)
      color: isActive
        ? (theme.palette.mode === 'light' ? theme.palette.grey[900] : theme.palette.primary.main) // Chữ hover trên active
        : (theme.palette.mode === 'light' ? theme.palette.grey[700] : theme.palette.grey[300]), // Chữ hover trên inactive
    },
    // Đảm bảo .Mui-selected cũng có style tương tự như active
    '&.Mui-selected': {
      color: theme.palette.mode === 'light' ? theme.palette.grey[800] : theme.palette.primary.light,
      backgroundColor: theme.palette.mode === 'light' ? theme.palette.grey[200] : alpha(theme.palette.primary.light, 0.12),
      '&:hover': {
        backgroundColor: theme.palette.mode === 'light' ? theme.palette.grey[300] : alpha(theme.palette.primary.light, 0.20),
        color: theme.palette.mode === 'light' ? theme.palette.grey[900] : theme.palette.primary.main,
      }
    },
    transition: theme.transitions.create(['transform', 'background-color', 'color'], {
      duration: theme.transitions.duration.shortest,
    }),
  });

  const drawerContent = (
    <>
      <Box sx={{ p: theme.spacing(2), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <LogoIcon sx={{ fontSize: '20px', color: 'text.secondary' }} />
      </Box>
      <List sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', py: theme.spacing(2), width: '100%'}}>
        {mainNavItems.map((item) => {
          const isActive = item.href === '/' ? currentPathname === '/' : currentPathname.startsWith(item.href);
          return (
            <ListItem key={item.text} disablePadding sx={{ width: 'auto', my: theme.spacing(0.75) }}>
              <Tooltip title={item.text} placement="right">
                <Link href={item.href} passHref style={{ textDecoration: 'none' }}>
                  <ListItemButton selected={isActive} sx={drawerLinkStyles(isActive)}>
                    <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                      {React.cloneElement(item.icon, { sx: { fontSize: '18px' }})}
                    </ListItemIcon>
                  </ListItemButton>
                </Link>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ pb: theme.spacing(2), display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {bottomNavItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ width: 'auto', my: theme.spacing(0.75) }}>
            <Tooltip title={item.text} placement="right">
              <Link href={item.href} passHref style={{ textDecoration: 'none' }}>
                <ListItemButton sx={drawerLinkStyles(currentPathname.startsWith(item.href))}>
                  <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                    {React.cloneElement(item.icon, { sx: { fontSize: '18px' }})}
                  </ListItemIcon>
                </ListItemButton>
              </Link>
            </Tooltip>
          </ListItem>
        ))}
        <ListItem disablePadding sx={{ width: 'auto', my: theme.spacing(0.75) }}>
          <Tooltip title="Logout" placement="right">
            <ListItemButton onClick={logout} sx={drawerLinkStyles(false)}>
              <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                <LogoutIcon sx={{ fontSize: '18px' }} />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </Box>
    </>
  );

  // ... (phần còn lại của component giữ nguyên)
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[50] : theme.palette.background.default }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          boxShadow: 'none',
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${theme.palette.divider}`,
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: theme.spacing(3), py: theme.spacing(0) }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isMobile && (
              <MuiIconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </MuiIconButton>
            )}
            {!isMobile && (
              <Breadcrumbs separator={<ChevronRightIcon fontSize="small" />} aria-label="breadcrumb" sx={{ color: 'text.secondary', '& .MuiTypography-root': { fontWeight: 500 }}}>
                <MuiLink component={Link} underline="hover" color="inherit" href="/">
                  Dashboard
                </MuiLink>
                <MuiLink component={Link} underline="hover" color="inherit" href="/analytics">
                  Analytics
                </MuiLink>
                <Typography color="text.disabled">Overview</Typography>
              </Breadcrumbs>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: theme.spacing(2) }}>
            {!isMobile && (
              <TextField
                variant="standard" 
                size="small"
                placeholder="Search..."
                InputProps={{
                  disableUnderline: true, 
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.grey[500] }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: '20px',
                    bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[100] : theme.palette.grey[800], // Điều chỉnh cho dark mode
                    px: theme.spacing(2),
                    py: theme.spacing(0.5),
                    fontSize: '0.875rem',
                    width: 256,
                    color: 'text.primary', // Đảm bảo chữ search có màu phù hợp
                    '&:focus-within': { 
                        bgcolor: 'background.paper', 
                        boxShadow: `0 0 0 1px ${theme.palette.divider}` 
                    }
                  }
                }}
              />
            )}
            <MuiIconButton sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
              <Tooltip title="Notifications">
                <Badge color="error" variant="dot" overlap="circular">
                  <NotificationsIcon sx={{ fontSize: '20px' }} />
                </Badge>
              </Tooltip>
            </MuiIconButton>
            <ThemeToggleButton />
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="sidebar"
      >
        <Drawer 
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: layoutTokens.drawerWidth, 
              bgcolor: 'background.paper',
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          <Box sx={{ p: theme.spacing(2), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
             <LogoIcon sx={{ fontSize: '20px', color: 'text.secondary' }} />
             <Typography variant="h6" sx={{ml:1}}>Finext</Typography>
          </Box>
          <List>
            {mainNavItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                  <ListItemButton selected={currentPathname.startsWith(item.href)} onClick={handleDrawerToggle}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </Link>
              </ListItem>
            ))}
          </List>
           <Box sx={{ p: theme.spacing(1)}}>
             {bottomNavItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                  <ListItemButton selected={currentPathname.startsWith(item.href)} onClick={handleDrawerToggle}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </Link>
              </ListItem>
            ))}
            <ListItem disablePadding>
                <ListItemButton onClick={() => { logout(); handleDrawerToggle(); }}>
                    <ListItemIcon><LogoutIcon/></ListItemIcon>
                    <ListItemText primary="Logout" />
                </ListItemButton>
            </ListItem>
           </Box>
        </Drawer>
        <Drawer 
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'flex' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              bgcolor: 'background.paper',
              borderRight: `1px solid ${theme.palette.divider}`,
              position: 'relative', 
              height: '100vh', 
              display: 'flex',
              flexDirection: 'column',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: theme.spacing(3), 
          width: { md: `calc(100% - ${drawerWidth}px)` },
          height: 'calc(100vh - 64px)', 
          mt: '64px', 
          overflowY: 'auto',
          bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[50] : theme.palette.background.default,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}