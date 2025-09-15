'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from 'components/AuthProvider';
import { apiClient } from 'services/apiClient';

import {
    Avatar, IconButton, Menu, MenuItem, ListItemIcon, Typography, Divider, Box, Skeleton
} from '@mui/material';
import {
    PersonOutline as PersonOutlineIcon,
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
// COMPONENT: AVATAR VỚI HUY HIỆU (ĐÃ SỬA ĐỔI)
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

    // Kích thước của vòng bao quanh, lớn hơn avatar 2px mỗi bên
    const ringSize = size + 4; return (
        <Box
            sx={{
                position: 'relative',
                width: ringSize,
                height: ringSize,
                // Tăng margin bottom để có đủ không gian cho badge
                mb: '10px',
            }}
        >
            {/* Box này đóng vai trò là vòng bao (ring) màu */}
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
                        // Thêm viền nhỏ màu nền để tách biệt avatar khỏi vòng màu
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
                        // Đẩy badge xuống dưới nhiều hơn để ít che avatar
                        bottom: -8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: badgeColor,
                        color: 'white',
                        px: 0.75,
                        py: 0.1,
                        borderRadius: '6px',
                        fontSize: '0.6rem',
                        fontWeight: 'bold',
                        lineHeight: '1.4',
                        textTransform: 'uppercase',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', // Thêm shadow nhẹ
                        whiteSpace: 'nowrap',
                        // Thêm viền nhỏ để tạo hiệu ứng liền mạch hơn
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
// COMPONENT CHÍNH: USER MENU (Không thay đổi logic)
// ======================================================================
const UserMenu: React.FC = () => {
    const { session, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const [mounted, setMounted] = useState(false);
    const [licenseKey, setLicenseKey] = useState<string | null>(null);
    const [licenseColor, setLicenseColor] = useState<string>("#1976D2"); // Default blue
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

                        // Fetch license details to get color
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
                                // Keep default color if license fetch fails
                            }
                        }
                    } else {
                        setLicenseKey('BASIC');
                        setLicenseColor('#1976D2'); // Default blue for BASIC
                    }

                } catch (error) {
                    console.error("Error fetching subscription:", error);
                    setLicenseKey('BASIC');
                    setLicenseColor('#1976D2'); // Default blue for BASIC
                } finally {
                    setIsLoading(false);
                }
            } else {
                setLicenseKey('BASIC');
                setLicenseColor('#1976D2'); // Default blue for BASIC
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

    const handleViewProfile = () => {
        handleClose();
        console.log("Xem thông tin người dùng (chưa triển khai)");
    };

    const renderPlaceholder = () => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: 48 }}>
            <Skeleton variant="circular" width={32} height={32} sx={{ ml: 2 }} />
        </Box>
    );

    if (!mounted || isLoading) {
        return renderPlaceholder();
    }

    if (!session) {
        return null; // Hoặc một UI đăng nhập
    }

    const userInitial = session.user?.full_name
        ? session.user.full_name.charAt(0).toUpperCase()
        : (session.user?.email ? session.user.email.charAt(0).toUpperCase() : 'U');

    const avatarUrl = session.user?.avatar_url;

    return (
        <>
            <IconButton
                onClick={handleClick}
                size="small"
                // Điều chỉnh sx để IconButton không bị quá lớn
                sx={{ ml: 2, p: 0, width: 40, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-controls={open ? 'account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
            >
                <UserAvatarWithSubscription
                    size={32}
                    badgeText={licenseKey || '...'}
                    badgeColor={licenseColor}
                    avatarSrc={avatarUrl}
                >
                    {userInitial}
                </UserAvatarWithSubscription>
            </IconButton>
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
                        minWidth: 200,
                        bgcolor: 'background.paper',
                        '& .MuiAvatar-root': {
                            width: 32,
                            height: 32,
                            ml: -0.5,
                            mr: 1,
                        },
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
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle1" noWrap>
                        {session.user.full_name || 'User'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {session.user.email}
                    </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={handleViewProfile} disabled>
                    <ListItemIcon>
                        <PersonOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    Xem thông tin
                </MenuItem>
                <Divider />
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