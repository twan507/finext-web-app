// finext-nextjs/@/components/UserMenu.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

// MUI Components
import {
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography,
  Divider,
  Box
} from '@mui/material';
import {
  PersonOutline as PersonOutlineIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';

const UserMenu: React.FC = () => {
  const { session, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose(); // Đóng menu trước khi logout
    logout();
  };

  const handleViewProfile = () => {
      handleClose();
      // Hiện tại chưa có chức năng, có thể thêm sau:
      // router.push('/profile'); 
      console.log("Xem thông tin người dùng (chưa triển khai)");
  };

  if (!session) {
    return null; // Không hiển thị gì nếu chưa có session
  }

  const userInitial = session.user?.full_name
    ? session.user.full_name.charAt(0).toUpperCase()
    : (session.user?.email ? session.user.email.charAt(0).toUpperCase() : 'U');

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{ ml: 2 }}
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
        onClick={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.15))',
            mt: 1.5,
            minWidth: 200,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&::before': { // Tạo mũi tên nhỏ phía trên
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
        <MenuItem onClick={handleViewProfile} disabled> {/* Tạm thời disable */}
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