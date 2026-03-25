// finext-nextjs/app/(main)/reports/PageContent.tsx
'use client';

import { useState, useCallback } from 'react';
import { Box, Typography, Chip, TextField, InputAdornment, IconButton } from '@mui/material';
import { Clear, Search } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

import { ReportList } from './components';
import NewsBreadcrumb from '../news/components/NewsBreadcrumb';
import { spacing, fontWeight, borderRadius } from 'theme/tokens';
import { REPORT_TYPES_INFO, ReportType } from './types';
import { OptionalAuthWrapper } from '@/components/auth/OptionalAuthWrapper';
import { BASIC_AND_ABOVE } from '@/components/auth/features';

export default function ReportsContent() {
    const router = useRouter();
    const [tickerFilter, setTickerFilter] = useState('');
    const [tickerSearch, setTickerSearch] = useState('');

    const handleTypeClick = (type: ReportType) => {
        router.push(`/reports/type/${type}`);
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
            <NewsBreadcrumb sectionLabel="Báo cáo" sectionHref="/reports" items={[]} />

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
                        Báo cáo tổng hợp
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                    >
                        Tổng hợp và phân tích tin tức thị trường theo ngày, tuần và tháng.
                    </Typography>
                </Box>

                {/* Ticker Filter */}
                <TextField
                    size="small"
                    placeholder="Lọc theo Mã Ngành, Mã CP"
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

            {/* BASIC GATE: Type Tabs + Report List */}
            <OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE}>
                {/* Type Tabs - Level 1 */}
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
                        onClick={() => router.push('/reports')}
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
                    {REPORT_TYPES_INFO.map((typeInfo) => (
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

                {/* Report List - Show all */}
                <ReportList ticker={tickerSearch || undefined} />
            </OptionalAuthWrapper>
        </Box>
    );
}
