// finext-nextjs/app/(dashboard)/_components/UserMenu.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from 'components/AuthProvider';
// ThemeToggleButton đã được di chuyển, không cần import ở đây nữa

import {
    Avatar, IconButton, Menu, MenuItem, ListItemIcon, Typography, Divider, Box, Skeleton
} from '@mui/material';
import {
    PersonOutline as PersonOutlineIcon,
    Logout as LogoutIcon,
} from '@mui/icons-material';

const UserMenu: React.FC = () => {
    const { session, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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

    // Placeholder khi component chưa mount hoặc session chưa có
    const renderPlaceholder = () => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: 48 }}>
            {/* Chỉ còn placeholder cho avatar vì nút theme đã chuyển đi */}
            <Skeleton variant="circular" width={32} height={32} sx={{ ml: 1 }} />
        </Box>
    );

    if (!mounted) {
        return renderPlaceholder();
    }

    if (!session) {
        return renderPlaceholder();
    }

    const userInitial = session.user?.full_name
        ? session.user.full_name.charAt(0).toUpperCase()
        : (session.user?.email ? session.user.email.charAt(0).toUpperCase() : 'U');

    return (
        // Box display:flex đã bị loại bỏ vì ThemeToggleButton không còn ở đây
        <>
            <IconButton
                onClick={handleClick}
                size="small"
                sx={{ ml: 2 }} // Có thể điều chỉnh lại margin nếu cần
                aria-controls={open ? 'account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
            >
                <Avatar sx={{ width: 32, height: 32 }}>{userInitial}</Avatar>
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
