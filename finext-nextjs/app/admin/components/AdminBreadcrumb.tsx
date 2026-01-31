'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Breadcrumbs,
    Typography,
    alpha,
} from '@mui/material';
import MuiLink from '@mui/material/Link';
import { SvgIconProps } from '@mui/material/SvgIcon';
import { iconSize, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import {
    Dashboard as DashboardIcon,
    People as PeopleIcon,
    ChevronRight as ChevronRightIcon,
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

export default function AdminBreadcrumb() {
    const currentPathname = usePathname();

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
            sx={{
                color: 'text.secondary',
                mb: 2,
                '& .MuiBreadcrumbs-ol': { alignItems: 'center' },
                '& .MuiBreadcrumbs-li': { display: 'flex', alignItems: 'center' }
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
                    '&:hover': { textDecoration: 'underline' }
                }}
            >
                <DashboardIcon sx={{ mr: 0.5, fontSize: iconSize.breadcrumb.desktop }} />
                Dashboard
            </MuiLink>
            {currentGroupText && currentGroupIcon && (
                <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center', fontSize: getResponsiveFontSize('md') }}>
                    {React.cloneElement(currentGroupIcon, { sx: { mr: 0.5, fontSize: iconSize.breadcrumb.desktop } })}
                    {currentGroupText}
                </Typography>
            )}
            {currentPathname !== '/admin/dashboard' && bestMatch && (
                <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.medium }}>
                    {React.cloneElement(currentPageIcon, { sx: { mr: 0.5, fontSize: iconSize.breadcrumb.desktop } })}
                    {currentPageTitle}
                </Typography>
            )}
        </Breadcrumbs>
    );
}