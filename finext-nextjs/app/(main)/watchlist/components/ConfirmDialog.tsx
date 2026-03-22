'use client';

import React from 'react';
import { Dialog, Button, Typography, Box, useTheme, Fade } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message }: ConfirmDialogProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            TransitionComponent={Fade}
            transitionDuration={200}
            maxWidth="xs"
            slotProps={{
                backdrop: {
                    sx: {
                        backgroundColor: 'rgba(139, 92, 246, 0.08)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                    },
                },
            }}
            PaperProps={{
                sx: {
                    m: 2,
                    borderRadius: `${borderRadius.lg}px`,
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                    overflow: 'visible',
                },
            }}
        >
            <Box
                sx={{
                    borderRadius: `${borderRadius.lg}px`,
                    p: { xs: 2.5, md: 3 },
                    bgcolor: isDark ? 'rgba(15, 10, 35, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                    boxShadow: isDark
                        ? '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
                        : '0 8px 32px rgba(107,70,193,0.15), 0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.4)',
                    border: isDark
                        ? '1px solid rgba(255,255,255,0.1)'
                        : '1px solid rgba(107,70,193,0.15)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: isDark
                            ? 'linear-gradient(135deg, rgba(139,92,246,0.05) 0%, rgba(124,58,237,0.02) 100%)'
                            : 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
                        pointerEvents: 'none',
                        zIndex: 0,
                    },
                }}
            >
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    {/* Icon + Title */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: `${borderRadius.md}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: `rgba(239, 68, 68, 0.12)`,
                            }}
                        >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" width={22} color={theme.palette.error.main} />
                        </Box>
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('lg'),
                                fontWeight: fontWeight.bold,
                                color: 'text.primary',
                            }}
                        >
                            {title}
                        </Typography>
                    </Box>

                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            color: 'text.secondary',
                            mb: 3,
                            pl: 0.5,
                        }}
                    >
                        {message}
                    </Typography>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                        <Button
                            onClick={onClose}
                            variant="outlined"
                            sx={{
                                borderRadius: `${borderRadius.md}px`,
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                                color: 'text.secondary',
                                px: 2.5,
                                textTransform: 'none',
                                fontWeight: fontWeight.medium,
                                '&:hover': {
                                    borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                },
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={() => { onConfirm(); onClose(); }}
                            variant="contained"
                            color="error"
                            sx={{
                                borderRadius: `${borderRadius.md}px`,
                                px: 2.5,
                                textTransform: 'none',
                                fontWeight: fontWeight.semibold,
                                boxShadow: '0 0 10px rgba(239,68,68,0.3), 0 0 20px rgba(239,68,68,0.12)',
                                '&:hover': {
                                    boxShadow: '0 0 14px rgba(239,68,68,0.45), 0 0 28px rgba(239,68,68,0.2)',
                                    transform: 'translateY(-1px)',
                                },
                                '&:active': { transform: 'translateY(0)' },
                                transition: 'all 0.2s ease',
                            }}
                        >
                            Xóa
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
}
