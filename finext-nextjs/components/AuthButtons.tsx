'use client';

import React from 'react';
import {
    Box,
    Button,
    useTheme,
    alpha,
    useMediaQuery,
} from '@mui/material';
import {
    Login as LoginIcon,
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface AuthButtonsProps {
    variant?: 'full' | 'compact' | 'icon';
}

export default function AuthButtons({ variant = 'full' }: AuthButtonsProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const router = useRouter();

    const handleSignInClick = () => {
        router.push('/login');
    };

    const handleRegisterClick = () => {
        router.push('/register');
    };

    if (variant === 'icon') {
        return (
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSignInClick}
                    sx={{
                        minWidth: 40,
                        width: 40,
                        height: 40,
                        p: 0,
                        color: theme.palette.primary.main,
                        borderColor: theme.palette.primary.main,
                        borderRadius: 2,
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
                    <LoginIcon fontSize="small" />
                </Button>
                <Button
                    size="small"
                    variant="contained"
                    onClick={handleRegisterClick}
                    sx={{
                        minWidth: 40,
                        width: 40,
                        height: 40,
                        p: 0,
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        borderRadius: 2,
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
                    <PersonAddIcon fontSize="small" />
                </Button>
            </Box>
        );
    }

    if (variant === 'compact' || isMobile) {
        return (
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSignInClick}
                    sx={{
                        minWidth: 85,
                        width: 85, // Đảm bảo width chính xác
                        px: 1.5, // Giảm padding để text vừa
                        py: 0.5,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: theme.palette.primary.main,
                        borderColor: theme.palette.primary.main,
                        borderRadius: 2,
                        textTransform: 'none',
                        whiteSpace: 'nowrap', // Ngăn wrap text
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
                        minWidth: 85,
                        width: 85, // Đảm bảo width chính xác giống nhau
                        px: 1.5, // Giảm padding để text vừa
                        py: 0.5,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        borderRadius: 2,
                        textTransform: 'none',
                        whiteSpace: 'nowrap', // Ngăn wrap text
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

    return (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
            <Button
                startIcon={<LoginIcon sx={{ fontSize: '1rem' }} />}
                variant="outlined"
                onClick={handleSignInClick}
                sx={{
                    minWidth: 120, // Đảm bảo width tối thiểu cho desktop
                    px: 2.5,
                    py: 0.75,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: theme.palette.primary.main,
                    borderColor: theme.palette.primary.main,
                    borderRadius: 2,
                    textTransform: 'none',
                    whiteSpace: 'nowrap', // Ngăn wrap text
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
                    '& .MuiButton-startIcon': {
                        marginRight: 0.5,
                    },
                }}
            >
                Đăng nhập
            </Button>
            <Button
                startIcon={<PersonAddIcon sx={{ fontSize: '1rem' }} />}
                variant="contained"
                onClick={handleRegisterClick}
                sx={{
                    minWidth: 120, // Đảm bảo width tối thiểu giống nhau cho desktop
                    px: 2.5,
                    py: 0.75,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    borderRadius: 2,
                    textTransform: 'none',
                    whiteSpace: 'nowrap', // Ngăn wrap text
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
                    '& .MuiButton-startIcon': {
                        marginRight: 0.5,
                    },
                }}
            >
                Đăng ký
            </Button>
        </Box>
    );
}