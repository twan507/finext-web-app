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

enum DiscountTypeEnumFE {
    PERCENTAGE = "percentage",
    FIXED_AMOUNT = "fixed_amount",
}

interface PromotionPublic {
    id: string;
    promotion_code: string;
    description?: string | null;
    discount_type: DiscountTypeEnumFE;
    discount_value: number;
    is_active: boolean;
    start_date?: string | null;
    end_date?: string | null;
    usage_limit?: number | null;
    usage_count: number;
    applicable_license_keys?: string[] | null;
    created_at: string;
    updated_at: string;
}

interface PromotionSearchProps {
    promotions: PromotionPublic[];
    onFilteredPromotions: (filteredPromotions: PromotionPublic[], isFiltering: boolean) => void;
    loading?: boolean;
}

const PromotionSearch: React.FC<PromotionSearchProps> = ({
    promotions,
    onFilteredPromotions,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Enhanced function to search in all promotion fields
    const searchInPromotion = (promotion: PromotionPublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic promotion fields
        const basicFields = [
            promotion.promotion_code,
            promotion.description,
            promotion.id
        ].filter(field => field); // Remove null/undefined values

        // Discount fields
        const discountFields = [
            promotion.discount_type,
            promotion.discount_type === DiscountTypeEnumFE.PERCENTAGE
                ? `${promotion.discount_value}%`
                : `$${promotion.discount_value.toFixed(2)}`,
            promotion.discount_value.toString()
        ];

        // Status fields
        const statusFields = [
            promotion.is_active ? 'active' : 'inactive',
            promotion.is_active ? 'hoạt động' : 'không hoạt động', // Vietnamese
            promotion.is_active ? 'kích hoạt' : 'hủy kích hoạt' // Vietnamese variations
        ];

        // Usage fields
        const usageFields = [
            promotion.usage_count.toString(),
            promotion.usage_limit?.toString() || 'unlimited',
            promotion.usage_limit ? `${promotion.usage_count}/${promotion.usage_limit}` : `${promotion.usage_count}/∞`
        ];

        // License keys
        const licenseFields = promotion.applicable_license_keys || [];

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (promotion.start_date) {
                const startDate = new Date(promotion.start_date);
                dateFields.push(
                    startDate.toLocaleDateString('vi-VN'),
                    startDate.toLocaleDateString('en-US'),
                    startDate.getFullYear().toString()
                );
            }
            if (promotion.end_date) {
                const endDate = new Date(promotion.end_date);
                dateFields.push(
                    endDate.toLocaleDateString('vi-VN'),
                    endDate.toLocaleDateString('en-US'),
                    endDate.getFullYear().toString()
                );
            }
            if (promotion.created_at) {
                const createdDate = new Date(promotion.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
        } catch (error) {
            // Skip invalid dates
        }

        // Combine all searchable fields
        const allSearchableFields = [
            ...basicFields,
            ...discountFields,
            ...statusFields,
            ...usageFields,
            ...licenseFields,
            ...dateFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered promotions
    const filteredPromotions = useMemo(() => {
        if (!searchTerm.trim()) {
            return promotions;
        }
        return promotions.filter(promotion => searchInPromotion(promotion, searchTerm));
    }, [promotions, searchTerm]);

    // Update parent component when filtered promotions change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredPromotions(filteredPromotions, isActivelyFiltering);
    }, [filteredPromotions, onFilteredPromotions, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = promotions.length;
        const filtered = filteredPromotions.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo Mã khuyến mãi, Mô tả, Loại giảm giá, Trạng thái, Ngày tạo, ..."
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
                            {stats.total} khuyến mãi (trang hiện tại)
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
                                { label: 'Percentage', value: 'percentage' },
                                { label: 'Fixed Amount', value: 'fixed_amount' },
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
                                        height: '22px',
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

export default PromotionSearch;
