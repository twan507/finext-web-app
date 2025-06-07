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

interface RolePublic {
    id: string;
    name: string;
    description?: string;
    permission_ids: string[];
    created_at: string;
    updated_at: string;
}

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

interface UserSearchProps {
    users: UserPublic[];
    roles: RolePublic[];
    subscriptions: Map<string, SubscriptionPublic>;
    subscriptionsLoading?: boolean;
    protectedEmails?: string[];
    onFilteredUsers: (filteredUsers: UserPublic[], isFiltering: boolean) => void;
    loading?: boolean;
}

const UserSearch: React.FC<UserSearchProps> = ({
    users,
    roles,
    subscriptions,
    subscriptionsLoading = false,
    protectedEmails = [],
    onFilteredUsers,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Helper function to get role names from role IDs
    const getRoleNames = (roleIds: string[]): string[] => {
        return roleIds.map(roleId => {
            const role = roles.find(r => r.id === roleId);
            return role ? role.name : roleId;
        });
    };

    // Helper function to get subscription info for search
    const getSubscriptionInfo = (userId: string) => {
        const subscription = subscriptions.get(userId);
        if (!subscription) {
            return { status: 'Free', isActive: false, licenseKey: '' };
        }

        const isActive = subscription.is_active && new Date(subscription.expiry_date) > new Date();
        return {
            status: isActive ? 'Premium' : 'Expired',
            isActive,
            licenseKey: subscription.license_key
        };
    };

    // Enhanced function to search in all user fields and related data
    const searchInUser = (user: UserPublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic user fields
        const basicFields = [
            user.full_name,
            user.email,
            user.phone_number,
            user.referral_code,
            user.id
        ].filter(field => field); // Remove null/undefined values        // Status fields
        const statusFields = [
            user.is_active ? 'active' : 'inactive',
            user.google_id ? 'google' : 'credentials',
            protectedEmails.includes(user.email) ? 'protected' : 'unprotected'
        ];

        // Role names
        const userRoleNames = getRoleNames(user.role_ids || []);

        // Subscription information
        const subscriptionInfo = getSubscriptionInfo(user.id);
        const subscriptionFields = [
            subscriptionInfo.status.toLowerCase(), // 'free', 'premium', 'expired'
            subscriptionInfo.licenseKey
        ];

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (user.created_at) {
                const createdDate = new Date(user.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (user.updated_at) {
                const updatedDate = new Date(user.updated_at);
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
            ...userRoleNames,
            ...subscriptionFields,
            ...dateFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered users
    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) {
            return users;
        }
        return users.filter(user => searchInUser(user, searchTerm));
    }, [users, searchTerm]);    // Update parent component when filtered users change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredUsers(filteredUsers, isActivelyFiltering);
    }, [filteredUsers, onFilteredUsers, searchTerm]);

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>                <TextField
                fullWidth
                size="small"
                placeholder="Tìm kiếm theo tên, email, SĐT, trạng thái, protection, subscription, vai trò, mã giới thiệu, phương thức đăng nhập, ngày tham gia..."
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
            </Box>            {/* Search Statistics - Compact */}
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
                            {stats.total} users (trang hiện tại)
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
            </Box>{/* Quick Search Filters - Compact */}
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
                                { label: 'Expired', value: 'expired' },
                                { label: 'Google', value: 'google' },
                                { label: 'Credentials', value: 'credentials' },
                                { label: 'Admin', value: 'admin' },
                                { label: 'User', value: 'user' },
                                { label: 'Broker', value: 'broker' },
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
