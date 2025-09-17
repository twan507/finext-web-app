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

interface SubscriptionPublic {
    id: string;
    user_id: string;
    user_email: string;
    license_id: string;
    license_key: string;
    is_active: boolean;
    start_date: string;
    expiry_date: string;
    created_at: string;
    updated_at: string;
}

interface SubscriptionSearchProps {
    subscriptions: SubscriptionPublic[];
    onFilteredSubscriptions: (filteredSubscriptions: SubscriptionPublic[], isFiltering: boolean) => void;
    loading?: boolean;
}

const SubscriptionSearch: React.FC<SubscriptionSearchProps> = ({
    subscriptions,
    onFilteredSubscriptions,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);    // Helper function to calculate remaining days
    const calculateRemainingDays = (expiryDate: string): number => {
        try {
            const expiry = new Date(expiryDate);
            const now = new Date();
            const diffTime = expiry.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch (error) {
            return 0;
        }
    };

    // Enhanced function to search in all subscription fields and related data
    const searchInSubscription = (subscription: SubscriptionPublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic subscription fields
        const basicFields = [
            subscription.id,
            subscription.user_id,
            subscription.user_email,
            subscription.license_id,
            subscription.license_key
        ].filter(field => field); // Remove null/undefined values

        // Status fields
        const statusFields = [
            subscription.is_active ? 'active' : 'inactive',
            subscription.is_active ? 'hoạt động' : 'không hoạt động', // Vietnamese
            subscription.is_active ? 'kích hoạt' : 'hủy kích hoạt' // Vietnamese variations
        ];

        // Calculate remaining days and add searchable terms
        const remainingDays = calculateRemainingDays(subscription.expiry_date);
        const remainingDaysFields = [
            remainingDays.toString(),
            remainingDays > 0 ? `${remainingDays} ngày` : '',
            remainingDays > 0 ? `còn ${remainingDays} ngày` : '',
            remainingDays === 0 ? 'hết hạn hôm nay' : '',
            remainingDays === 0 ? 'expired today' : '',
            remainingDays < 0 ? `đã hết hạn ${Math.abs(remainingDays)} ngày` : '',
            remainingDays < 0 ? `expired ${Math.abs(remainingDays)} days ago` : '',
            remainingDays > 7 ? 'còn lâu' : '',
            remainingDays <= 7 && remainingDays > 0 ? 'sắp hết hạn' : '',
            remainingDays < 0 ? 'đã hết hạn' : ''
        ].filter(field => field); // Remove empty strings

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (subscription.start_date) {
                const startDate = new Date(subscription.start_date);
                dateFields.push(
                    startDate.toLocaleDateString('vi-VN'),
                    startDate.toLocaleDateString('en-US'),
                    startDate.getFullYear().toString()
                );
            }
            if (subscription.expiry_date) {
                const expiryDate = new Date(subscription.expiry_date);
                dateFields.push(
                    expiryDate.toLocaleDateString('vi-VN'),
                    expiryDate.toLocaleDateString('en-US'),
                    expiryDate.getFullYear().toString()
                );
            }
            if (subscription.created_at) {
                const createdDate = new Date(subscription.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (subscription.updated_at) {
                const updatedDate = new Date(subscription.updated_at);
                dateFields.push(
                    updatedDate.toLocaleDateString('vi-VN'),
                    updatedDate.toLocaleDateString('en-US'),
                    updatedDate.getFullYear().toString()
                );
            }
        } catch (error) {
            // Skip invalid dates
        }

        // Combine all searchable fields
        const allSearchableFields = [
            ...basicFields,
            ...statusFields,
            ...remainingDaysFields,
            ...dateFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered subscriptions
    const filteredSubscriptions = useMemo(() => {
        if (!searchTerm.trim()) {
            return subscriptions;
        }
        return subscriptions.filter(subscription => searchInSubscription(subscription, searchTerm));
    }, [subscriptions, searchTerm]);

    // Update parent component when filtered subscriptions change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredSubscriptions(filteredSubscriptions, isActivelyFiltering);
    }, [filteredSubscriptions, onFilteredSubscriptions, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = subscriptions.length;
        const filtered = filteredSubscriptions.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>                <TextField
                fullWidth
                size="small"
                placeholder="Tìm kiếm theo Email, License Key, Trạng thái, Số ngày còn lại, Ngày tạo/chỉnh sửa, ..."
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
                                sx={{ height: '20px' }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                (trang hiện tại)
                            </Typography>
                        </>
                    ) : (
                        <Typography variant="caption" color="text.secondary">
                            {filteredSubscriptions.length} đăng ký tìm thấy
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
                        sx={{ height: '20px', maxWidth: '120px' }}
                    />
                )}
            </Box>

            {/* Quick Search Filters - Compact */}
            {showFilters && (
                <>
                    <Divider sx={{ my: 1 }} />
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            Bộ lọc nhanh:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {[
                                { label: 'Active', value: 'active' },
                                { label: 'Inactive', value: 'inactive' },
                                { label: 'PRO', value: 'pro' },
                                { label: 'PREMIUM', value: 'premium' },
                                { label: 'BASIC', value: 'basic' },
                                { label: '2024', value: '2024' },
                                { label: '2023', value: '2023' },
                                { label: 'Tháng này', value: new Date().toLocaleDateString('vi-VN').split('/').slice(1).join('/') },
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
                                        height: '22px'
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

export default SubscriptionSearch;
