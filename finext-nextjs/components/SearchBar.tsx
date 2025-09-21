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
    Modal,
    Backdrop,
    useMediaQuery,
    Tooltip,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Close as CloseIcon,
} from '@mui/icons-material';

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
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

    const handleOpenModal = () => {
        setIsModalOpen(true);
        setIsOpening(true);
        // Sau khi component mount, trigger animation
        setTimeout(() => {
            setIsOpening(false);
        }, 10); // Delay nhỏ để browser có thời gian render
    };

    const handleCloseModal = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsModalOpen(false);
            setIsClosing(false);
            setIsOpening(false);
            setSearchValue('');
        }, theme.transitions.duration.leavingScreen);
    };

    // Hiển thị icon search khi là mobile/tablet (lg breakpoint)
    if (lgDown) {
        return (
            <>
                <Tooltip title="Tìm kiếm" placement="bottom">
                    <IconButton
                        onClick={handleOpenModal}
                        sx={{
                            color: theme.palette.text.secondary,
                            '&:hover': {
                                color: theme.palette.primary.main,
                                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            },
                        }}
                    >
                        <SearchIcon />
                    </IconButton>
                </Tooltip>

                {/* Search Panel với animation slide từ phải, không dùng Modal */}
                {(isModalOpen || isClosing) && (
                    <Box
                        sx={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            height: '100vh',
                            width: { xs: '320px', sm: '320px' },
                            backgroundColor: theme.palette.background.paper,
                            boxShadow: `-8px 0 32px ${alpha(theme.palette.common.black, 0.15)}`,
                            p: 3,
                            outline: 'none',
                            transform: (isModalOpen && !isClosing && !isOpening) ? 'translateX(0)' : 'translateX(100%)',
                            transition: theme.transitions.create('transform', {
                                duration: theme.transitions.duration.leavingScreen,
                                easing: (isModalOpen && !isClosing)
                                    ? theme.transitions.easing.easeOut
                                    : theme.transitions.easing.sharp,
                            }),
                            zIndex: theme.zIndex.modal,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, mt: 1 }}>
                            <Box component="form" onSubmit={handleSubmit} sx={{ flex: 1 }}>
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
                                                        fontSize: 24,
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
                                            borderRadius: '50px',
                                            fontSize: '1rem',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                border: 'none', // Bỏ border
                                            },
                                            backgroundColor: theme.palette.mode === 'light' ? '#ecececc7' : '#2a2a2a',
                                            '&:hover': {
                                                backgroundColor: theme.palette.mode === 'light' ? '#ecececc7' : '#2a2a2a',
                                            },
                                            '&.Mui-focused': {
                                                backgroundColor: theme.palette.mode === 'light' ? '#ecececc7' : '#2a2a2a',
                                                boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                                            },
                                        },
                                    }}
                                />
                            </Box>
                        </Box>
                        {/* TODO: Add search results here */}
                        <Box sx={{
                            color: theme.palette.text.secondary,
                            textAlign: 'center',
                            mt: 4,
                            fontSize: '0.875rem'
                        }}>
                            Nhập từ khóa để tìm kiếm...
                        </Box>
                    </Box>
                )}

                {/* Backdrop overlay khi SearchBar mở */}
                {(isModalOpen || isClosing) && (
                    <Box
                        onClick={handleCloseModal}
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: alpha(theme.palette.common.black, 0.3),
                            opacity: (isModalOpen && !isClosing && !isOpening) ? 1 : 0,
                            transition: theme.transitions.create('opacity', {
                                duration: theme.transitions.duration.leavingScreen,
                                easing: theme.transitions.easing.easeInOut,
                            }),
                            zIndex: theme.zIndex.modal - 1,
                        }}
                    />
                )}
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
                                    fontSize: 20,
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
                        borderRadius: '50px',
                        backgroundColor: theme.palette.mode === 'light' ? '#ecececc7' : '#2a2a2a',
                        backdropFilter: 'blur(8px)',
                        transition: theme.transitions.create([
                            'background-color',
                            'box-shadow'
                        ]),
                        '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none', // Bỏ border
                        },
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'light' ? '#ecececc7' : '#2a2a2a',
                        },
                        '&.Mui-focused': {
                            backgroundColor: theme.palette.mode === 'light' ? '#ecececc7' : '#2a2a2a',
                            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                        },
                    },
                }}
                sx={{
                    '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                        fontWeight: 400,
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