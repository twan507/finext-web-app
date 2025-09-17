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
import { isSystemUser } from 'utils/systemProtection';

interface BrokerPublic {
    id: string;
    user_id: string;
    broker_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    user_email?: string; // Optional field for future use
}

interface BrokerSearchProps {
    brokers: BrokerPublic[];
    onFilteredBrokers: (filteredBrokers: BrokerPublic[], isFiltering: boolean) => void;
    loading?: boolean;
    userEmails?: Map<string, string>;
}

const BrokerSearch: React.FC<BrokerSearchProps> = ({
    brokers,
    onFilteredBrokers,
    loading = false,
    userEmails = new Map()
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Enhanced function to search in all broker fields and related data
    const searchInBroker = (broker: BrokerPublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;        // Basic broker fields
        const basicFields = [
            broker.broker_code,
            broker.user_id,
            broker.user_email,  // Include user email if available
            userEmails.get(broker.user_id), // Include fetched email
            broker.id
        ].filter(field => field); // Remove null/undefined values

        // Type fields for system users
        const typeFields = [];
        const brokerEmail = userEmails.get(broker.user_id) || broker.user_email || '';
        if (isSystemUser(brokerEmail)) {
            typeFields.push('system', 'hệ thống', 'he thong', 'system user', 'người dùng hệ thống');
        }

        // Status fields
        const statusFields = [
            broker.is_active ? 'active' : 'inactive',
            broker.is_active ? 'hoạt động' : 'không hoạt động', // Vietnamese
            broker.is_active ? 'kích hoạt' : 'hủy kích hoạt' // Vietnamese variations
        ];

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (broker.created_at) {
                const createdDate = new Date(broker.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (broker.updated_at) {
                const updatedDate = new Date(broker.updated_at);
                dateFields.push(
                    updatedDate.toLocaleDateString('vi-VN'),
                    updatedDate.toLocaleDateString('en-US'),
                    updatedDate.getFullYear().toString()
                );
            }
        } catch (error) {
            // Skip invalid dates
        }        // Combine all searchable fields
        const allSearchableFields = [
            ...basicFields,
            ...typeFields,
            ...statusFields,
            ...dateFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered brokers
    const filteredBrokers = useMemo(() => {
        if (!searchTerm.trim()) {
            return brokers;
        }
        return brokers.filter(broker => searchInBroker(broker, searchTerm));
    }, [brokers, searchTerm, userEmails]);

    // Update parent component when filtered brokers change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredBrokers(filteredBrokers, isActivelyFiltering);
    }, [filteredBrokers, onFilteredBrokers, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = brokers.length;
        const filtered = filteredBrokers.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo Mã môi giới, User ID, Email, Trạng thái, Ngày tạo, ..."
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
                            {filteredBrokers.length} nhà môi giới tìm thấy
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
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>                            {[
                            { label: 'Hệ thống', value: 'hệ thống' },
                            { label: 'Active', value: 'active' },
                            { label: 'Inactive', value: 'inactive' },
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

export default BrokerSearch;
