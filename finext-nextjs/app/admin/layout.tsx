'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from 'components/AuthProvider';
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

import UserMenu from './components/UserMenu';
import ThemeToggleButton from 'components/ThemeToggleButton';
import BrandLogo from 'components/BrandLogo';
import { layoutTokens, responsiveTypographyTokens } from '../../theme/tokens';

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const currentPathname = usePathname();
  const theme = useTheme();

  const lgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const lgDown = useMediaQuery(theme.breakpoints.down('lg'));

  const [mobileOpen, setMobileOpen] = useState(false);

  // Collapse state for expanded mode groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Drawer widths
  const EXPANDED_WIDTH = 256;
  // Chỉ có 2 trạng thái: desktop (permanent sidebar) + mobile (hamburger menu)
  const isMobile = lgDown; // Thay đổi từ smDown thành lgDown
  const drawerWidth = EXPANDED_WIDTH;

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
    borderRadius: '8px',
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
            {React.cloneElement(group.groupIcon, { sx: { fontSize: 20 } })}
          </ListItemIcon>
          <ListItemText
            primary={group.groupText}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: isGroupActive ? 'medium' : 'normal'
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
                        {React.cloneElement(subItem.icon, { sx: { fontSize: 18 } })}
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
      {/* Header (UserMenu thay vì logo) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start', // Căn trái thay vì căn giữa
          height: layoutTokens.appBarHeight, // Sử dụng height thay vì minHeight để đảm bảo chính xác
          bgcolor: 'transparent',
          // Bỏ borderBottom và padding
        }}
      >
        <UserMenu />
      </Box>

      {/* Navigation */}
      <Box sx={{
        flex: 1, overflowY: 'auto', px: 1.25,   // ← thêm padding ngang (≈10px)
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { width: 2 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: alpha(theme.palette.text.primary, 0.15), borderRadius: 8 },
        '&:hover::-webkit-scrollbar-thumb': { backgroundColor: alpha(theme.palette.text.primary, 0.25) }
      }}>
        <List sx={{ py: 1, width: '100%' }}>
          {navigationStructure.map((item) => {
            if ('href' in item) {
              const isActive = item.href === '/' ? currentPathname === '/' : currentPathname.startsWith(item.href);
              return (
                <ListItem key={item.text} disablePadding>
                  <Link href={item.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                    <ListItemButton selected={isActive} sx={{ ...drawerLinkStyles(isActive), pl: 1.25 }}>
                      <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                        {React.cloneElement(item.icon, { sx: { fontSize: 20 } })}
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
      <Box sx={{ pb: 1, px: 1.25, display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
        <ThemeToggleButton variant="full" />
      </Box>
    </>
  );

  const MobileDrawerContent = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start', // Căn trái
          height: layoutTokens.appBarHeight, // Đảm bảo chiều cao chính xác
          gap: 1,
          // Bỏ borderBottom và padding
        }}
      >
        <UserMenu />
      </Box>

      <List sx={{
        flexGrow: 1,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { width: 2 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: alpha(theme.palette.text.primary, 0.15), borderRadius: 8 },
        '&:hover::-webkit-scrollbar-thumb': { backgroundColor: alpha(theme.palette.text.primary, 0.25) }
      }}>
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
                      color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                        color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
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
                <ListItem sx={{ pt: 2, pb: 1, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', pl: 1 }}>
                    {itemOrGroup.groupText}
                  </Typography>
                </ListItem>
                {itemOrGroup.subItems.map(subItem => {
                  const isActive = currentPathname.startsWith(subItem.href);
                  return (
                    <ListItem key={subItem.text} disablePadding sx={{ pl: 1.5 }}>
                      <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                        <ListItemButton
                          selected={isActive}
                          onClick={handleDrawerToggle}
                          sx={{
                            color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                              color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                            },
                          }}
                        >
                          <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
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
      <Box sx={{ p: 1, mt: 'auto' }}>
        <ListItem disablePadding>
          <ThemeToggleButton variant="full" />
        </ListItem>
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
          <DashboardIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
          Dashboard
        </MuiLink>
        {currentGroupText && currentGroupIcon && (
          <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }} variant="body2">
            {React.cloneElement(currentGroupIcon, { sx: { mr: 0.5, fontSize: '1rem' } })}
            {currentGroupText}
          </Typography>
        )}
        {currentPathname !== '/admin/dashboard' && bestMatch && (
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }} variant="body2">
            {React.cloneElement(currentPageIcon, { sx: { mr: 0.5, fontSize: '1rem' } })}
            {currentPageTitle}
          </Typography>
        )}
      </Breadcrumbs>
    );
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: theme.palette.background.default }}>
      <CssBaseline />

      {/* APP BAR */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ width: { lg: `calc(100% - ${drawerWidth}px)` }, ml: { lg: `${drawerWidth}px` }, height: layoutTokens.appBarHeight }}
      >

        <Toolbar sx={{ justifyContent: 'space-between', alignItems: 'center', px: { xs: 2, lg: 3 }, minHeight: `${layoutTokens.toolbarMinHeight}px !important`, height: layoutTokens.appBarHeight, maxHeight: layoutTokens.appBarHeight }}>
          {/* Container bên trái, sẽ chứa logo và nút menu mobile */}
          <Box sx={{
            flex: 1, // Chiếm toàn bộ không gian còn lại
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'center', lg: 'flex-start' }, // Căn giữa dưới lg, căn trái từ lg trở lên
            position: 'relative', // Làm mốc cho nút menu
          }}>
            {isMobile && (
              <MuiIconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{
                  // Đặt nút menu ở góc trái tuyệt đối để không ảnh hưởng đến việc căn giữa logo
                  position: 'absolute',
                  left: 0,
                  color: 'text.primary'
                }}
              >
                <MenuIcon />
              </MuiIconButton>
            )}

            {/* Comment out Breadcrumbs và thay bằng Logo */}
            <BrandLogo href="/" />
            {/* {generateBreadcrumbs()} */}
          </Box>

          {/* Container bên phải - đã bỏ UserMenu */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* UserMenu đã được chuyển vào sidebar */}
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
          sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: layoutTokens.drawerWidth || 280 } }}
        >
          {MobileDrawerContent}
        </Drawer>

        {/* Desktop Drawer (expanded ↔ icon-only) */}
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, height: '100vh', display: 'flex', flexDirection: 'column' } }}
          open
        >
          {DesktopDrawerContent}
        </Drawer>
      </Box>

      {/* MAIN */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { lg: `calc(100% - ${drawerWidth}px)` }, height: '100vh', mt: `${layoutTokens.appBarHeight}px`, maxHeight: `calc(100vh - ${layoutTokens.appBarHeight}px)`, overflowY: 'auto', bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[500], 0.04) : theme.palette.background.default }}>
        {children}
      </Box>
    </Box>
  );
}
