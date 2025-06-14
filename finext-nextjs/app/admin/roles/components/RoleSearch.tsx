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

interface RolePublic {
    id: string;
    name: string;
    description?: string | null;
    permission_ids: string[];
    created_at: string;
    updated_at: string;
}

interface RoleSearchProps {
    roles: RolePublic[];
    onFilteredRoles: (filteredRoles: RolePublic[], isFiltering: boolean) => void;
    loading?: boolean;
}

const RoleSearch: React.FC<RoleSearchProps> = ({
    roles,
    onFilteredRoles,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);    // Enhanced function to search in all role fields
    const searchInRole = (role: RolePublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic role fields
        const basicFields = [
            role.name,
            role.description || '',
            role.id
        ].filter(field => field); // Remove null/undefined values

        // Permission count fields
        const permissionFields = [
            role.permission_ids?.length?.toString() || '0',
            `${role.permission_ids?.length || 0} permissions`,
            `${role.permission_ids?.length || 0} quyền`
        ];

        // Date fields (formatted for Vietnamese locale)
        const dateFields: string[] = [];
        try {
            if (role.created_at) {
                const createdDate = new Date(role.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (role.updated_at) {
                const updatedDate = new Date(role.updated_at);
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
            ...permissionFields,
            ...dateFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered roles
    const filteredRoles = useMemo(() => {
        if (!searchTerm.trim()) {
            return roles;
        }
        return roles.filter(role => searchInRole(role, searchTerm));
    }, [roles, searchTerm]);

    // Update parent component when filtered roles change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredRoles(filteredRoles, isActivelyFiltering);
    }, [filteredRoles, onFilteredRoles, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    }; const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = roles.length;
        const filtered = filteredRoles.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo Tên vai trò, Mô tả, Số quyền, Ngày tạo, ..."
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
                            {stats.total} vai trò (trang hiện tại)
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
                                { label: 'Admin', value: 'admin' },
                                { label: 'User', value: 'user' },
                                { label: 'Broker', value: 'broker' },
                                { label: 'Manager', value: 'manager' },
                                { label: 'Moderator', value: 'moderator' },
                                { label: '2024', value: '2024' },
                                { label: '2023', value: '2023' },
                                { label: 'Tháng này', value: new Date().toLocaleDateString('vi-VN').split('/').slice(1).join('/') },
                                { label: 'Có mô tả', value: 'description' },
                                { label: 'Không mô tả', value: 'no description' },
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

export default RoleSearch;
