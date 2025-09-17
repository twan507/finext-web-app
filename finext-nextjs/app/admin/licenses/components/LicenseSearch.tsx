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

interface LicensePublic {
    id: string;
    key: string;
    name: string;
    price: number;
    duration_days: number;
    is_active: boolean;
    feature_keys: string[];
    created_at?: string;
    updated_at?: string;
}

interface LicenseSearchProps {
    licenses: LicensePublic[];
    onFilteredLicenses: (filteredLicenses: LicensePublic[], isFiltering: boolean) => void;
    loading?: boolean;
}

const LicenseSearch: React.FC<LicenseSearchProps> = ({
    licenses,
    onFilteredLicenses,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Helper function to format duration for search
    const formatDurationForSearch = (days: number): string[] => {
        const formatOptions = [];

        if (days >= 365) {
            const years = Math.floor(days / 365);
            const remainingDays = days % 365;
            if (remainingDays === 0) {
                formatOptions.push(`${years} năm`, `${years} year${years > 1 ? 's' : ''}`);
            } else {
                const months = Math.floor(remainingDays / 30);
                if (months === 0) {
                    formatOptions.push(
                        `${years} năm ${remainingDays} ngày`,
                        `${years} year${years > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`
                    );
                } else {
                    formatOptions.push(
                        `${years} năm ${months} tháng`,
                        `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`
                    );
                }
            }
        } else if (days >= 30) {
            const months = Math.floor(days / 30);
            const remainingDays = days % 30;
            if (remainingDays === 0) {
                formatOptions.push(`${months} tháng`, `${months} month${months > 1 ? 's' : ''}`);
            } else {
                formatOptions.push(
                    `${months} tháng ${remainingDays} ngày`,
                    `${months} month${months > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`
                );
            }
        } else {
            formatOptions.push(`${days} ngày`, `${days} day${days > 1 ? 's' : ''}`);
        }

        // Add raw number
        formatOptions.push(days.toString());

        return formatOptions;
    };

    // Enhanced function to search in all license fields
    const searchInLicense = (license: LicensePublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic license fields
        const basicFields = [
            license.key,
            license.name,
            license.id
        ].filter(field => field); // Remove null/undefined values

        // Price fields (Vietnamese format)
        const priceFields = [
            license.price.toString(),
            license.price.toLocaleString('vi-VN'),
            `${license.price.toLocaleString('vi-VN')} VND`,
            `${license.price.toLocaleString('vi-VN')}₫`,
            `${(license.price / 1000).toFixed(0)}k`, // Shortened format like 50k
            `${(license.price / 1000000).toFixed(1)}M` // Shortened format like 1.5M
        ];

        // Status fields
        const statusFields = [
            license.is_active ? 'active' : 'inactive',
            license.is_active ? 'hoạt động' : 'không hoạt động', // Vietnamese
            license.is_active ? 'kích hoạt' : 'hủy kích hoạt' // Vietnamese variations
        ];

        // Duration fields
        const durationFields = formatDurationForSearch(license.duration_days);

        // Feature count fields
        const featureFields = [
            license.feature_keys.length.toString(),
            `${license.feature_keys.length} features`,
            `${license.feature_keys.length} tính năng`
        ];

        // Feature keys
        const featureKeysFields = license.feature_keys || [];

        // Date fields (formatted for Vietnamese locale)
        const dateFields: string[] = [];
        try {
            if (license.created_at) {
                const createdDate = new Date(license.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (license.updated_at) {
                const updatedDate = new Date(license.updated_at);
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
            ...priceFields,
            ...statusFields,
            ...durationFields,
            ...featureFields,
            ...featureKeysFields,
            ...dateFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered licenses
    const filteredLicenses = useMemo(() => {
        if (!searchTerm.trim()) {
            return licenses;
        }
        return licenses.filter(license => searchInLicense(license, searchTerm));
    }, [licenses, searchTerm]);

    // Update parent component when filtered licenses change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredLicenses(filteredLicenses, isActivelyFiltering);
    }, [filteredLicenses, onFilteredLicenses, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = licenses.length;
        const filtered = filteredLicenses.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo License Key, Tên, Giá, Thời hạn, Trạng thái, Tính năng, Ngày tạo, ..."
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
                            {filteredLicenses.length} licenses tìm thấy
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
                                { label: '1 năm', value: '365' },
                                { label: '6 tháng', value: '180' },
                                { label: '1 tháng', value: '30' },
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

export default LicenseSearch;
