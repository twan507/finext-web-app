// finext-nextjs/app/(main)/news/PageContent.tsx
'use client';

import { useState, useCallback } from 'react';
import { Box, Typography, Chip, TextField, InputAdornment, IconButton } from '@mui/material';
import { Search, Clear } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

import { NewsBreadcrumb, NewsList } from './components';
import { spacing, fontWeight, borderRadius } from 'theme/tokens';
import { NEWS_TYPES_INFO, NewsType } from './types';

export default function NewsContent() {
    const router = useRouter();
    const [tickerFilter, setTickerFilter] = useState('');
    const [tickerSearch, setTickerSearch] = useState('');

    const handleTypeClick = (type: NewsType) => {
        router.push(`/news/type/${type}`);
    };

    const handleTickerSubmit = useCallback(() => {
        setTickerSearch(tickerFilter.trim().toUpperCase());
    }, [tickerFilter]);

    const handleTickerClear = useCallback(() => {
        setTickerFilter('');
        setTickerSearch('');
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleTickerSubmit();
        }
    }, [handleTickerSubmit]);

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb items={[]} />

            {/* Header */}
            <Box sx={{
                mb: spacing.xs,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                gap: spacing.xs,
            }}>
                <Box>
                    <Typography variant="h1">
                        Tin tức thị trường
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                    >
                        Cập nhật tin tức tài chính, chứng khoán và các sự kiện nổi bật từ nhiều nguồn uy tín.
                    </Typography>
                </Box>

                {/* Ticker Filter */}
                <TextField
                    size="small"
                    placeholder="Lọc theo Ngành hoặc mã CK"
                    value={tickerFilter}
                    onChange={(e) => setTickerFilter(e.target.value)}
                    onKeyDown={handleKeyDown}
                    sx={{
                        minWidth: 200,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: `${borderRadius.md}px`,
                            height: 32,
                        },
                        '& .MuiInputBase-input': {
                            fontSize: '1rem',
                            py: '4px',
                        },
                        '& .MuiInputBase-input::placeholder': {
                            fontSize: '0.875rem',
                        },
                    }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: tickerFilter ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={handleTickerClear} edge="end">
                                        <Clear fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        },
                    }}
                />
            </Box>

            {/* Type Tabs */}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    mb: spacing.xs,
                }}
            >
                <Chip
                    label="Tất cả"
                    onClick={() => router.push('/news')}
                    color="default"
                    variant="filled"
                    sx={{
                        fontWeight: fontWeight.semibold,
                        border: 'none',
                        backgroundColor: 'primary.main',
                        color: '#ffffff',
                        '&:hover': {
                            backgroundColor: 'primary.dark',
                        },
                    }}
                />
                {NEWS_TYPES_INFO.map((typeInfo) => (
                    <Chip
                        key={typeInfo.type}
                        label={typeInfo.type_name}
                        onClick={() => handleTypeClick(typeInfo.type)}
                        color="default"
                        variant="filled"
                        sx={{ fontWeight: fontWeight.medium, border: 'none' }}
                    />
                ))}
            </Box>

            {/* News List */}
            <NewsList ticker={tickerSearch || undefined} />
        </Box>
    );
}

