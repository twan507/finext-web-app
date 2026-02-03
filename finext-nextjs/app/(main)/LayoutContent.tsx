'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  AppBar, Box, CssBaseline, Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, CircularProgress, useTheme,
  IconButton as MuiIconButton, useMediaQuery, Breadcrumbs,
  alpha, Tooltip, Collapse
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
  StarBorderPurple500Outlined,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

import UserAvatar from '../../components/layout/UserAvatar';
import ThemeToggleButton from '@/components/themeToggle/ThemeToggleButton';
import BrandLogo from '@/components/layout/BrandLogo';
import SearchBar from '../../components/layout/SearchBar';
import Footer from '@/components/layout/Footer';
import { layoutTokens, iconSize, borderRadius, shadows, transitions, spacing, getResponsiveFontSize, fontWeight } from '../../theme/tokens';
import AuthButtons from '@/components/auth/AuthButtons';
import ConsultationSection from './components/ConsultationSection';

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
interface NavSubmenuItem {
  label: string;
  href: string;
  icon: string;
  description?: string;
}

interface TopNavTab {
  label: string;
  href: string;
  description: string;
  icon: string;
  submenu?: NavSubmenuItem[];
}

const topNavTabs: TopNavTab[] = [
  {
    label: 'Thị trường',
    href: '/markets',
    description: 'Tổng quan xu hướng, đánh giá rủi ro và xác định chu kỳ thị trường.',
    icon: 'fluent-color:poll-32',
    submenu: [
      { label: 'Diễn biến thị trường', href: '/markets', icon: 'fluent-color:chart-multiple-20', description: 'Theo dõi diễn biến và xu hướng thị trường chứng khoán' },
      { label: 'Giai đoạn thị trường', href: '/markets/phases', icon: 'fluent-color:arrow-trending-lines-20', description: 'Phân tích và xác định giai đoạn chu kỳ thị trường' },
    ]
  },
  {
    label: 'Nhóm ngành',
    href: '/sectors',
    description: 'Đánh giá sức mạnh nhóm ngành và đón đầu sự luân chuyển dòng tiền.',
    icon: 'fluent-color:diversity-16'
  },
  {
    label: 'Tin tức',
    href: '/news',
    description: 'Cập nhật tin tức thị trường tài chính và các sự kiện nổi bật.',
    icon: 'fluent-color:book-database-32',
    submenu: [
      { label: 'Tin tức', href: '/news', icon: 'fluent-color:news-28', description: 'Tổng hợp tin tức vĩ mô và tài chính từ nhiều nguồn uy tín' },
      { label: 'Bản tin', href: '/reports', icon: 'fluent-color:document-edit-24', description: 'Bản tin tổng hợp và phân tích tin tức hàng ngày' },
    ]
  },
  {
    label: 'Cổ phiếu',
    href: '/stocks',
    description: 'Công cụ phân tích và sàng lọc cổ phiếu chuyên nghiệp.',
    icon: 'fluent-color:search-sparkle-16',
    submenu: [
      { label: 'Bộ lọc thông minh', href: '/stocks', icon: 'fluent-color:list-bar-32', description: 'Sàng lọc cơ hội đầu tư với bộ tiêu chí kỹ thuật và cơ bản' },
      { label: 'Biểu đồ kĩ thuật', href: '/charts', icon: 'fluent-color:data-trending-16', description: 'Công cụ vẽ biểu đồ kỹ thuật chuyên nghiệp' },
    ]
  },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const currentPathname = usePathname();
  const theme = useTheme();

  // Responsive breakpoints: Desktop (lg+), Tablet (md-lg), Mobile (sm-)
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 768px - 1199px
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 768px

  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  // Drawer widths  
  const ICON_ONLY_WIDTH = 50;
  const drawerWidth = ICON_ONLY_WIDTH;
  // Show hamburger menu for both Tablet and Mobile
  const showHamburgerMenu = !isDesktop;

  useEffect(() => {
    // Main pages can be accessed without authentication for public viewing
    // Remove redirect to login for public access
  }, [session, authLoading, router]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleMenuToggle = (href: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [href]: !prev[href]
    }));
  };

  // OPTIMIZED: Không block render khi auth đang loading
  // Public pages sẽ render ngay, auth state sẽ được hydrate sau
  // Chỉ các UI elements phụ thuộc vào auth (như UserAvatar) sẽ hiển thị skeleton

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
        <List sx={{ py: 1, mt: 2, width: '100%' }}>
          {navigationStructure.map((item) => {
            const isActive = item.href === '/' ? currentPathname === '/' : currentPathname.startsWith(item.href);
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 2 }}>
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
                          borderRadius: borderRadius.md,
                          color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                          backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                            color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                          },
                          transition: transitions.colors,
                        }}
                      >
                        <ListItemIcon sx={{
                          minWidth: 24,
                          color: 'inherit',
                          justifyContent: 'center'
                        }}>
                          {React.cloneElement(item.icon, { sx: { fontSize: iconSize.nav.desktop } })}
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
      <Box sx={{ pb: 1, pl: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <ThemeToggleButton variant="icon" />
      </Box>
    </>
  );

  // Tablet Drawer Content - More spacious, shows description
  const TabletDrawerContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          mt: 1,
          px: 1,
        }}
      >
        <UserAvatar variant="full" onNavigate={handleDrawerToggle} />
      </Box>

      <List sx={{ flexGrow: 1, px: 1 }}>
        {/* Top Nav Tabs */}
        <Typography variant="caption" sx={{ pl: 2, py: 1, color: 'text.secondary', textTransform: 'uppercase', fontWeight: fontWeight.semibold }}>
          Khám phá
        </Typography>
        {topNavTabs.map((tab) => {
          const isActive = currentPathname.startsWith(tab.href) ||
            (tab.submenu && tab.submenu.some(sub => currentPathname.startsWith(sub.href)));
          const hasSubmenu = tab.submenu && tab.submenu.length > 0;
          const isExpanded = expandedMenus[tab.href];

          return (
            <React.Fragment key={tab.href}>
              <ListItem disablePadding sx={{ mb: 0.5, flexDirection: 'column', alignItems: 'stretch' }}>
                {hasSubmenu ? (
                  <>
                    <ListItemButton
                      onClick={() => handleMenuToggle(tab.href)}
                      sx={{
                        borderRadius: borderRadius.sm,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          color: theme.palette.primary.main,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                        <Icon icon={tab.icon} width="20" height="20" />
                      </ListItemIcon>
                      <ListItemText primary={tab.label} />
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {tab.submenu!.map((subItem) => {
                          const isSubActive = currentPathname === subItem.href ||
                            (subItem.href !== '/news' && subItem.href !== '/reports' && subItem.href !== '/markets' && currentPathname.startsWith(subItem.href));
                          return (
                            <Link key={subItem.href} href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit' }}>
                              <ListItemButton
                                onClick={handleDrawerToggle}
                                sx={{
                                  pl: 4,
                                  borderRadius: borderRadius.sm,
                                  color: theme.palette.text.secondary,
                                  '&:hover': {
                                    color: theme.palette.primary.main,
                                  },
                                }}
                              >
                                <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                                  <Icon icon={subItem.icon} width="18" height="18" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={subItem.label}
                                  primaryTypographyProps={{ fontSize: getResponsiveFontSize('sm') }}
                                />
                              </ListItemButton>
                            </Link>
                          );
                        })}
                      </List>
                    </Collapse>
                  </>
                ) : (
                  <Link href={tab.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                    <ListItemButton
                      onClick={handleDrawerToggle}
                      sx={{
                        borderRadius: borderRadius.sm,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          color: theme.palette.primary.main,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                        <Icon icon={tab.icon} width="20" height="20" />
                      </ListItemIcon>
                      <ListItemText primary={tab.label} />
                    </ListItemButton>
                  </Link>
                )}
              </ListItem>
            </React.Fragment>
          );
        })}

        {/* Drawer Navigation Items */}
        <Typography variant="caption" sx={{ pl: 2, py: 1, mt: 1, display: 'block', color: 'text.secondary', textTransform: 'uppercase', fontWeight: fontWeight.semibold }}>
          Công cụ
        </Typography>
        {navigationStructure.map((item) => {
          const isActive = currentPathname.startsWith(item.href);
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                <ListItemButton
                  selected={isActive}
                  onClick={handleDrawerToggle}
                  sx={{
                    borderRadius: borderRadius.sm,
                    color: theme.palette.text.primary,
                    '&:hover': {
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </Link>
            </ListItem>
          );
        })}
      </List>

      {/* Divider */}
      <Box sx={{ mx: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}` }} />

      <Box sx={{ py: 1, px: 1 }}>
        <ThemeToggleButton variant="full" />
      </Box>
    </>
  );

  // Mobile Drawer Content - Same as tablet but smaller fonts, no descriptions
  const MobileDrawerContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          mt: 1,
          px: 1,
        }}
      >
        <UserAvatar variant="full" onNavigate={handleDrawerToggle} compact />
      </Box>

      <List sx={{ flexGrow: 1, px: 1 }}>
        {/* Top Nav Tabs - No descriptions, smaller fonts */}
        <Typography variant="caption" sx={{ pl: 2, py: 0.5, color: 'text.secondary', textTransform: 'uppercase', fontWeight: fontWeight.semibold, fontSize: getResponsiveFontSize('xs') }}>
          Khám phá
        </Typography>
        {topNavTabs.map((tab) => {
          const isActive = currentPathname.startsWith(tab.href) ||
            (tab.submenu && tab.submenu.some(sub => currentPathname.startsWith(sub.href)));
          const hasSubmenu = tab.submenu && tab.submenu.length > 0;
          const isExpanded = expandedMenus[tab.href];

          return (
            <React.Fragment key={tab.href}>
              <ListItem disablePadding sx={{ mb: 0.25, flexDirection: 'column', alignItems: 'stretch' }}>
                {hasSubmenu ? (
                  <>
                    <ListItemButton
                      onClick={() => handleMenuToggle(tab.href)}
                      sx={{
                        py: 1,
                        borderRadius: borderRadius.sm,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          color: theme.palette.primary.main,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                        <Icon icon={tab.icon} width="18" height="18" />
                      </ListItemIcon>
                      <ListItemText primary={tab.label} primaryTypographyProps={{ fontSize: getResponsiveFontSize('md') }} />
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </ListItemButton>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {tab.submenu!.map((subItem) => {
                          const isSubActive = currentPathname === subItem.href ||
                            (subItem.href !== '/news' && subItem.href !== '/reports' && subItem.href !== '/markets' && currentPathname.startsWith(subItem.href));
                          return (
                            <Link key={subItem.href} href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit' }}>
                              <ListItemButton
                                onClick={handleDrawerToggle}
                                sx={{
                                  pl: 4,
                                  py: 0.75,
                                  borderRadius: borderRadius.sm,
                                  color: theme.palette.text.secondary,
                                  '&:hover': {
                                    color: theme.palette.primary.main,
                                  },
                                }}
                              >
                                <ListItemIcon sx={{ color: 'inherit', minWidth: 28 }}>
                                  <Icon icon={subItem.icon} width="16" height="16" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={subItem.label}
                                  primaryTypographyProps={{ fontSize: getResponsiveFontSize('sm') }}
                                />
                              </ListItemButton>
                            </Link>
                          );
                        })}
                      </List>
                    </Collapse>
                  </>
                ) : (
                  <Link href={tab.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                    <ListItemButton
                      onClick={handleDrawerToggle}
                      sx={{
                        py: 1,
                        borderRadius: borderRadius.sm,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          color: theme.palette.primary.main,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                        <Icon icon={tab.icon} width="18" height="18" />
                      </ListItemIcon>
                      <ListItemText primary={tab.label} primaryTypographyProps={{ fontSize: getResponsiveFontSize('md') }} />
                    </ListItemButton>
                  </Link>
                )}
              </ListItem>
            </React.Fragment>
          );
        })}

        {/* Drawer Navigation Items */}
        <Typography variant="caption" sx={{ pl: 2, py: 0.5, mt: 1, display: 'block', color: 'text.secondary', textTransform: 'uppercase', fontWeight: fontWeight.semibold, fontSize: getResponsiveFontSize('xs') }}>
          Công cụ
        </Typography>
        {navigationStructure.map((item) => {
          const isActive = currentPathname.startsWith(item.href);
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
              <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                <ListItemButton
                  selected={isActive}
                  onClick={handleDrawerToggle}
                  sx={{
                    py: 1,
                    borderRadius: borderRadius.sm,
                    color: theme.palette.text.primary,
                    '&:hover': {
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                    {React.cloneElement(item.icon, { sx: { fontSize: iconSize.menu.mobile } })}
                  </ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: getResponsiveFontSize('md') }} />
                </ListItemButton>
              </Link>
            </ListItem>
          );
        })}
      </List>

      {/* Divider */}
      <Box sx={{ mx: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}` }} />

      <Box sx={{ py: 1, px: 1 }}>
        <ThemeToggleButton variant="full" compact />
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
          <DashboardIcon sx={{ mr: 0.5, fontSize: iconSize.breadcrumb.desktop }} />
          Dashboard
        </MuiLink>
        {currentPathname !== '/dashboard' && bestMatch && (
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }} variant="body2">
            {React.cloneElement(currentPageIcon, { sx: { mr: 0.5, fontSize: iconSize.breadcrumb.desktop } })}
            {currentPageTitle}
          </Typography>
        )}
      </Breadcrumbs>
    );
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <CssBaseline />

      {/* NAV DRAWERS */}
      <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }} aria-label="sidebar">
        {/* Tablet Drawer (overlay) - 768px to 1199px */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          elevation={0}
          aria-label="Menu điều hướng"
          sx={{
            display: { xs: 'none', md: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              width: 320,
              boxShadow: shadows.drawer,
              backdropFilter: 'blur(12px)',
            }
          }}
        >
          {TabletDrawerContent}
        </Drawer>

        {/* Mobile Drawer (overlay) - below 768px */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          elevation={0}
          aria-label="Menu điều hướng"
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: 260,
              boxShadow: shadows.drawer,
              backdropFilter: 'blur(12px)',
            }
          }}
        >
          {MobileDrawerContent}
        </Drawer>

        {/* Desktop Drawer (permanent) - 1200px and above */}
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
              boxShadow: shadows.appBar,
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
              backdropFilter: 'blur(8px)',
            }
          }}
          open
        >
          {DesktopDrawerContent}
        </Drawer>
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0, // Fix flex item not shrinking (chart resize issue)
        }}
      >
        {/* APP BAR - sticky trong container */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            top: 0,
            zIndex: theme.zIndex.appBar,
            height: layoutTokens.appBarHeight,
            boxShadow: shadows.appBar,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <Toolbar sx={{
            minHeight: `${layoutTokens.toolbarMinHeight}px !important`,
            height: layoutTokens.appBarHeight,
            maxHeight: layoutTokens.appBarHeight,
            px: { xs: 1.5, md: 2, lg: 3 }, // Mobile: 12px, Tablet: 16px, Desktop: 24px
          }}>
            {/* Inner container - cùng maxWidth với main content để căn thẳng hàng */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              maxWidth: 1400,
              mx: 'auto',
              gap: 2,
              position: 'relative',
            }}>
              {/* Container bên trái cho hamburger menu và desktop navigation */}
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 3,
              }}>
                {showHamburgerMenu && (
                  <MuiIconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={handleDrawerToggle}
                    sx={{
                      color: 'text.primary',
                      '&:hover': {
                        color: theme.palette.primary.main,
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    <MenuIcon />
                  </MuiIconButton>
                )}

                {/* Logo - centered on mobile/tablet, left-aligned on desktop */}
                {!showHamburgerMenu && <BrandLogo href="/" />}

                {/* Top Navigation Tabs - Only visible on desktop */}
                {isDesktop && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {topNavTabs.map((tab) => {
                      const isActive = currentPathname.startsWith(tab.href) ||
                        (tab.submenu && tab.submenu.some(sub => currentPathname.startsWith(sub.href)));
                      const hasSubmenu = tab.submenu && tab.submenu.length > 0;

                      // For tabs with submenu, use a different approach
                      if (hasSubmenu) {
                        return (
                          <Box
                            key={tab.href}
                            sx={{
                              position: 'relative',
                              '&:hover .nav-dropdown': {
                                opacity: 1,
                                visibility: 'visible',
                                transform: 'translateY(0)',
                              },
                            }}
                          >
                            <Link href={tab.href} passHref style={{ textDecoration: 'none' }}>
                              <Box
                                sx={{
                                  px: 2,
                                  height: '30px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: getResponsiveFontSize('md'),
                                  fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                  color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                                  textTransform: 'none',
                                  transition: transitions.colors,
                                  cursor: 'pointer',
                                  borderRadius: borderRadius.sm,
                                  '&:hover': {
                                    color: theme.palette.primary.main,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                  },
                                }}
                              >
                                {tab.label}
                              </Box>
                            </Link>

                            {/* Dropdown menu */}
                            <Box
                              className="nav-dropdown"
                              sx={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                mt: 0.5,
                                minWidth: 280,
                                bgcolor: 'background.paper',
                                borderRadius: `${borderRadius.md}px`,
                                boxShadow: shadows.lg,
                                py: 1,
                                opacity: 0,
                                visibility: 'hidden',
                                transform: 'translateY(-8px)',
                                transition: 'all 0.2s ease-in-out',
                                zIndex: theme.zIndex.tooltip,
                              }}
                            >
                              {tab.submenu!.map((subItem) => {
                                const isSubActive = currentPathname === subItem.href ||
                                  (subItem.href !== '/news' && subItem.href !== '/reports' && currentPathname.startsWith(subItem.href));
                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    style={{ textDecoration: 'none' }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 1.5,
                                        px: 2,
                                        py: 1,
                                        color: theme.palette.text.primary,
                                        '&:hover': {
                                          color: theme.palette.primary.main,
                                        },
                                        transition: transitions.colors,
                                      }}
                                    >
                                      <Icon icon={subItem.icon} width="24" height="24" style={{ marginTop: '2px', flexShrink: 0 }} />
                                      <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: fontWeight.semibold, mb: 0.5 }}>
                                          {subItem.label}
                                        </Typography>
                                        {subItem.description && (
                                          <Typography variant="body2" sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                            {subItem.description}
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  </Link>
                                );
                              })}
                            </Box>
                          </Box>
                        );
                      }

                      // Regular tabs without submenu
                      return (
                        <Tooltip
                          key={tab.href}
                          title={
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                              <Icon icon={tab.icon} width="24" height="24" style={{ marginTop: '2px', flexShrink: 0 }} />
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: fontWeight.semibold, mb: 0.5 }}>
                                  {tab.label}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: getResponsiveFontSize('sm') }}>
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
                                boxShadow: shadows.lg,
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
                                fontSize: getResponsiveFontSize('md'),
                                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                                textTransform: 'none',
                                transition: transitions.colors,
                                cursor: 'pointer',
                                borderRadius: borderRadius.sm,
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
              </Box>

              {/* Centered logo for mobile/tablet - absolutely positioned */}
              {showHamburgerMenu && (
                <Box sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                }}>
                  <BrandLogo href="/" />
                </Box>
              )}

              {/* Container bên phải cho thanh tìm kiếm và auth buttons */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1.5,
              }}>
                <SearchBar variant="compact" />

                {!session && isDesktop && (
                  <AuthButtons />
                )}
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        {/* MAIN CONTENT - không có scrollbar riêng */}
        <Box
          component="main"
          sx={{
            bgcolor: theme.palette.background.default,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: `calc(100vh - ${layoutTokens.appBarHeight}px)`,
            px: { xs: 1.5, md: 2, lg: 3 }, // Mobile: 12px, Tablet: 16px, Desktop: 24px
          }}
        >
          <Box sx={{
            width: '100%',
            maxWidth: 1400,
            minHeight: '100%',
            mx: 'auto',
            flex: 1,
          }}>
            {children}
          </Box>
        </Box>


        {/* FOOTER */}
        {currentPathname === '/' && <ConsultationSection />}
        <Footer />
      </Box>
    </Box >
  );
}


