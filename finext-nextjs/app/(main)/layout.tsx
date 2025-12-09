'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { useAuth } from 'components/AuthProvider';
import {
  AppBar, Box, CssBaseline, Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, CircularProgress, useTheme,
  IconButton as MuiIconButton, useMediaQuery, Breadcrumbs,
  alpha, Tooltip
} from '@mui/material';
import MuiLink from '@mui/material/Link';
import { SvgIconProps } from '@mui/material/SvgIcon';
import {
  Dashboard as DashboardIcon,
  Menu as MenuIcon,
  ChevronRight as ChevronRightIcon,
  BubbleChartOutlined,
  CategoryOutlined,
  InsightsOutlined,
  StarBorderPurple500Outlined
} from '@mui/icons-material';

import UserAvatar from '../../components/UserAvatar';
import ThemeToggleButton from 'components/ThemeToggleButton';
import BrandLogo from 'components/BrandLogo';
import SearchBar from '../../components/SearchBar';
import AuthButtons from '../../components/AuthButtons';
import { layoutTokens } from '../../theme/tokens';

interface NavItem {
  text: string;
  href: string;
  icon: React.ReactElement<SvgIconProps>;
}

const navigationStructure: NavItem[] = [
  { text: 'Phân tích nhóm', href: '/group-analysis', icon: <BubbleChartOutlined /> },
  { text: 'Phân tích ngành', href: '/sector-analysis', icon: <CategoryOutlined /> },
  { text: 'Phân tích cổ phiếu', href: '/stock-analysis', icon: <InsightsOutlined /> },
  { text: 'Danh sách theo dõi', href: '/watchlist', icon: <StarBorderPurple500Outlined /> },
];

// Top navigation tabs (like in Simplize)
const topNavTabs = [
  {
    label: 'Thị trường',
    href: '/markets',
    description: 'Tổng quan xu hướng, đánh giá rủi ro và xác định chu kỳ thị trường.',
    icon: 'fluent-color:poll-32'
  },
  {
    label: 'Dòng tiền',
    href: '/money-flow',
    description: 'Theo dấu dòng vốn thông minh và diễn biến thanh khoản theo thời gian thực.',
    icon: 'fluent-color:data-trending-16'
  },
  {
    label: 'Nhóm ngành',
    href: '/sectors',
    description: 'Đánh giá sức mạnh nhóm ngành và đón đầu sự luân chuyển dòng tiền.',
    icon: 'fluent-color:diversity-16'
  },
  {
    label: 'Cổ phiếu',
    href: '/stocks',
    description: 'Sàng lọc cơ hội đầu tư với bộ tiêu chí kỹ thuật và cơ bản chuyên sâu.',
    icon: 'fluent-color:list-bar-32'
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const currentPathname = usePathname();
  const theme = useTheme();

  const lgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const lgDown = useMediaQuery(theme.breakpoints.down('lg'));

  const [mobileOpen, setMobileOpen] = useState(false);

  // Drawer widths  
  const ICON_ONLY_WIDTH = 50;
  const drawerWidth = ICON_ONLY_WIDTH;
  const isMobile = lgDown;

  useEffect(() => {
    // Main pages can be accessed without authentication for public viewing
    // Remove redirect to login for public access
  }, [session, authLoading, router]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  // Show loading only while checking auth, but don't block access
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  const findBestMatch = () => {
    let bestMatch: NavItem | undefined;
    let longestMatchLength = 0;

    for (const item of navigationStructure) {
      if (currentPathname.startsWith(item.href) && item.href.length > longestMatchLength) {
        bestMatch = item;
        longestMatchLength = item.href.length;
      }
    }

    return { bestMatch };
  };

  const DesktopDrawerContent = (
    <>
      {/* Header with UserAvatar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: layoutTokens.appBarHeight,
          bgcolor: 'transparent',
        }}
      >
        <UserAvatar variant="icon" />
      </Box>

      {/* Navigation */}
      <Box sx={{
        flex: 1,
        px: 1,
      }}>
        <List sx={{ py: 1, width: '100%' }}>
          {navigationStructure.map((item) => {
            const isActive = item.href === '/' ? currentPathname === '/' : currentPathname.startsWith(item.href);
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <Tooltip
                  title={item.text}
                  placement="right"
                  arrow
                  slotProps={{
                    tooltip: {
                      sx: {
                        bgcolor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        '& .MuiTooltip-arrow': {
                          color: theme.palette.background.paper,
                        },
                      },
                    },
                  }}
                >
                  <Box sx={{ width: '100%' }}>
                    <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                      <ListItemButton
                        selected={isActive}
                        sx={{
                          minHeight: 48,
                          justifyContent: 'center',
                          px: 1,
                          borderRadius: '8px',
                          color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                          backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                            color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                          },
                          transition: theme.transitions.create(['background-color', 'color'], {
                            duration: theme.transitions.duration.shortest,
                          }),
                        }}
                      >
                        <ListItemIcon sx={{
                          minWidth: 24,
                          color: 'inherit',
                          justifyContent: 'center'
                        }}>
                          {React.cloneElement(item.icon, { sx: { fontSize: 20 } })}
                        </ListItemIcon>
                      </ListItemButton>
                    </Link>
                  </Box>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Theme Toggle Footer */}
      <Box sx={{ pb: 1, pl: 0.7, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <ThemeToggleButton variant="icon" />
      </Box>
    </>
  );

  const MobileDrawerContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: layoutTokens.appBarHeight,
          gap: 1,
        }}
      >
        <UserAvatar variant="full" />
      </Box>

      <List sx={{
        flexGrow: 1,
      }}>
        {/* Top Nav Tabs - Only visible on mobile */}
        {topNavTabs.map((tab) => {
          const isActive = currentPathname.startsWith(tab.href);
          return (
            <ListItem key={tab.href} disablePadding>
              <Link href={tab.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                <ListItemButton
                  selected={isActive}
                  onClick={handleDrawerToggle}
                  sx={{
                    pl: '20px',
                    color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                      color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                    },
                  }}
                >
                  <ListItemText primary={tab.label} />
                </ListItemButton>
              </Link>
            </ListItem>
          );
        })}

        {/* Drawer Navigation Items */}
        {navigationStructure.map((item) => {
          const isActive = currentPathname.startsWith(item.href);
          return (
            <ListItem key={item.text} disablePadding>
              <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                <ListItemButton
                  selected={isActive}
                  onClick={handleDrawerToggle}
                  sx={{
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                      '& .MuiListItemIcon-root': {
                        color: theme.palette.primary.main,
                      },
                      '& .MuiListItemText-root': {
                        color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: theme.palette.text.secondary, minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      color: isActive ? theme.palette.primary.main : theme.palette.text.primary
                    }}
                  />
                </ListItemButton>
              </Link>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ p: 1, mt: 'auto' }}>
        <ListItem disablePadding>
          <ThemeToggleButton variant="full" />
        </ListItem>
      </Box>
    </>
  );

  const generateBreadcrumbs = () => {
    const { bestMatch } = findBestMatch();

    let currentPageTitle = 'Page';
    let currentPageIcon = <ChevronRightIcon sx={{ mr: 0.5, fontSize: 'inherit' }} />;

    if (bestMatch) {
      currentPageTitle = bestMatch.text;
      currentPageIcon = React.cloneElement(bestMatch.icon, { sx: { mr: 0.5, fontSize: 'inherit' } });
    }

    return (
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{ color: 'text.secondary', '& .MuiBreadcrumbs-ol': { alignItems: 'center' }, '& .MuiBreadcrumbs-li': { display: 'flex', alignItems: 'center' } }}
      >
        <MuiLink component={Link} underline="hover" color="inherit" href="/dashboard" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
          <DashboardIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
          Dashboard
        </MuiLink>
        {currentPathname !== '/dashboard' && bestMatch && (
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }} variant="body2">
            {React.cloneElement(currentPageIcon, { sx: { mr: 0.5, fontSize: '1rem' } })}
            {currentPageTitle}
          </Typography>
        )}
      </Breadcrumbs>
    );
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: theme.palette.background.default }}>
      <CssBaseline />

      {/* APP BAR */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          height: layoutTokens.appBarHeight,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', // Thêm đổ bóng viền dưới
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`, // Thêm viền mỏng
          backdropFilter: 'blur(8px)', // Thêm hiệu ứng blur
        }}
      >

        <Toolbar sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: { xs: 2, lg: 3 },
          minHeight: `${layoutTokens.toolbarMinHeight}px !important`,
          height: layoutTokens.appBarHeight,
          maxHeight: layoutTokens.appBarHeight,
          width: '100%',
          maxWidth: 1430,
          mx: 'auto',
          gap: 2,
        }}>
          {/* Container bên trái, sẽ chứa logo và nút menu mobile */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'center', lg: 'flex-start' },
            position: 'relative',
            gap: 3,
          }}>
            {isMobile && (
              <MuiIconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{
                  position: 'absolute',
                  left: 0,
                  color: 'text.primary'
                }}
              >
                <MenuIcon />
              </MuiIconButton>
            )}
            <BrandLogo href="/" />

            {/* Top Navigation Tabs - Only visible on desktop */}
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {topNavTabs.map((tab) => {
                  const isActive = currentPathname.startsWith(tab.href);
                  return (
                    <Tooltip
                      key={tab.href}
                      title={
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                          <Icon icon={tab.icon} width="24" height="24" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {tab.label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                              {tab.description}
                            </Typography>
                          </Box>
                        </Box>
                      }
                      placement="bottom"
                      arrow
                      disableInteractive
                      enterDelay={200}
                      leaveDelay={0}
                      slotProps={{
                        tooltip: {
                          sx: {
                            bgcolor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                            '& .MuiTooltip-arrow': {
                              color: theme.palette.background.paper,
                            },
                          },
                        },
                      }}
                    >
                      <Link
                        href={tab.href}
                        passHref
                        style={{ textDecoration: 'none' }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            height: '30px',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '0.9rem',
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                            textTransform: 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            '&:hover': {
                              color: theme.palette.primary.main,
                              backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            },
                          }}
                        >
                          {tab.label}
                        </Box>
                      </Link>
                    </Tooltip>
                  );
                })}
              </Box>
            )}
            {/* {generateBreadcrumbs()} */}
          </Box>

          {/* Container bên phải cho thanh tìm kiếm và auth buttons */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1.5,
            mr: -1.1
          }}>
            {/* Thanh tìm kiếm luôn hiển thị */}
            <SearchBar variant="compact" />

            {/* Nút đăng nhập/đăng ký chỉ hiển thị khi chưa đăng nhập và không phải mobile */}
            {!session && !lgDown && (
              <AuthButtons />
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* NAV DRAWERS */}
      <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }} aria-label="sidebar">
        {/* Mobile Drawer (overlay) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          elevation={0}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              width: 280, // Mobile drawer has more width for text labels
              boxShadow: '4px 0 16px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(12px)',
            }
          }}
        >
          {MobileDrawerContent}
        </Drawer>

        {/* Desktop Drawer (expanded ↔ icon-only) */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '2px 0 8px rgba(0, 0, 0, 0.08)', // Thêm đổ bóng viền phải
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.12)}`, // Thêm viền mỏng
              backdropFilter: 'blur(8px)', // Thêm hiệu ứng blur
            }
          }}
          open
        >
          {DesktopDrawerContent}
        </Drawer>
      </Box>

      {/* MAIN */}
      <Box component="main" sx={{
        flexGrow: 1,
        width: { lg: `calc(100% - ${drawerWidth}px)` },
        height: '100vh',
        mt: `${layoutTokens.appBarHeight}px`,
        maxHeight: `calc(100vh - ${layoutTokens.appBarHeight}px)`,
        bgcolor: theme.palette.background.default,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <Box sx={{ width: '100%', maxWidth: 1400, minHeight: '100%' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
