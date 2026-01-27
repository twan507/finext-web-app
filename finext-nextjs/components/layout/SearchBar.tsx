'use client';

import React, { useState, useEffect } from 'react';
import {
    TextField,
    InputAdornment,
    Box,
    useTheme,
    alpha,
    IconButton,
    Fade,
    Drawer,
    useMediaQuery,
    Tooltip,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { fontSize, iconSize, borderRadius, shadows } from 'theme/tokens';

interface SearchBarProps {
    placeholder?: string;
    variant?: 'compact' | 'full' | 'icon';
}

export default function SearchBar({
    placeholder = "Tìm kiếm cổ phiếu, tin tức...",
    variant = 'full'
}: SearchBarProps) {
    const [searchValue, setSearchValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [currentPlaceholder, setCurrentPlaceholder] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const theme = useTheme();

    // Danh sách các placeholder để hiển thị
    const placeholderTexts = [
        "Tìm kiếm cổ phiếu, tin tức...",
        "Nhập mã cổ phiếu...",
        "Tìm kiếm công ty...",
        "Khám phá thị trường..."
    ];
    const [currentTextIndex, setCurrentTextIndex] = useState(0);

    // Sử dụng cùng breakpoint với sidebar (lg)
    const lgDown = useMediaQuery(theme.breakpoints.down('lg'));

    // Typing animation effect
    useEffect(() => {
        if (searchValue || isFocused) return; // Không chạy animation khi đang có text hoặc đang focus

        const currentText = placeholderTexts[currentTextIndex];
        let timeoutId: NodeJS.Timeout;

        if (isTyping) {
            // Typing animation - gõ từng ký tự
            const nextLength = currentPlaceholder.length + 1;
            if (nextLength <= currentText.length) {
                timeoutId = setTimeout(() => {
                    setCurrentPlaceholder(currentText.slice(0, nextLength));
                }, 100); // Tốc độ gõ
            } else {
                // Đã gõ xong, chờ một chút rồi bắt đầu xóa
                timeoutId = setTimeout(() => {
                    setIsTyping(false);
                }, 2000); // Dừng 2 giây
            }
        } else {
            // Erasing animation - xóa từng ký tự
            if (currentPlaceholder.length > 0) {
                timeoutId = setTimeout(() => {
                    setCurrentPlaceholder(currentPlaceholder.slice(0, -1));
                }, 50); // Tốc độ xóa nhanh hơn
            } else {
                // Đã xóa xong, chuyển sang text tiếp theo
                setCurrentTextIndex((prev) => (prev + 1) % placeholderTexts.length);
                setIsTyping(true);
            }
        }

        return () => clearTimeout(timeoutId);
    }, [currentPlaceholder, isTyping, currentTextIndex, searchValue, isFocused, placeholderTexts]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(event.target.value);
        // TODO: Implement actual search functionality
    };

    const handleClearSearch = () => {
        setSearchValue('');
        // TODO: Clear search results
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (searchValue.trim()) {
            // TODO: Implement search submission
            console.log('Searching for:', searchValue);
        }
    };

    const handleOpenDrawer = () => {
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setSearchValue('');
    };

    // Hiển thị icon search khi là mobile/tablet (lg breakpoint)
    if (lgDown) {
        return (
            <>
                <Tooltip title="Tìm kiếm" placement="bottom">
                    <IconButton
                        onClick={handleOpenDrawer}
                        aria-label="Mở tìm kiếm"
                        sx={{
                            p: 0, // Không padding để nút sát cạnh phải
                            color: theme.palette.text.secondary,
                            '&:hover': {
                                color: theme.palette.primary.main,
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        <SearchIcon aria-hidden="true" />
                    </IconButton>
                </Tooltip>

                {/* Search Drawer - sử dụng MUI Drawer giống layout để không gây xê dịch giao diện */}
                <Drawer
                    anchor="right"
                    open={isDrawerOpen}
                    onClose={handleCloseDrawer}
                    ModalProps={{ keepMounted: true }}
                    elevation={0}
                    aria-label="Tìm kiếm"
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: { xs: 300, sm: 320 },
                            boxShadow: shadows.drawerLeft,
                            backdropFilter: 'blur(12px)',
                            backgroundColor: theme.palette.background.paper,
                        },
                    }}
                >
                    <Box sx={{ p: 3 }}>
                        {/* Header với nút đóng */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box
                                component="h2"
                                id="search-drawer-title"
                                sx={{
                                    color: theme.palette.text.primary,
                                    fontWeight: 600,
                                    fontSize: fontSize.lg.tablet,
                                    m: 0,
                                }}
                            >
                                Tìm kiếm
                            </Box>
                            <IconButton
                                onClick={handleCloseDrawer}
                                size="small"
                                aria-label="Đóng tìm kiếm"
                                sx={{
                                    color: theme.palette.text.secondary,
                                    '&:hover': {
                                        color: theme.palette.text.primary,
                                        backgroundColor: alpha(theme.palette.text.primary, 0.08),
                                    },
                                }}
                            >
                                <CloseIcon fontSize="small" aria-hidden="true" />
                            </IconButton>
                        </Box>

                        {/* Search input */}
                        <Box component="form" onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                autoFocus
                                size="small"
                                value={searchValue}
                                onChange={handleSearchChange}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                placeholder={isFocused ? '' : currentPlaceholder}
                                variant="outlined"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon
                                                sx={{
                                                    color: theme.palette.primary.main,
                                                    fontSize: iconSize.lg,
                                                }}
                                            />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchValue && (
                                        <InputAdornment position="end">
                                            <Fade in={!!searchValue}>
                                                <IconButton
                                                    size="small"
                                                    onClick={handleClearSearch}
                                                    sx={{
                                                        color: theme.palette.text.secondary,
                                                        '&:hover': {
                                                            color: theme.palette.text.primary,
                                                            backgroundColor: alpha(theme.palette.text.primary, 0.08),
                                                        },
                                                    }}
                                                >
                                                    <ClearIcon fontSize="small" />
                                                </IconButton>
                                            </Fade>
                                        </InputAdornment>
                                    ),
                                    sx: {
                                        borderRadius: borderRadius.pill,
                                        fontSize: fontSize.lg.tablet,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            border: 'none',
                                        },
                                        backgroundColor: alpha(theme.palette.text.primary, 0.04),
                                        '&:hover': {
                                            backgroundColor: alpha(theme.palette.text.primary, 0.06),
                                        },
                                        '&.Mui-focused': {
                                            backgroundColor: alpha(theme.palette.text.primary, 0.04),
                                            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                                        },
                                    },
                                }}
                            />
                        </Box>

                        {/* TODO: Add search results here */}
                        <Box sx={{
                            color: theme.palette.text.secondary,
                            textAlign: 'center',
                            mt: 4,
                            fontSize: fontSize.base.tablet
                        }}>
                            Nhập từ khóa để tìm kiếm...
                        </Box>
                    </Box>
                </Drawer>
            </>
        );
    }

    // Desktop version - thanh tìm kiếm đầy đủ và dài hơn
    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                maxWidth: variant === 'compact' ? 400 : 500,
                minWidth: variant === 'compact' ? 300 : 400,
                width: '100%',
            }}
        >
            <TextField
                fullWidth
                size="small"
                value={searchValue}
                onChange={handleSearchChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={isFocused ? '' : currentPlaceholder}
                variant="outlined"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon
                                sx={{
                                    color: isFocused
                                        ? theme.palette.primary.main
                                        : theme.palette.text.secondary,
                                    fontSize: iconSize.md,
                                    transition: theme.transitions.create('color'),
                                }}
                            />
                        </InputAdornment>
                    ),
                    endAdornment: searchValue && (
                        <InputAdornment position="end">
                            <Fade in={!!searchValue}>
                                <IconButton
                                    size="small"
                                    onClick={handleClearSearch}
                                    sx={{
                                        padding: 0.5,
                                        color: theme.palette.text.secondary,
                                        '&:hover': {
                                            color: theme.palette.text.primary,
                                            backgroundColor: alpha(theme.palette.text.primary, 0.08),
                                        },
                                    }}
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </Fade>
                        </InputAdornment>
                    ),
                    sx: {
                        borderRadius: borderRadius.pill,
                        backgroundColor: theme.palette.background.paper,
                        backdropFilter: 'blur(8px)',
                        transition: theme.transitions.create([
                            'background-color',
                            'box-shadow'
                        ]),
                        '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none', // Bỏ border
                        },
                        '&:hover': {
                            backgroundColor: theme.palette.background.paper,
                        },
                        '&.Mui-focused': {
                            backgroundColor: theme.palette.background.paper,
                            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                        },
                    },
                }}
                sx={{
                    '& .MuiInputBase-input': {
                        fontSize: fontSize.sm.tablet,
                        fontWeight: 400,
                        padding: '6px 0',
                        '&::placeholder': {
                            color: theme.palette.text.secondary,
                            opacity: 0.7,
                        },
                    },
                }}
            />
        </Box>
    );
}