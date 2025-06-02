// finext-nextjs/app/(dashboard)/layout.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react'; // Added useRef
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
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
  alpha,
  Popover,
  Paper,
} from '@mui/material';
import MuiLink from '@mui/material/Link';
import { SvgIconProps } from '@mui/material/SvgIcon'; // Import SvgIconProps

// Icons
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Inventory2Outlined as ProductsIcon,
  BarChartOutlined as AnalyticsIcon,
  MailOutline as MessagesIcon,
  DescriptionOutlined as InvoicesIcon,
  Logout as LogoutIcon,
  NotificationsNoneOutlined as NotificationsIcon,
  Search as SearchIcon,
  Menu as MenuIcon,
  ChevronRight as ChevronRightIcon,
  DiamondOutlined as LogoIcon,
  AccountBalanceWalletOutlined, // Added import
  AdminPanelSettingsOutlined as AdminToolsIcon,
  ListAltOutlined,         // Added import
  SecurityOutlined as SecurityIcon,
  CategoryOutlined as CategoryIcon,
  AccountBalanceWalletOutlined as FinanceIcon, // Used AccountBalanceWalletOutlined again, ensure correct usage or pick another for Finance
  // If FinanceIcon was meant to be different, pick one e.g. MonetizationOnOutlined
  MonetizationOnOutlined as FinanceGroupIcon, // Example if FinanceIcon should be distinct
  DynamicFeedOutlined as DataManagementIcon,
  AdminPanelSettings,
  FolderShared,
  Security,
  Gavel,
  VerifiedUser,
  Category,
  Campaign,
  Subscriptions,
  ReceiptLong,
  MonetizationOn,
  Policy,
  AccountBalanceWallet,
  ListAlt,
  Devices,
  Key,
  AccountCircle,
  VpnKey,
  LockOpen,
  ShoppingCart,
  ManageAccounts,
  ContactPage
} from '@mui/icons-material';

import UserMenu from './components/UserMenu';
import ThemeToggleButton from 'components/ThemeToggleButton';

import { layoutTokens } from '../../theme/tokens';
import Image from 'next/image';

// Define types for navigation items
interface NavItem {
  text: string;
  href: string;
  icon: React.ReactElement<SvgIconProps>; // Use SvgIconProps for type safety with sx prop
}

interface NavGroup {
  groupText: string;
  groupIcon: React.ReactElement<SvgIconProps>; // Use SvgIconProps
  subItems: NavItem[];
}

// Restructured navigation items
const navigationStructure: (NavItem | NavGroup)[] = [
  { text: 'Dashboard', href: '/admin/dashboard', icon: <DashboardIcon /> },
  {
    groupText: 'Account Management',
    groupIcon: <ManageAccounts />,
    subItems: [
      { text: 'Users', href: '/admin/users', icon: <PeopleIcon /> },
      { text: 'Brokers', href: '/admin/brokers', icon: <AccountBalanceWallet /> },
    ],
  },
  {
    groupText: 'Payment Management',
    groupIcon: <ShoppingCart />,
    subItems: [
      { text: 'Transactions', href: '/admin/transactions', icon: <ReceiptLong /> },
      { text: 'Subscriptions', href: '/admin/subscriptions', icon: <LockOpen /> },
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

  const [popoverAnchorEl, setPopoverAnchorEl] = useState<null | HTMLElement>(null);
  const [openPopoverGroupId, setOpenPopoverGroupId] = useState<null | string>(null);
  const [isTooltipDisabled, setIsTooltipDisabled] = useState(false); // State to disable tooltip

  const popoverTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for popover close timeout

  const drawerWidth = layoutTokens.compactDrawerWidth;

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>, groupId: string) => {
    if (popoverTimeoutRef.current) {
      clearTimeout(popoverTimeoutRef.current);
      popoverTimeoutRef.current = null;
    }
    setPopoverAnchorEl(event.currentTarget);
    setOpenPopoverGroupId(groupId);
    setIsTooltipDisabled(true); // Disable tooltip when popover is to be opened
  };

  const handlePopoverClose = () => {
    // Clear any existing timeout before setting a new one.
    // This prevents orphaned timeouts if handlePopoverClose is called multiple times rapidly.
    if (popoverTimeoutRef.current) {
      clearTimeout(popoverTimeoutRef.current);
      // popoverTimeoutRef.current is not set to null here because
      // it will be immediately reassigned by the new setTimeout.
    }

    // Delay closing to allow mouse to move into popover
    popoverTimeoutRef.current = setTimeout(() => {
      setPopoverAnchorEl(null);
      setOpenPopoverGroupId(null);
      setIsTooltipDisabled(false); // Re-enable tooltip
    }, 100); // Adjust delay as needed
  };

  const handlePopoverMouseEnter = () => {
    if (popoverTimeoutRef.current) {
      clearTimeout(popoverTimeoutRef.current);
      popoverTimeoutRef.current = null;
    }
  };

  const handlePopoverMouseLeave = () => {
    handlePopoverClose();
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
    color: isActive
      ? (theme.palette.mode === 'light' ? theme.palette.primary.main : theme.palette.primary.light)
      : theme.palette.text.secondary,
    backgroundColor: isActive
      ? (theme.palette.mode === 'light' ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.light, 0.12))
      : 'transparent',
    '&:hover': {
      transform: isSubItem ? 'none' : 'scale(1.1)',
      backgroundColor: isActive
        ? (theme.palette.mode === 'light' ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.light, 0.20))
        : (theme.palette.mode === 'light' ? theme.palette.grey[100] : alpha(theme.palette.common.white, 0.08)),
      color: isActive
        ? (theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.main)
        : (theme.palette.mode === 'light' ? theme.palette.grey[700] : theme.palette.grey[300]),
    },
    '&.Mui-selected': {
      color: theme.palette.mode === 'light' ? theme.palette.primary.main : theme.palette.primary.light,
      backgroundColor: theme.palette.mode === 'light' ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.light, 0.12),
      '&:hover': {
        backgroundColor: theme.palette.mode === 'light' ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.light, 0.20),
        color: theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.main,
      }
    },
    transition: theme.transitions.create(['transform', 'background-color', 'color'], {
      duration: theme.transitions.duration.shortest,
    }),
  });

  const drawerContent = (
    <>
      <Box sx={{ p: theme.spacing(2), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Link href="/admin/dashboard">
          <Image
            src="/finext-icon-trans.png"
            alt="Finext Logo"
            width={20}
            height={20}
            style={{ height: '30px', width: 'auto', marginTop: theme.spacing(1) }}
          />
        </Link>
      </Box>
      <List sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', py: theme.spacing(1), width: '100%' }}>
        {navigationStructure.map((item) => {
          if ('href' in item) {
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
          } else { // Group item
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
                    selected={isGroupActive && !isOpen} // Keep selection visual feedback if active and popover not matching current hover
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
                  onClose={handlePopoverClose} // This will be triggered if mouse leaves popover area too
                  anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'center', horizontal: 'left' }}
                  slotProps={{
                    paper: {
                      onMouseEnter: handlePopoverMouseEnter, // Keep popover open when mouse enters it
                      onMouseLeave: handlePopoverMouseLeave, // Close popover when mouse leaves it
                      sx: {
                        ml: 1, p: 1, minWidth: 200, bgcolor: 'background.paper',
                        backgroundImage: 'none', boxShadow: theme.shadows[6], borderRadius: '8px',
                        pointerEvents: 'auto', // Ensure popover itself is interactive
                      }
                    }
                  }}
                  // To prevent Popover from stealing focus and closing immediately on mouse leave from ListItem
                  disableRestoreFocus
                  sx={{ pointerEvents: 'none' }} // Prevent popover from capturing mouse events initially that would close it
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
                                handlePopoverClose(); // Close popover on subitem click
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 32, color: 'inherit', mr: 1 }}>
                                {React.cloneElement(subItem.icon, { sx: { ...subItem.icon.props.sx, fontSize: '16px' } })}
                              </ListItemIcon>
                              <ListItemText primary={subItem.text} primaryTypographyProps={{ variant: 'body2', fontWeight: isSubActive ? 'medium' : 'normal' }} />
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
    const pathParts = currentPathname.split('/').filter(part => part);
    let currentPageTitle = "Page";
    let currentPageIconInstance: React.ReactElement<SvgIconProps> = <ChevronRightIcon sx={{ mr: 0.5, fontSize: "inherit" }} />;
    let currentGroupText: string | null = null;
    let currentGroupIcon: React.ReactElement<SvgIconProps> | null = null;

    // Helper to find item in navigation structure and return both item and group
    const findItemWithGroup = (items: (NavItem | NavGroup)[], path: string): { item: NavItem | undefined, group: NavGroup | undefined } => {
      for (const item of items) {
        if ('href' in item && path.startsWith(item.href)) {
          if (path === item.href || (path.startsWith(item.href) && path[item.href.length] === '/')) {
            return { item, group: undefined };
          }
        } else if ('subItems' in item) {
          const foundInSub = findItemWithGroup(item.subItems, path);
          if (foundInSub.item) {
            return { item: foundInSub.item, group: item };
          }
        }
      }
      return { item: undefined, group: undefined };
    };

    // Find the best matching item and its group
    let bestMatch: NavItem | undefined = undefined;
    let bestMatchGroup: NavGroup | undefined = undefined;
    let longestMatchLength = 0;

    const findBestMatchRecursive = (items: (NavItem | NavGroup)[], parentGroup?: NavGroup) => {
      for (const item of items) {
        if ('href' in item) {
          if (currentPathname.startsWith(item.href) && item.href.length > longestMatchLength) {
            bestMatch = item;
            bestMatchGroup = parentGroup;
            longestMatchLength = item.href.length;
          }
        } else if ('subItems' in item) {
          if (item.subItems.some(sub => currentPathname.startsWith(sub.href))) {
            findBestMatchRecursive(item.subItems, item);
          }
        }
      }
    };

    findBestMatchRecursive(navigationStructure);

    if (bestMatch) {
      currentPageTitle = (bestMatch as NavItem).text;
      currentPageIconInstance = React.cloneElement((bestMatch as NavItem).icon, { sx: { ...(bestMatch as NavItem).icon.props.sx, mr: 0.5, fontSize: "inherit" } });

      if (bestMatchGroup) {
        const group = bestMatchGroup as NavGroup;
        currentGroupText = group.groupText;
        currentGroupIcon = React.cloneElement(group.groupIcon, { sx: { ...group.groupIcon.props.sx, mr: 0.5, fontSize: "inherit" } });
      }
    } else if (currentPathname === '/admin/dashboard') {
      const dashboardItem = navigationStructure.find(item => 'href' in item && item.href === '/admin/dashboard') as NavItem | undefined;
      if (dashboardItem) {
        currentPageTitle = dashboardItem.text;
        currentPageIconInstance = React.cloneElement(dashboardItem.icon, { sx: { ...dashboardItem.icon.props.sx, mr: 0.5, fontSize: "inherit" } });
      }
    }

    return (
      <Breadcrumbs aria-label="breadcrumb" sx={{ color: 'text.secondary' }}>
        <MuiLink
          component={Link}
          underline="hover"
          color="inherit"
          href="/admin/dashboard"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <DashboardIcon sx={{ mr: 0.5, fontSize: "inherit" }} />
          Dashboard
        </MuiLink>
        {currentGroupText && (
          <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
            {currentGroupIcon}
            {currentGroupText}
          </Typography>
        )}
        {(currentPathname !== '/admin/dashboard' && pathParts.length > 1 && (currentPageTitle !== "Page" || bestMatch)) && (
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            {currentPageIconInstance}
            {currentPageTitle}
          </Typography>
        )}
      </Breadcrumbs>
    );
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: theme.palette.background.default }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          // bgcolor: 'background.paper', // Consider if needed
          // borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: theme.spacing(3), py: theme.spacing(0) }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isMobile && (
              <MuiIconButton
                color="inherit" // Will inherit color from parent, or set explicitly e.g. "default" or "primary"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2, color: 'text.primary' /* More explicit for visibility */ }}
              >
                <MenuIcon />
              </MuiIconButton>
            )}
            {!isMobile && generateBreadcrumbs()}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: theme.spacing(isMobile ? 1 : 2) }}>
            {!isMobile && (
              <TextField
                variant="standard"
                size="small"
                placeholder="Search..."
                InputProps={{ // Changed from slotProps.input to InputProps
                  disableUnderline: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                }}
                inputProps={{ // sx for the input element itself goes here
                  sx: {
                    borderRadius: '20px',
                    bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[100] : alpha(theme.palette.common.white, 0.1),
                    px: theme.spacing(2),
                    py: theme.spacing(0.75),
                    fontSize: '0.875rem',
                    minWidth: 220,
                    color: 'text.primary',
                    transition: theme.transitions.create(['background-color', 'box-shadow']),
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[200] : alpha(theme.palette.common.white, 0.15),
                    },
                    '&.Mui-focused': {
                      bgcolor: theme.palette.background.paper,
                      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
                    }
                  }
                }}
              />
            )}
            {isMobile && (
              <MuiIconButton sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                <Tooltip title="Search">
                  <SearchIcon />
                </Tooltip>
              </MuiIconButton>
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
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          elevation={0}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: layoutTokens.drawerWidth, // full drawer width for mobile
            },
          }}
        >
          <Box sx={{ p: theme.spacing(2), display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
            <LogoIcon sx={{ fontSize: '24px', color: 'primary.main', mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Finext</Typography>
          </Box>
          <List sx={{ flexGrow: 1, overflowY: 'auto' }}> {/* Added flexGrow and overflowY for long lists */}
            {navigationStructure.map((itemOrGroup) => {
              if ('href' in itemOrGroup) {
                return (
                  <ListItem key={itemOrGroup.text} disablePadding>
                    <Link href={itemOrGroup.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                      <ListItemButton selected={currentPathname.startsWith(itemOrGroup.href)} onClick={handleDrawerToggle}>
                        <ListItemIcon sx={{ color: currentPathname.startsWith(itemOrGroup.href) ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
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
                    <ListItem sx={{ pt: 2, pb: 1, mt: 1 }}> {/* Added some margin top for group headers */}
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium', textTransform: 'uppercase', pl: 1 }}>
                        {itemOrGroup.groupText}
                      </Typography>
                    </ListItem>
                    {itemOrGroup.subItems.map(subItem => (
                      <ListItem key={subItem.text} disablePadding sx={{ pl: 1.5 }}>
                        <Link href={subItem.href} passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                          <ListItemButton selected={currentPathname.startsWith(subItem.href)} onClick={handleDrawerToggle}>
                            <ListItemIcon sx={{ color: currentPathname.startsWith(subItem.href) ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                              {subItem.icon}
                            </ListItemIcon>
                            <ListItemText primary={subItem.text} />
                          </ListItemButton>
                        </Link>
                      </ListItem>
                    ))}
                  </React.Fragment>
                );
              }
            })}
          </List>
          <Box sx={{ p: theme.spacing(1), mt: 'auto', borderTop: `1px solid ${theme.palette.divider}` }}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => { logout(); handleDrawerToggle(); }}>
                <ListItemIcon sx={{ color: 'text.secondary', minWidth: 40 }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </Box>
        </Drawer>

        {/* Desktop Drawer (Compact with Popovers on Hover) */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth, // compact drawer width
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              borderRight: `1px solid ${theme.palette.divider}`,
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
          height: '100vh',
          mt: `64px`, // Standard AppBar height
          maxHeight: `calc(100vh - 64px)`,
          overflowY: 'auto',
          bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.grey[500], 0.04) : theme.palette.background.default,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}