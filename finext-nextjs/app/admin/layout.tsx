'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from 'components/AuthProvider';
import {
  AppBar, Box, CssBaseline, Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, CircularProgress, useTheme,
  IconButton as MuiIconButton, Tooltip, useMediaQuery, Breadcrumbs,
  alpha, Popover,
} from '@mui/material';
import MuiLink from '@mui/material/Link';
import { SvgIconProps } from '@mui/material/SvgIcon';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  ChevronRight as ChevronRightIcon,
  DiamondOutlined as LogoIcon,
  AdminPanelSettings,
  Security,
  Gavel,
  VerifiedUser,
  Category,
  Campaign,
  Subscriptions,
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
import { layoutTokens } from '../../theme/tokens';

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
      { text: 'Subscriptions', href: '/admin/subscriptions', icon: <Subscriptions /> },
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
    groupText: "User Data",
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<null | HTMLElement>(null);
  const [openPopoverGroupId, setOpenPopoverGroupId] = useState<null | string>(null);
  const [isTooltipDisabled, setIsTooltipDisabled] = useState(false);

  const popoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const drawerWidth = layoutTokens.compactDrawerWidth;

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>, groupId: string) => {
    if (popoverTimeoutRef.current) {
      clearTimeout(popoverTimeoutRef.current);
      popoverTimeoutRef.current = null;
    }
    setPopoverAnchorEl(event.currentTarget);
    setOpenPopoverGroupId(groupId);
    setIsTooltipDisabled(true);
  };

  const handlePopoverClose = () => {
    if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    popoverTimeoutRef.current = setTimeout(() => {
      setPopoverAnchorEl(null);
      setOpenPopoverGroupId(null);
      setIsTooltipDisabled(false);
    }, 100);
  };

  const handlePopoverMouseEnter = () => {
    if (popoverTimeoutRef.current) {
      clearTimeout(popoverTimeoutRef.current);
      popoverTimeoutRef.current = null;
    }
  };

  if (authLoading || !session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }
  const drawerLinkStyles = (isActive: boolean, isSubItem: boolean = false) => ({
    p: theme.spacing(isSubItem ? 1.25 : 1.5),
    borderRadius: '8px',
    width: isSubItem ? '100%' : 40,
    height: isSubItem ? 'auto' : 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: isSubItem ? 'flex-start' : 'center',
    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
    backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
    '&:hover': {
      transform: isSubItem ? 'none' : 'scale(1.1)',
      backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
      color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
    },
    transition: theme.transitions.create(['transform', 'background-color', 'color'], {
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

  const drawerContent = (
    <>
      <Box sx={{ p: theme.spacing(2), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Link href="/admin/dashboard">
          <Image
            src="/finext-icon-trans.png"
            alt="Finext Logo"
            width={20} // Intrinsic width of the image if known, or desired display width
            height={20} // Intrinsic height for aspect ratio, or desired display height
            style={{ height: '30px', width: 'auto', marginTop: theme.spacing(1) }} // Style for rendered size
          />
        </Link>
      </Box>
      <List sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', py: theme.spacing(1), width: '100%' }}>
        {navigationStructure.map((item) => {
          if ('href' in item) { // NavItem
            const isActive = item.href === '/' ? currentPathname === '/' : currentPathname.startsWith(item.href);
            return (
              <ListItem key={item.text} disablePadding sx={{ width: 'auto', my: theme.spacing(0.75) }}>
                <Tooltip title={item.text} placement="right" disableHoverListener={isTooltipDisabled && openPopoverGroupId !== null}>
                  <Link href={item.href} passHref style={{ textDecoration: 'none' }}>
                    <ListItemButton selected={isActive} sx={drawerLinkStyles(isActive)}>
                      <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                        {React.cloneElement(item.icon, { sx: { ...item.icon.props.sx, fontSize: '18px' } })}
                      </ListItemIcon>
                    </ListItemButton>
                  </Link>
                </Tooltip>
              </ListItem>
            );
          } else { // NavGroup
            const isGroupActive = item.subItems.some(sub => currentPathname.startsWith(sub.href));
            const isOpen = openPopoverGroupId === item.groupText;
            return (
              <ListItem
                key={item.groupText}
                disablePadding
                sx={{ width: 'auto', my: theme.spacing(0.75) }}
                onMouseEnter={(e) => handlePopoverOpen(e, item.groupText)}
                onMouseLeave={handlePopoverClose}
              >
                <Tooltip title={item.groupText} placement="right" disableHoverListener={true}>
                  <ListItemButton
                    selected={isGroupActive && !isOpen}
                    sx={drawerLinkStyles(isGroupActive || isOpen)}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                      {React.cloneElement(item.groupIcon, { sx: { ...item.groupIcon.props.sx, fontSize: '18px' } })}
                    </ListItemIcon>
                  </ListItemButton>
                </Tooltip>
                <Popover
                  open={isOpen}
                  anchorEl={popoverAnchorEl}
                  onClose={handlePopoverClose}
                  anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'center', horizontal: 'left' }} slotProps={{
                    paper: {
                      onMouseEnter: handlePopoverMouseEnter,
                      onMouseLeave: handlePopoverClose,
                      sx: {
                        ml: 1, p: 1, minWidth: 200, bgcolor: 'background.paper',
                        backgroundImage: 'none', boxShadow: theme.shadows[6], borderRadius: '8px',
                        pointerEvents: 'auto',
                      }
                    }
                  }}
                  disableRestoreFocus
                  sx={{ pointerEvents: 'none' }}
                >
                  <Typography color="text.primary" variant="caption" sx={{ px: 1, py: 1, display: 'block', fontWeight: 'bold' }}>
                    {item.groupText}
                  </Typography>
                  <List disablePadding>
                    {item.subItems.map((subItem) => {
                      const isSubActive = currentPathname.startsWith(subItem.href);
                      return (
                        <ListItem key={subItem.text} disablePadding sx={{ my: 0.5 }}>
                          <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                            <ListItemButton
                              selected={isSubActive}
                              sx={drawerLinkStyles(isSubActive, true)}
                              onClick={() => {
                                handlePopoverClose();
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 32, color: 'inherit', mr: 1 }}>
                                {React.cloneElement(subItem.icon, { sx: { ...subItem.icon.props.sx, fontSize: '16px' } })}
                              </ListItemIcon>
                              <ListItemText primary={subItem.text} slotProps={{ primary: { variant: 'body2', fontWeight: isSubActive ? 'medium' : 'normal' } }} />
                            </ListItemButton>
                          </Link>
                        </ListItem>
                      );
                    })}
                  </List>
                </Popover>
              </ListItem>
            );
          }
        })}
      </List>
      <Box sx={{ pb: theme.spacing(2), display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <ListItem disablePadding sx={{ width: 'auto', my: theme.spacing(0.75) }}>
          <Tooltip title="Logout" placement="right" disableHoverListener={isTooltipDisabled && openPopoverGroupId !== null}>
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
  const generateBreadcrumbs = () => {
    const { bestMatch, bestMatchGroup } = findBestMatch();

    let currentPageTitle = "Page";
    let currentPageIcon = <ChevronRightIcon sx={{ mr: 0.5, fontSize: "inherit" }} />;
    let currentGroupText: string | null = null;
    let currentGroupIcon: React.ReactElement<SvgIconProps> | null = null;

    if (bestMatch) {
      currentPageTitle = bestMatch.text;
      currentPageIcon = React.cloneElement(bestMatch.icon, { sx: { mr: 0.5, fontSize: "inherit" } });

      if (bestMatchGroup) {
        currentGroupText = bestMatchGroup.groupText;
        currentGroupIcon = React.cloneElement(bestMatchGroup.groupIcon, { sx: { mr: 0.5, fontSize: "inherit" } });
      }
    } return (
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{
          color: 'text.secondary',
          '& .MuiBreadcrumbs-ol': {
            alignItems: 'center',
          },
          '& .MuiBreadcrumbs-li': {
            display: 'flex',
            alignItems: 'center',
          }
        }}
      >
        <MuiLink
          component={Link}
          underline="hover"
          color="inherit"
          href="/admin/dashboard"
          sx={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          <DashboardIcon sx={{ mr: 0.5, fontSize: "1rem" }} />
          Dashboard
        </MuiLink>        {currentGroupText && currentGroupIcon && (
          <Typography
            color="text.secondary"
            sx={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.875rem'
            }}
          >
            {React.cloneElement(currentGroupIcon, { sx: { mr: 0.5, fontSize: "1rem" } })}
            {currentGroupText}
          </Typography>
        )}
        {currentPathname !== '/admin/dashboard' && bestMatch && (
          <Typography
            color="text.primary"
            sx={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            {React.cloneElement(currentPageIcon, { sx: { mr: 0.5, fontSize: "1rem" } })}
            {currentPageTitle}
          </Typography>
        )}
      </Breadcrumbs>
    );
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: theme.palette.background.default }}>
      <CssBaseline />      <AppBar
        position="fixed"
        elevation={0} // Style can be controlled via MuiProvider if needed
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          height: layoutTokens.appBarHeight,
          // bgcolor and borderBottom are now primarily controlled by MuiProvider's styleOverrides
        }}
      >        <Toolbar sx={{
        justifyContent: 'space-between',
        alignItems: 'center',
        px: { xs: theme.spacing(2), sm: theme.spacing(3) },
        minHeight: `${layoutTokens.toolbarMinHeight}px !important`,
        height: layoutTokens.appBarHeight,
        maxHeight: layoutTokens.appBarHeight,
      }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isMobile && ( // isMobile is true for 'xs' screens
              <MuiIconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2, display: { sm: 'none' }, color: 'text.primary' }} // Correctly shows on xs, hidden on sm+
              >
                <MenuIcon />
              </MuiIconButton>
            )}
            {/* Corrected logic for breadcrumbs or mobile dashboard link */}            {isMobile ? ( // If on 'xs' screen (mobile)
              currentPathname !== '/admin/dashboard' && ( // And not on the dashboard page itself
                <MuiLink
                  component={Link}
                  underline="hover"
                  color="inherit"
                  href="/admin/dashboard"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: 'text.primary',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  <DashboardIcon sx={{ mr: 0.5, fontSize: "1rem" }} />
                  Dashboard
                </MuiLink>
              )
              // If on mobile AND on dashboard page, this part renders null, so only menu icon shows.
            ) : ( // Else (if on 'sm' screen or larger - desktop)
              generateBreadcrumbs() // Show full breadcrumbs
            )}
          </Box>          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: theme.spacing(1), sm: theme.spacing(1.5), md: theme.spacing(2) }
          }}>
            <ThemeToggleButton />
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="sidebar"
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          elevation={0} // Consistent with desktop
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              width: layoutTokens.drawerWidth, // full drawer width for mobile
              // bgcolor & borderRight will be inherited from MuiProvider styles
            },
          }}        >
          <Box sx={{ p: theme.spacing(2), display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
              <Image
                src="/finext-icon-trans.png"
                alt="Finext Logo"
                width={20}
                height={20}
                style={{ height: '24px', width: 'auto', marginRight: theme.spacing(1) }}
              />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Finext</Typography>
            </Link>
          </Box>
          <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
            {navigationStructure.map((itemOrGroup) => {
              if ('href' in itemOrGroup) {
                const isActive = currentPathname.startsWith(itemOrGroup.href);
                return (
                  <ListItem key={itemOrGroup.text} disablePadding>
                    <Link href={itemOrGroup.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                      <ListItemButton selected={isActive} onClick={handleDrawerToggle}>
                        <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
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
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium', textTransform: 'uppercase', pl: 1 }}>
                        {itemOrGroup.groupText}
                      </Typography>
                    </ListItem>
                    {itemOrGroup.subItems.map(subItem => {
                      const isActive = currentPathname.startsWith(subItem.href);
                      return (
                        <ListItem key={subItem.text} disablePadding sx={{ pl: 1.5 }}>
                          <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                            <ListItemButton selected={isActive} onClick={handleDrawerToggle}>
                              <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
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
          <Box sx={{ p: theme.spacing(1), mt: 'auto', borderTop: `1px solid ${theme.palette.divider}` }}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => { logout(); handleDrawerToggle(); }}>
                <ListItemIcon sx={{ color: 'text.secondary', minWidth: 40 }}>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </Box>
        </Drawer>

        {/* Desktop Drawer (Compact with Popovers on Hover) */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'flex' },
            flexDirection: 'column',
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              // bgcolor and borderRight are now primarily controlled by MuiProvider's styleOverrides
              // Removed: bgcolor: 'background.paper',
              // Removed: borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: theme.spacing(3),
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          mt: `${layoutTokens.appBarHeight}px`, // Updated AppBar height
          maxHeight: `calc(100vh - ${layoutTokens.appBarHeight}px)`,
          overflowY: 'auto',
          bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[500], 0.04) : theme.palette.background.default,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}