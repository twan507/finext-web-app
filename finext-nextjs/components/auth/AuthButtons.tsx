'use client';

import React from 'react';
import {
    Box,
    Button,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Login as LoginIcon,
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { buttonSize, borderRadius, transitions, shadows, getResponsiveFontSize } from 'theme/tokens';

export default function AuthButtons() {
    const theme = useTheme();
    const router = useRouter();

    const handleSignInClick = () => {
        router.push('/login');
    };

    const handleRegisterClick = () => {
        router.push('/register');
    };

    return (
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }} role="group" aria-label="Xác thực người dùng">
            <Button
                size="small"
                variant="outlined"
                onClick={handleSignInClick}
                sx={{
                    minWidth: 100,
                    height: buttonSize.sm.height,
                    fontSize: getResponsiveFontSize('md'),
                    color: theme.palette.primary.main,
                    borderColor: theme.palette.primary.main,
                    borderRadius: `${borderRadius.md}px`,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    transition: transitions.button,
                    '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        borderColor: theme.palette.primary.dark,
                        color: theme.palette.primary.dark,
                        boxShadow: shadows.button,
                    },
                }}
            >
                Đăng nhập
            </Button>
            <Button
                size="small"
                variant="contained"
                onClick={handleRegisterClick}
                sx={{
                    minWidth: 100,
                    height: buttonSize.sm.height,
                    fontSize: getResponsiveFontSize('md'),
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    borderRadius: `${borderRadius.md}px`,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: shadows.button,
                    transition: transitions.button,
                    '&:hover': {
                        backgroundColor: theme.palette.primary.dark,
                        boxShadow: shadows.buttonHover,
                        transform: 'translateY(-1px)',
                    },
                }}
            >
                Đăng ký
            </Button>
        </Box>
    );
}
