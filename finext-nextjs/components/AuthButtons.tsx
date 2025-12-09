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
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
                size="small"
                variant="outlined"
                onClick={handleSignInClick}
                sx={{
                    minWidth: 100,
                    height: 30,
                    fontSize: '0.875rem',
                    fontWeight: 400,
                    color: theme.palette.primary.main,
                    borderColor: theme.palette.primary.main,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    transition: theme.transitions.create([
                        'background-color',
                        'border-color',
                        'color',
                        'box-shadow'
                    ]),
                    '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        borderColor: theme.palette.primary.dark,
                        color: theme.palette.primary.dark,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
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
                    height: 30,
                    fontSize: '0.875rem',
                    fontWeight: 400,
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                    transition: theme.transitions.create([
                        'background-color',
                        'box-shadow',
                        'transform'
                    ]),
                    '&:hover': {
                        backgroundColor: theme.palette.primary.dark,
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                        transform: 'translateY(-1px)',
                    },
                }}
            >
                Đăng ký
            </Button>
        </Box>
    );
}
