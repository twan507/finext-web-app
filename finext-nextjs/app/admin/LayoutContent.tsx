'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  AppBar, Box, CssBaseline, Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, CircularProgress, useTheme,
  IconButton as MuiIconButton, useMediaQuery, Breadcrumbs,
  alpha, Collapse
} from '@mui/material';
import MuiLink from '@mui/material/Link';
import { SvgIconProps } from '@mui/material/SvgIcon';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AdminPanelSettings,
  Security,
  Gavel,
  VerifiedUser,
  Category,
  Campaign,
  Receipt,
  ReceiptLong,
  Policy,
  BusinessCenter,
  ListAlt,
  Devices,
  VpnKey,
  ShoppingCart,
  ManageAccounts,
  ContactPage
} from '@mui/icons-material';

import ThemeToggleButton from '@/components/themeToggle/ThemeToggleButton';
import BrandLogo from '@/components/layout/BrandLogo';
import { layoutTokens, iconSize, borderRadius, shadows, getResponsiveFontSize, fontWeight } from '../../theme/tokens';
import UserAvatar from '@/components/layout/UserAvatar';

interface NavItem {
  text: string;
  href: string;
  icon: React.ReactElement<SvgIconProps>;
}

interface NavGroup {
  groupText: string;
  groupIcon: React.ReactElement<SvgIconProps>;
  subItems: NavItem[];
}

const navigationStructure: (NavItem | NavGroup)[] = [
  {
    groupText: 'Account Management',
    groupIcon: <ManageAccounts />,
    subItems: [
      { text: 'Users', href: '/admin/users', icon: <PeopleIcon /> },
      { text: 'Brokers', href: '/admin/brokers', icon: <BusinessCenter /> },
    ],
  },
  {
    groupText: 'Payment Management',
    groupIcon: <ShoppingCart />,
    subItems: [
      { text: 'Transactions', href: '/admin/transactions', icon: <ReceiptLong /> },
      { text: 'Subscriptions', href: '/admin/subscriptions', icon: <Receipt /> },
      { text: 'Promotions', href: '/admin/promotions', icon: <Campaign /> },
    ],
  },
  {
    groupText: 'Licenses & Features',
    groupIcon: <Policy />,
    subItems: [
      { text: 'Licenses', href: '/admin/licenses', icon: <VerifiedUser /> },
      { text: 'Features', href: '/admin/features', icon: <Category /> },
    ],
  },
  {
    groupText: 'Roles & Permissions',
    groupIcon: <AdminPanelSettings />,
    subItems: [
      { text: 'Roles', href: '/admin/roles', icon: <Security /> },
      { text: 'Permissions', href: '/admin/permissions', icon: <Gavel /> },
    ],
  },
  {
    groupText: 'User Data',
    groupIcon: <ContactPage />,
    subItems: [
      { text: 'Watchlists', href: '/admin/watchlists', icon: <ListAlt /> },
      { text: 'Sessions', href: '/admin/sessions', icon: <Devices /> },
      { text: 'Otps', href: '/admin/otps', icon: <VpnKey /> },
    ],
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

  // Collapse state for expanded mode groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Drawer widths
  const EXPANDED_WIDTH = 256;
  const drawerWidth = EXPANDED_WIDTH;
  // Show hamburger menu for both Tablet and Mobile
  const showHamburgerMenu = !isDesktop;

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  if (authLoading || !session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  const drawerLinkStyles = (
    isActive: boolean,
    isSubItem: boolean = false,
    applyBgOnActive: boolean = true
  ) => ({
    my: 0.6,
    px: theme.spacing(1.25), // Desktop sidebar luôn expanded
    py: theme.spacing(isSubItem ? 1 : 1.25),
    minHeight: isSubItem ? 36 : 44,
    borderRadius: borderRadius.md,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
    backgroundColor: isActive && applyBgOnActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, isActive && applyBgOnActive ? 0.12 : 0.04),
      color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
    },
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shortest,
    }),
  });

  const findBestMatch = () => {
    let bestMatch: NavItem | undefined;
    let bestMatchGroup: NavGroup | undefined;
    let longestMatchLength = 0;

    const searchItems = (items: (NavItem | NavGroup)[], parentGroup?: NavGroup) => {
      for (const item of items) {
        if ('href' in item) {
          if (currentPathname.startsWith(item.href) && item.href.length > longestMatchLength) {
            bestMatch = item;
            bestMatchGroup = parentGroup;
            longestMatchLength = item.href.length;
          }
        } else if ('subItems' in item && item.subItems.some(sub => currentPathname.startsWith(sub.href))) {
          searchItems(item.subItems, item);
        }
      }
    };

    searchItems(navigationStructure);
    return { bestMatch, bestMatchGroup };
  };

  const renderExpandedGroup = (group: NavGroup) => {
    const isGroupActive = group.subItems.some(sub => currentPathname.startsWith(sub.href));
    const isOpen = openGroups[group.groupText] ?? isGroupActive; // auto-open active group

    return (
      <React.Fragment key={group.groupText}>
        <ListItemButton
          onClick={() => setOpenGroups(prev => ({ ...prev, [group.groupText]: !isOpen }))}
          sx={{
            ...drawerLinkStyles(isGroupActive, false, false),
            px: 1.25,
          }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
            {React.cloneElement(group.groupIcon, { sx: { fontSize: iconSize.menu.desktop } })}
          </ListItemIcon>
          <ListItemText
            primary={group.groupText}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: isGroupActive ? fontWeight.medium : undefined
            }}
          />
          {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </ListItemButton>
        <Collapse in={isOpen} unmountOnExit>
          <List disablePadding>
            {group.subItems.map(subItem => {
              const isSubActive = currentPathname.startsWith(subItem.href);
              return (
                <ListItem key={subItem.text} disablePadding>
                  <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                    <ListItemButton selected={isSubActive} sx={{ ...drawerLinkStyles(isSubActive, true), pl: 5 }}>
                      <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                        {React.cloneElement(subItem.icon, { sx: { fontSize: iconSize.menu.tablet } })}
                      </ListItemIcon>
                      <ListItemText primary={subItem.text} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItemButton>
                  </Link>
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      </React.Fragment>
    );
  };

  const DesktopDrawerContent = (
    <>
      {/* Header (UserAvatar thay vì logo) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: layoutTokens.appBarHeight,
          bgcolor: 'transparent',
          mt: 1
        }}
      >
        <UserAvatar variant="full" />
      </Box>

      {/* Navigation */}
      <Box sx={{
        flex: 1,
        px: 1,
      }}>
        <List sx={{ pb: 1, width: '100%' }}>
          {navigationStructure.map((item) => {
            if ('href' in item) {
              const isActive = item.href === '/' ? currentPathname === '/' : currentPathname.startsWith(item.href);
              return (
                <ListItem key={item.text} disablePadding>
                  <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                    <ListItemButton selected={isActive} sx={{ ...drawerLinkStyles(isActive), pl: 1.25 }}>
                      <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                        {React.cloneElement(item.icon, { sx: { fontSize: iconSize.menu.desktop } })}
                      </ListItemIcon>
                      <ListItemText primary={item.text} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItemButton>
                  </Link>
                </ListItem>
              );
            } else {
              return renderExpandedGroup(item); // Desktop sidebar luôn expanded
            }
          })}
        </List>
      </Box>

      {/* Theme Toggle Footer */}
      <Box sx={{ pb: 1, px: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <ThemeToggleButton variant="full" />
      </Box>
    </>
  );

  // Tablet Drawer Content - More spacious with full user info and descriptions
  const TabletDrawerContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          mt: 1,
        }}
      >
        <UserAvatar variant="full" onNavigate={handleDrawerToggle} />
      </Box>

      <List sx={{ flexGrow: 1, pb: 1 }}>
        {navigationStructure.map((itemOrGroup) => {
          if ('href' in itemOrGroup) {
            const isActive = currentPathname.startsWith(itemOrGroup.href);
            return (
              <ListItem key={itemOrGroup.text} disablePadding>
                <Link href={itemOrGroup.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                  <ListItemButton
                    selected={isActive}
                    onClick={handleDrawerToggle}
                    sx={{
                      borderRadius: borderRadius.md,
                      color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                      backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                        color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                      {itemOrGroup.icon}
                    </ListItemIcon>
                    <ListItemText primary={itemOrGroup.text} />
                  </ListItemButton>
                </Link>
              </ListItem>
            );
          } else {
            return (
              <React.Fragment key={itemOrGroup.groupText}>
                <ListItem sx={{ pt: 1 }}>
                  <Typography variant="caption" color="text.primary" sx={{ textTransform: 'uppercase', pl: 1, fontWeight: fontWeight.semibold }}>
                    {itemOrGroup.groupText}
                  </Typography>
                </ListItem>
                {itemOrGroup.subItems.map(subItem => {
                  const isActive = currentPathname.startsWith(subItem.href);
                  return (
                    <ListItem key={subItem.text} disablePadding sx={{ pl: 2 }}>
                      <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                        <ListItemButton
                          selected={isActive}
                          onClick={handleDrawerToggle}
                          sx={{
                            borderRadius: borderRadius.md,
                            color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                            backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                              color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                            },
                          }}
                        >
                          <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                            {subItem.icon}
                          </ListItemIcon>
                          <ListItemText primary={subItem.text} />
                        </ListItemButton>
                      </Link>
                    </ListItem>
                  );
                })}
              </React.Fragment>
            );
          }
        })}
      </List>

      {/* Divider */}
      <Box sx={{ mx: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}` }} />

      <Box sx={{ py: 1, px: 1 }}>
        <ThemeToggleButton variant="full" />
      </Box>
    </>
  );

  // Mobile Drawer Content - Same as tablet but smaller fonts
  const MobileDrawerContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          mt: 1,
        }}
      >
        <UserAvatar variant="full" onNavigate={handleDrawerToggle} compact />
      </Box>

      <List sx={{ flexGrow: 1, px: 1 }}>
        {navigationStructure.map((itemOrGroup) => {
          if ('href' in itemOrGroup) {
            const isActive = currentPathname.startsWith(itemOrGroup.href);
            return (
              <ListItem key={itemOrGroup.text} disablePadding>
                <Link href={itemOrGroup.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                  <ListItemButton
                    selected={isActive}
                    onClick={handleDrawerToggle}
                    sx={{
                      py: 0.75,
                      borderRadius: borderRadius.md,
                      color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                      backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                      {React.cloneElement(itemOrGroup.icon, { sx: { fontSize: iconSize.menu.mobile } })}
                    </ListItemIcon>
                    <ListItemText
                      primary={itemOrGroup.text}
                      primaryTypographyProps={{ fontSize: getResponsiveFontSize('md') }}
                    />
                  </ListItemButton>
                </Link>
              </ListItem>
            );
          } else {
            return (
              <React.Fragment key={itemOrGroup.groupText}>
                <ListItem sx={{ px: 1 }}>
                  <Typography variant="caption" color="text.primary" sx={{ textTransform: 'uppercase', fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold }}>
                    {itemOrGroup.groupText}
                  </Typography>
                </ListItem>
                {itemOrGroup.subItems.map(subItem => {
                  const isActive = currentPathname.startsWith(subItem.href);
                  return (
                    <ListItem key={subItem.text} disablePadding sx={{ pl: 0.5 }}>
                      <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                        <ListItemButton
                          selected={isActive}
                          onClick={handleDrawerToggle}
                          sx={{
                            py: 0.75,
                            borderRadius: borderRadius.md,
                            color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                            backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                            },
                          }}
                        >
                          <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                            {React.cloneElement(subItem.icon, { sx: { fontSize: iconSize.menu.mobile } })}
                          </ListItemIcon>
                          <ListItemText
                            primary={subItem.text}
                            primaryTypographyProps={{ fontSize: getResponsiveFontSize('md') }}
                          />
                        </ListItemButton>
                      </Link>
                    </ListItem>
                  );
                })}
              </React.Fragment>
            );
          }
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
    const { bestMatch, bestMatchGroup } = findBestMatch();

    let currentPageTitle = 'Page';
    let currentPageIcon = <ChevronRightIcon sx={{ mr: 0.5, fontSize: 'inherit' }} />;
    let currentGroupText: string | null = null;
    let currentGroupIcon: React.ReactElement<SvgIconProps> | null = null;

    if (bestMatch) {
      currentPageTitle = bestMatch.text;
      currentPageIcon = React.cloneElement(bestMatch.icon, { sx: { mr: 0.5, fontSize: 'inherit' } });

      if (bestMatchGroup) {
        currentGroupText = bestMatchGroup.groupText;
        currentGroupIcon = React.cloneElement(bestMatchGroup.groupIcon, { sx: { mr: 0.5, fontSize: 'inherit' } });
      }
    }

    return (
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{ color: 'text.secondary', '& .MuiBreadcrumbs-ol': { alignItems: 'center' }, '& .MuiBreadcrumbs-li': { display: 'flex', alignItems: 'center' } }}
      >
        <MuiLink component={Link} underline="hover" color="inherit" href="/admin/dashboard" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
          <DashboardIcon sx={{ mr: 0.5, fontSize: iconSize.breadcrumb.desktop }} />
          Dashboard
        </MuiLink>
        {currentGroupText && currentGroupIcon && (
          <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }} variant="body2">
            {React.cloneElement(currentGroupIcon, { sx: { mr: 0.5, fontSize: iconSize.breadcrumb.desktop } })}
            {currentGroupText}
          </Typography>
        )}
        {currentPathname !== '/admin/dashboard' && bestMatch && (
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
          sx={{
            display: { xs: 'none', md: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              width: 300,
              boxShadow: '4px 0 16px rgba(0, 0, 0, 0.15)',
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
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: 250,
              boxShadow: '4px 0 16px rgba(0, 0, 0, 0.15)',
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
              boxShadow: shadows.card,
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
              backdropFilter: 'blur(8px)',
            }
          }}
          open
        >
          {DesktopDrawerContent}
        </Drawer>
      </Box>

      {/* SCROLLABLE CONTAINER - chứa AppBar sticky và page content */}
      <Box
        sx={{
          flexGrow: 1,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
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
          <Toolbar sx={{ justifyContent: 'space-between', alignItems: 'center', px: { xs: 1.5, md: 2, lg: 3 }, minHeight: `${layoutTokens.toolbarMinHeight}px !important`, height: layoutTokens.appBarHeight, maxHeight: layoutTokens.appBarHeight }}>
            {/* Container bên trái, sẽ chứa logo và nút menu mobile */}
            <Box sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'center', lg: 'flex-start' },
              position: 'relative',
            }}>
              {showHamburgerMenu && (
                <MuiIconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{
                    position: 'absolute',
                    left: 0,
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

              <BrandLogo href="/" />
            </Box>

            {/* Container bên phải */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* UserAvatar đã được chuyển vào sidebar */}
            </Box>
          </Toolbar>
        </AppBar>

        {/* MAIN CONTENT - không có scrollbar riêng */}
        <Box
          component="main"
          sx={{
            p: { xs: 1.5, md: 2, lg: 3 }, // Mobile: 12px, Tablet: 16px, Desktop: 24px
            bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[500], 0.04) : theme.palette.background.default,
            minHeight: `calc(100vh - ${layoutTokens.appBarHeight}px)`,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}


