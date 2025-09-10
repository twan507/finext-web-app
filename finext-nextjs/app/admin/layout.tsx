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
  alpha, Popover, Collapse, Divider, ListSubheader
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
  const smDown = useMediaQuery(theme.breakpoints.down('sm'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinnedExpanded, setPinnedExpanded] = useState<boolean | null>(null); // null => follow responsive default

  // Popover state for icon-only mode
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<null | HTMLElement>(null);
  const [openPopoverGroupId, setOpenPopoverGroupId] = useState<null | string>(null);
  const [isTooltipDisabled, setIsTooltipDisabled] = useState(false);
  const popoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Collapse state for expanded mode groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Drawer widths
  const EXPANDED_WIDTH = 256;
  // No collapsed mode: always expanded (desktop/tablet) + mobile off-canvas
  const isMobile = smDown;
  const isExpanded = true;
  const drawerWidth = EXPANDED_WIDTH;

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
    my: 0.6,                // ← NEW: tạo khoảng cách dọc 4px giữa các item
    px: isExpanded ? theme.spacing(1.25) : theme.spacing(0),
    py: theme.spacing(isSubItem ? 1 : 1.25),
    minHeight: isSubItem ? 36 : 44,
    borderRadius: '8px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
    backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
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
          selected={isGroupActive}
          sx={{
            ...drawerLinkStyles(isGroupActive),
            px: 1.25,
          }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
            {React.cloneElement(group.groupIcon, { sx: { fontSize: 20 } })}
          </ListItemIcon>
          <ListItemText
            primary={group.groupText}
            primaryTypographyProps={{ variant: 'body2', fontWeight: isGroupActive ? 600 : 500 }}
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

  const renderIconOnlyGroup = (group: NavGroup) => {
    const isGroupActive = group.subItems.some(sub => currentPathname.startsWith(sub.href));
    const isOpen = openPopoverGroupId === group.groupText;

    return (
      <ListItem
        key={group.groupText}
        disablePadding
        sx={{ width: 'auto', my: theme.spacing(0.75) }}
        onMouseEnter={(e) => handlePopoverOpen(e, group.groupText)}
        onMouseLeave={handlePopoverClose}
      >
        <Tooltip title={group.groupText} placement="right" disableHoverListener={true}>
          <ListItemButton selected={isGroupActive && !isOpen} sx={{
            p: 1.25,
            borderRadius: '8px',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isGroupActive ? theme.palette.primary.main : theme.palette.text.secondary,
            backgroundColor: isGroupActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, isGroupActive ? 0.12 : 0.04),
              color: isGroupActive ? theme.palette.primary.dark : theme.palette.primary.main,
            },
          }}>
            <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
              {React.cloneElement(group.groupIcon, { sx: { fontSize: 18 } })}
            </ListItemIcon>
          </ListItemButton>
        </Tooltip>

        <Popover
          open={isOpen}
          anchorEl={popoverAnchorEl}
          onClose={handlePopoverClose}
          anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
          transformOrigin={{ vertical: 'center', horizontal: 'left' }}
          slotProps={{
            paper: {
              onMouseEnter: handlePopoverMouseEnter,
              onMouseLeave: handlePopoverClose,
              sx: {
                ml: 1, p: 1, minWidth: 220, bgcolor: 'background.paper',
                backgroundImage: 'none', boxShadow: theme.shadows[6], borderRadius: '8px',
                pointerEvents: 'auto',
              }
            }
          }}
          disableRestoreFocus
          sx={{ pointerEvents: 'none' }}
        >
          <Typography color="text.primary" variant="caption" sx={{ px: 1, py: 1, display: 'block', fontWeight: 'bold' }}>
            {group.groupText}
          </Typography>
          <List disablePadding>
            {group.subItems.map((subItem) => {
              const isSubActive = currentPathname.startsWith(subItem.href);
              return (
                <ListItem key={subItem.text} disablePadding sx={{ my: 0.5 }}>
                  <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                    <ListItemButton
                      selected={isSubActive}
                      sx={{
                        p: 1.25,
                        borderRadius: '8px',
                        color: isSubActive ? theme.palette.primary.main : theme.palette.text.secondary,
                        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, isSubActive ? 0.12 : 0.04) }
                      }}
                      onClick={() => { handlePopoverClose(); }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: 'inherit', mr: 1 }}>
                        {React.cloneElement(subItem.icon, { sx: { fontSize: 16 } })}
                      </ListItemIcon>
                      <ListItemText primary={subItem.text} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItemButton>
                  </Link>
                </ListItem>
              );
            })}
          </List>
        </Popover>
      </ListItem>
    );
  };

  const DesktopDrawerContent = (
    <>
      {/* Header (logo + brand) */}
      <Box
        sx={{
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          paddingTop: '4px',
          minHeight: layoutTokens.appBarHeight,     // 56–60 đều ổn
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'transparent',
        }}
      >
        <Link
          href="/admin/dashboard"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Image
            src="/finext-icon-trans.png"
            alt="Finext Logo"
            width={24}
            height={24}
            style={{ display: 'block' }}   // tránh lệch baseline
          />
          <Typography
            variant="h5"
            sx={{ fontWeight: 600, letterSpacing: 0.5 }}
          >
            Finext
          </Typography>
        </Link>
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
              return isExpanded ? (
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
              ) : (
                <ListItem key={item.text} disablePadding sx={{ width: 'auto', my: 0.75, justifyContent: 'center' }}>
                  <Tooltip title={item.text} placement="right" disableHoverListener={isTooltipDisabled && openPopoverGroupId !== null}>
                    <Link href={item.href} passHref style={{ textDecoration: 'none' }}>
                      <ListItemButton selected={isActive} sx={{
                        p: 1.25,
                        borderRadius: '8px',
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                        backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, isActive ? 0.12 : 0.04),
                          color: isActive ? theme.palette.primary.dark : theme.palette.primary.main,
                        },
                      }}>
                        <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                          {React.cloneElement(item.icon, { sx: { fontSize: 18 } })}
                        </ListItemIcon>
                      </ListItemButton>
                    </Link>
                  </Tooltip>
                </ListItem>
              );
            } else {
              return isExpanded ? renderExpandedGroup(item) : renderIconOnlyGroup(item);
            }
          })}
        </List>
      </Box>

      <Divider sx={{ my: 0.5 }} />

      {/* Logout row */}
      <Box sx={{ pb: 1, px: isExpanded ? 1.25 : 0, display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'stretch' : 'center', width: '100%' }}>
        {isExpanded ? (
          <ListItem disablePadding>
            <ListItemButton onClick={logout} sx={{ ...drawerLinkStyles(false), pl: 1.25 }}>
              <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                <LogoutIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText primary="Logout" primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          </ListItem>
        ) : (
          <Tooltip title="Logout" placement="right" disableHoverListener={isTooltipDisabled && openPopoverGroupId !== null}>
            <ListItemButton onClick={logout} sx={{
              p: 1.25,
              borderRadius: '8px',
              width: 40,
              height: 40,
              alignSelf: 'center',
              color: 'text.secondary',
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.06), color: 'primary.main' }
            }}>
              <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                <LogoutIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        )}
      </Box>
    </>
  );

  const MobileDrawerContent = (
    <>
      <Box
        sx={{
          px: 3,
          py: 1.25,
          paddingTop: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Image
            src="/finext-icon-trans.png"
            alt="Finext Logo"
            width={24}
            height={24}
            style={{ display: 'block' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: 0.15 }}>
            Finext
          </Typography>
        </Link>
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
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium', textTransform: 'uppercase', pl: 1 }}>
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
      <Box sx={{ p: 1, mt: 'auto', borderTop: `1px solid ${theme.palette.divider}` }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => { logout(); handleDrawerToggle(); }}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                color: theme.palette.primary.main,
              },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
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
          <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem' }}>
            {React.cloneElement(currentGroupIcon, { sx: { mr: 0.5, fontSize: '1rem' } })}
            {currentGroupText}
          </Typography>
        )}
        {currentPathname !== '/admin/dashboard' && bestMatch && (
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: 500 }}>
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
        sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` }, height: layoutTokens.appBarHeight }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', alignItems: 'center', px: { xs: 2, sm: 3 }, minHeight: `${layoutTokens.toolbarMinHeight}px !important`, height: layoutTokens.appBarHeight, maxHeight: layoutTokens.appBarHeight }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isMobile && (
              <MuiIconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' }, color: 'text.primary' }}>
                <MenuIcon />
              </MuiIconButton>
            )}
            {generateBreadcrumbs()}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ThemeToggleButton />
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      {/* NAV DRAWERS */}
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }} aria-label="sidebar">
        {/* Mobile Drawer (overlay) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          elevation={0}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: layoutTokens.drawerWidth || 280 } }}
        >
          {MobileDrawerContent}
        </Drawer>

        {/* Desktop Drawer (expanded ↔ icon-only) */}
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, height: '100vh', display: 'flex', flexDirection: 'column' } }}
          open
        >
          {DesktopDrawerContent}
        </Drawer>
      </Box>

      {/* MAIN */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, height: '100vh', mt: `${layoutTokens.appBarHeight}px`, maxHeight: `calc(100vh - ${layoutTokens.appBarHeight}px)`, overflowY: 'auto', bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[500], 0.04) : theme.palette.background.default }}>
        {children}
      </Box>
    </Box>
  );
}
