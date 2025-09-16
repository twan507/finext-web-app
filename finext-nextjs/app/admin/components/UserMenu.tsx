'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from 'components/AuthProvider';
import { apiClient } from 'services/apiClient';

import {
    Avatar, Menu, MenuItem, ListItemIcon, Typography, Box, Skeleton
} from '@mui/material';
import {
    Logout as LogoutIcon,
} from '@mui/icons-material';

interface ISubscription {
    _id: string;
    license_key: string;
    license_id: string;
}

interface ILicense {
    _id: string;
    key: string;
    name: string;
    color: string;
}

// ======================================================================
// COMPONENT: AVATAR VỚI HUY HIỆU (Sẽ được sửa ở file dưới)
// ======================================================================
interface UserAvatarWithSubscriptionProps {
    badgeText: string;
    badgeColor: string;
    avatarSrc?: string | null;
    size?: number;
    children?: React.ReactNode;
}

function UserAvatarWithSubscription({
    badgeText,
    badgeColor,
    avatarSrc,
    size = 32,
    children
}: UserAvatarWithSubscriptionProps) {

    const ringSize = size + 4;
    return (
        <Box
            sx={{
                position: 'relative',
                width: ringSize,
                height: ringSize,
            }}
        >
            <Box
                sx={{
                    width: ringSize,
                    height: ringSize,
                    borderRadius: '50%',
                    backgroundColor: badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Avatar
                    alt="User Avatar"
                    src={avatarSrc || undefined}
                    sx={{
                        width: size,
                        height: size,
                        border: '2px solid',
                        borderColor: 'background.paper',
                    }}
                >
                    {children}
                </Avatar>
            </Box>

            {badgeText && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: -9,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: badgeColor,
                        color: 'white',
                        px: 0.6,
                        py: 0.1,
                        borderRadius: '6px',
                        fontSize: '0.6rem',
                        fontWeight: 'bold',
                        lineHeight: '1.4',
                        textTransform: 'uppercase',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        whiteSpace: 'nowrap',
                        border: '1px solid',
                        borderColor: 'background.paper'
                    }}
                >
                    {badgeText}
                </Box>
            )}
        </Box>
    );
}


// ======================================================================
// COMPONENT CHÍNH: USER MENU
// ======================================================================
const UserMenu: React.FC = () => {
    const { session, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const [mounted, setMounted] = useState(false);
    const [licenseKey, setLicenseKey] = useState<string | null>(null);
    const [licenseColor, setLicenseColor] = useState<string>("#1976D2");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        setMounted(true);
        
        const fetchSubscriptionDetails = async () => {
            if (session?.user?.subscription_id) {
                try {
                    const response = await apiClient<ISubscription>({
                        url: `/api/v1/subscriptions/${session.user.subscription_id}`,
                        method: 'GET',
                    });

                    if (response.data?.license_key) {
                        setLicenseKey(response.data.license_key);
                        if (response.data.license_id) {
                            try {
                                const licenseResponse = await apiClient<ILicense>({
                                    url: `/api/v1/licenses/${response.data.license_id}`,
                                    method: 'GET',
                                });
                                if (licenseResponse.data?.color) {
                                    setLicenseColor(licenseResponse.data.color);
                                }
                            } catch (licenseError) {
                                console.error("Error fetching license details:", licenseError);
                            }
                        }
                    } else {
                        setLicenseKey('BASIC');
                        setLicenseColor('#1976D2');
                    }
                } catch (error) {
                    console.error("Error fetching subscription:", error);
                    setLicenseKey('BASIC');
                    setLicenseColor('#1976D2');
                } finally {
                    setIsLoading(false);
                }
            } else {
                setLicenseKey('BASIC');
                setLicenseColor('#1976D2');
                setIsLoading(false);
            }
        };

        if (session) {
            fetchSubscriptionDetails();
        } else {
            setIsLoading(false);
        }

    }, [session]);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        handleClose();
        logout();
    };

    if (!mounted || isLoading) {
        return <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: '8px' }} />;
    }

    if (!session) {
        return null;
    }

    const userInitial = session.user?.full_name
        ? session.user.full_name.charAt(0).toUpperCase()
        : (session.user?.email ? session.user.email.charAt(0).toUpperCase() : 'U');

    const avatarUrl = session.user?.avatar_url;

    return (
        <>
            {/* THẺ USER */}
            <Box
                onClick={handleClick}
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    p: 2,
                    px: 2.5,
                    cursor: 'pointer',
                }}
                aria-controls={open ? 'account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
            >
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    mt: -1,
                    mr: 1.5
                }}>
                    <UserAvatarWithSubscription
                        size={32}
                        badgeText={licenseKey || '...'}
                        badgeColor={licenseColor}
                        avatarSrc={avatarUrl}
                    >
                        {userInitial}
                    </UserAvatarWithSubscription>
                </Box>
                
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                        {session.user.full_name || 'User'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {session.user.email}
                    </Typography>
                </Box>
            </Box>

            {/* MENU ĐĂNG XUẤT */}
            <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={open}
                onClose={handleClose}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.15))',
                        mt: 1.5,
                        minWidth: 180,
                        bgcolor: 'background.paper',
                        '&::before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            right: 14,
                            width: 10,
                            height: 10,
                            bgcolor: 'background.paper',
                            transform: 'translateY(-50%) rotate(45deg)',
                            zIndex: 0,
                        },
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Đăng xuất
                </MenuItem>
            </Menu>
        </>
    );
};

export default UserMenu;