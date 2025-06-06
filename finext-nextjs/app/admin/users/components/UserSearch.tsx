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

interface UserPublic {
    id: string;
    role_ids: string[];
    full_name: string;
    email: string;
    phone_number?: string | null;
    is_active?: boolean;
    created_at: string;
    updated_at: string;
    avatar_url?: string | null;
    referral_code?: string | null;
    google_id?: string | null;
    subscription_id?: string | null;
}

interface UserSearchProps {
    users: UserPublic[];
    onFilteredUsers: (filteredUsers: UserPublic[]) => void;
    loading?: boolean;
}

const UserSearch: React.FC<UserSearchProps> = ({
    users,
    onFilteredUsers,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Function to search in all user fields
    const searchInUser = (user: UserPublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();

        if (!searchLower) return true;

        // Search in all text fields
        const searchFields = [
            user.full_name,
            user.email,
            user.phone_number,
            user.referral_code,
            user.id,
            // Convert boolean and array fields to searchable strings
            user.is_active ? 'active' : 'inactive',
            user.google_id ? 'google' : 'email',
            user.subscription_id ? 'premium' : 'free',
            // Search in roles
            ...(user.role_ids || []),
            // Search in formatted date
            new Date(user.created_at).toLocaleDateString('vi-VN')
        ];

        return searchFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered users
    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) {
            return users;
        }
        return users.filter(user => searchInUser(user, searchTerm));
    }, [users, searchTerm]);

    // Update parent component when filtered users change
    React.useEffect(() => {
        onFilteredUsers(filteredUsers);
    }, [filteredUsers, onFilteredUsers]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = users.length;
        const filtered = filteredUsers.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats(); return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm user theo tên, email, số điện thoại, trạng thái, subscription..."
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
                        </>
                    ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                            {stats.total} users
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
            </Box>            {/* Quick Search Filters - Compact */}
            {showFilters && (
                <>
                    <Divider sx={{ my: 1 }} />
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.6875rem' }}>
                            Bộ lọc nhanh:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {[
                                { label: 'Active', value: 'active' },
                                { label: 'Inactive', value: 'inactive' },
                                { label: 'Premium', value: 'premium' },
                                { label: 'Free', value: 'free' },
                                { label: 'Google', value: 'google' },
                                { label: 'Email', value: 'email' },
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

export default UserSearch;
