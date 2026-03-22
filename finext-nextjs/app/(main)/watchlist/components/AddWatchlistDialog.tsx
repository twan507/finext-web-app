'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    Button,
    TextField,
    Typography,
    Box,
    Autocomplete,
    useTheme,
    alpha,
    Fade,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { apiClient } from 'services/apiClient';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

interface Watchlist {
    id: string;
    _id?: string;
    name: string;
    level: number;
    stock_symbols: string[];
}

interface IndustryInfo {
    name: string;
    tickers: string[];
}

interface AddWatchlistDialogProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    defaultLevel: number;
    editingWatchlist: Watchlist | null;
    industries: IndustryInfo[];
}

export default function AddWatchlistDialog({
    open,
    onClose,
    onSaved,
    defaultLevel,
    editingWatchlist,
    industries,
}: AddWatchlistDialogProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isEditing = !!editingWatchlist;

    const [name, setName] = useState('');
    const [selectedIndustry, setSelectedIndustry] = useState<IndustryInfo | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setName(editingWatchlist ? editingWatchlist.name : '');
            setSelectedIndustry(null);
            setError('');
        }
    }, [open, editingWatchlist]);

    const handleSelectIndustry = (industry: IndustryInfo | null) => {
        setSelectedIndustry(industry);
        if (industry && !name.trim()) {
            setName(industry.name);
        }
    };

    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Tên watchlist không được để trống');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (isEditing) {
                await apiClient({
                    url: `/api/v1/watchlists/${editingWatchlist!.id || editingWatchlist!._id}`,
                    method: 'PUT',
                    body: { name: trimmed },
                    requireAuth: true,
                });
            } else {
                const symbols = selectedIndustry ? selectedIndustry.tickers : [];
                await apiClient({
                    url: '/api/v1/watchlists',
                    method: 'POST',
                    body: { name: trimmed, level: defaultLevel, stock_symbols: symbols },
                    requireAuth: true,
                });
            }
            onSaved();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    // Shared glass card sx
    const glassCardSx = {
        bgcolor: isDark ? 'rgba(15, 10, 35, 0.4)' : 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 8px 32px rgba(107,70,193,0.15), 0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.4)',
        border: isDark
            ? '1px solid rgba(255,255,255,0.1)'
            : '1px solid rgba(107,70,193,0.15)',
        position: 'relative' as const,
        overflow: 'hidden' as const,
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
    };

    // Text field styling for glass context
    const textFieldSx = {
        '& .MuiOutlinedInput-root': {
            borderRadius: `${borderRadius.md}px`,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(107,70,193,0.15)',
            },
            '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(107,70,193,0.3)',
            },
            '&.Mui-focused fieldset': {
                borderColor: theme.palette.primary.main,
            },
        },
        '& .MuiInputLabel-root': {
            color: 'text.secondary',
        },
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            TransitionComponent={Fade}
            transitionDuration={250}
            maxWidth="xs"
            fullWidth
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
                    ...glassCardSx,
                    borderRadius: `${borderRadius.lg}px`,
                    p: { xs: 2.5, md: 3 },
                }}
            >
                {/* Content — above ::before gradient */}
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    {/* Header icon + title */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: `${borderRadius.md}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: alpha(theme.palette.primary.main, 0.12),
                            }}
                        >
                            <Icon
                                icon={isEditing ? 'solar:pen-bold-duotone' : 'solar:add-square-bold-duotone'}
                                width={22}
                                color={theme.palette.primary.main}
                            />
                        </Box>
                        <Box>
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('lg'),
                                    fontWeight: fontWeight.bold,
                                    color: 'text.primary',
                                }}
                            >
                                {isEditing ? 'Đổi tên Watchlist' : 'Tạo Watchlist mới'}
                            </Typography>
                            {!isEditing && (
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        color: 'text.secondary',
                                        mt: 0.25,
                                    }}
                                >
                                    Chọn ngành để thêm nhanh hoặc tạo trống
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    {/* Form fields */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Industry selector — create mode only */}
                        {!isEditing && industries.length > 0 && (
                            <Autocomplete
                                options={industries}
                                getOptionLabel={(opt) => `${opt.name} (${opt.tickers.length})`}
                                value={selectedIndustry}
                                onChange={(_, val) => handleSelectIndustry(val)}
                                size="small"
                                noOptionsText="Không tìm thấy"
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn ngành"
                                        placeholder="Tìm ngành..."
                                        sx={textFieldSx}
                                    />
                                )}
                                slotProps={{
                                    paper: {
                                        sx: {
                                            ...glassCardSx,
                                            borderRadius: `${borderRadius.md}px`,
                                            mt: 0.5,
                                            p: 0,
                                            '& .MuiAutocomplete-listbox': {
                                                '& .MuiAutocomplete-option': {
                                                    fontSize: getResponsiveFontSize('sm'),
                                                    borderRadius: `${borderRadius.sm}px`,
                                                    mx: 0.5,
                                                    '&[aria-selected="true"]': {
                                                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                                                    },
                                                    '&:hover': {
                                                        bgcolor: isDark
                                                            ? 'rgba(255,255,255,0.06)'
                                                            : 'rgba(0,0,0,0.04)',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                }}
                            />
                        )}

                        <TextField
                            label="Tên Watchlist"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !saving) handleSave(); }}
                            fullWidth
                            size="small"
                            autoFocus
                            sx={textFieldSx}
                        />

                        {/* Industry preview */}
                        {selectedIndustry && (
                            <Box
                                sx={{
                                    p: 1.5,
                                    borderRadius: `${borderRadius.sm}px`,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        color: 'text.secondary',
                                        lineHeight: 1.5,
                                    }}
                                >
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontSize: 'inherit',
                                            fontWeight: fontWeight.bold,
                                            color: theme.palette.primary.main,
                                        }}
                                    >
                                        {selectedIndustry.tickers.length} mã
                                    </Typography>
                                    {': '}
                                    {selectedIndustry.tickers.join(', ')}
                                </Typography>
                            </Box>
                        )}

                        {error && (
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    color: theme.palette.error.main,
                                }}
                            >
                                {error}
                            </Typography>
                        )}
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
                        <Button
                            onClick={onClose}
                            disabled={saving}
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
                            onClick={handleSave}
                            disabled={saving}
                            variant="contained"
                            sx={{
                                borderRadius: `${borderRadius.md}px`,
                                px: 2.5,
                                textTransform: 'none',
                                fontWeight: fontWeight.semibold,
                                boxShadow: '0 0 10px rgba(139,92,246,0.3), 0 0 20px rgba(139,92,246,0.12)',
                                '&:hover': {
                                    boxShadow: '0 0 14px rgba(139,92,246,0.45), 0 0 28px rgba(139,92,246,0.2)',
                                    transform: 'translateY(-1px)',
                                },
                                '&:active': {
                                    transform: 'translateY(0)',
                                },
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {saving ? 'Đang lưu...' : isEditing ? 'Lưu' : 'Tạo Watchlist'}
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
}
