// finext-nextjs/app/admin/watchlists/components/WatchlistSearch.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
    Box,
    TextField,
    InputAdornment,
    IconButton,
    Chip,
    Typography,
    Paper,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { WatchlistPublicAdmin } from '../page';

interface WatchlistSearchProps {
    watchlists: WatchlistPublicAdmin[];
    onFilteredWatchlists: (filteredWatchlists: WatchlistPublicAdmin[], isFiltering: boolean) => void;
    loading?: boolean;
}

const WatchlistSearch: React.FC<WatchlistSearchProps> = ({
    watchlists,
    onFilteredWatchlists,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Enhanced function to search in all watchlist fields
    const searchInWatchlist = (watchlist: WatchlistPublicAdmin, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic watchlist fields
        const basicFields = [
            watchlist.name,
            watchlist.id,
            watchlist.user_id,
            watchlist.user_email,
            ...watchlist.stock_symbols // Search in stock symbols too
        ].filter(field => field); // Remove null/undefined values

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (watchlist.created_at) {
                const createdDate = new Date(watchlist.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (watchlist.updated_at) {
                const updatedDate = new Date(watchlist.updated_at);
                dateFields.push(
                    updatedDate.toLocaleDateString('vi-VN'),
                    updatedDate.toLocaleDateString('en-US'),
                    updatedDate.getFullYear().toString()
                );
            }
        } catch (error) {
            // Skip invalid dates
        }

        // Add stock symbols count as searchable
        const additionalFields = [
            watchlist.stock_symbols.length.toString()
        ];

        // Combine all searchable fields
        const allSearchableFields = [
            ...basicFields,
            ...dateFields,
            ...additionalFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered watchlists
    const filteredWatchlists = useMemo(() => {
        if (!searchTerm.trim()) {
            return watchlists;
        }
        return watchlists.filter(watchlist => searchInWatchlist(watchlist, searchTerm));
    }, [watchlists, searchTerm]);

    // Update parent component when filtered watchlists change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredWatchlists(filteredWatchlists, isActivelyFiltering);
    }, [filteredWatchlists, onFilteredWatchlists, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    }; const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = watchlists.length;
        const filtered = filteredWatchlists.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo Tên watchlist, Người dùng, Mã chứng khoán, Ngày tạo, ..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    disabled={loading}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: searchTerm && (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={handleClearSearch}
                                    edge="end"
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            fontSize: '0.8125rem',
                            height: '36px',
                        }
                    }}
                />

                <IconButton
                    size="small"
                    onClick={() => setShowFilters(!showFilters)}
                    color={showFilters ? 'primary' : 'default'}
                    sx={{ minWidth: '36px', height: '36px' }}
                >
                    <FilterIcon fontSize="small" />
                </IconButton>
            </Box>

            {/* Search Statistics - Compact */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {stats.isFiltered ? (
                        <>
                            <Chip
                                label={`${stats.filtered}/${stats.total}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: '20px', fontSize: '0.6875rem' }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                                (trang hiện tại)
                            </Typography>
                        </>
                    ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                            {stats.total} watchlists (trang hiện tại)
                        </Typography>
                    )}
                </Box>

                {searchTerm && (
                    <Chip
                        label={searchTerm}
                        size="small"
                        onDelete={handleClearSearch}
                        color="default"
                        variant="outlined"
                        sx={{ height: '20px', fontSize: '0.6875rem', maxWidth: '120px' }}
                    />
                )}
            </Box>

            {/* Quick Search Filters - Compact */}
            {showFilters && (
                <>
                    <Divider sx={{ my: 1 }} />
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.6875rem' }}>
                            Bộ lọc nhanh:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {[
                                { label: 'Nhiều mã', value: '5' },
                                { label: 'Ít mã', value: '1' },
                                { label: 'VN30', value: 'VN30' },
                                { label: 'HNX30', value: 'HNX30' },
                                { label: 'UPCOM', value: 'UPCOM' },
                                { label: 'Hôm nay', value: new Date().getFullYear().toString() },
                            ].map((filter) => (
                                <Chip
                                    key={filter.value}
                                    label={filter.label}
                                    size="small"
                                    variant={searchTerm === filter.value ? 'filled' : 'outlined'}
                                    color={searchTerm === filter.value ? 'primary' : 'default'}
                                    onClick={() => setSearchTerm(
                                        searchTerm === filter.value ? '' : filter.value
                                    )}
                                    sx={{
                                        cursor: 'pointer',
                                        height: '22px',
                                        fontSize: '0.6875rem'
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                </>
            )}
        </Paper>
    );
};

export default WatchlistSearch;
