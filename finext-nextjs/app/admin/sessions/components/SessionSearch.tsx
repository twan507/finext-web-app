// finext-nextjs/app/admin/sessions/components/SessionSearch.tsx
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

// Interface definition - also exported from parent page
export interface SessionPublicAdmin {
    id: string;
    user_id: string;
    jti: string;
    device_info?: string;
    created_at: string;
    last_active_at: string;
    user_email?: string;
}

interface SessionSearchProps {
    sessions: SessionPublicAdmin[];
    onFilteredSessions: (filteredSessions: SessionPublicAdmin[], isFiltering: boolean) => void;
    loading?: boolean;
}

const SessionSearch: React.FC<SessionSearchProps> = ({
    sessions,
    onFilteredSessions,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Enhanced function to search in all session fields
    const searchInSession = (session: SessionPublicAdmin, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic session fields
        const basicFields = [
            session.id,
            session.user_id,
            session.user_email,
            session.jti,
            session.device_info
        ].filter(field => field); // Remove null/undefined values

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (session.created_at) {
                const createdDate = new Date(session.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (session.last_active_at) {
                const lastActiveDate = new Date(session.last_active_at);
                dateFields.push(
                    lastActiveDate.toLocaleDateString('vi-VN'),
                    lastActiveDate.toLocaleDateString('en-US'),
                    lastActiveDate.getFullYear().toString()
                );
            }
        } catch (error) {
            // Skip invalid dates
        }

        // Device type fields
        const deviceTypes = [];
        if (session.device_info) {
            const deviceLower = session.device_info.toLowerCase();
            if (deviceLower.includes('mobile') || deviceLower.includes('android') || deviceLower.includes('iphone')) {
                deviceTypes.push('mobile', 'di động', 'điện thoại');
            }
            if (deviceLower.includes('chrome')) deviceTypes.push('chrome');
            if (deviceLower.includes('firefox')) deviceTypes.push('firefox');
            if (deviceLower.includes('safari')) deviceTypes.push('safari');
            if (deviceLower.includes('edge')) deviceTypes.push('edge');
            if (deviceLower.includes('windows')) deviceTypes.push('windows');
            if (deviceLower.includes('mac')) deviceTypes.push('mac', 'macos');
            if (deviceLower.includes('linux')) deviceTypes.push('linux');
        }

        // Combine all searchable fields
        const allSearchableFields = [
            ...basicFields,
            ...dateFields,
            ...deviceTypes
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered sessions
    const filteredSessions = useMemo(() => {
        if (!searchTerm.trim()) {
            return sessions;
        }
        return sessions.filter(session => searchInSession(session, searchTerm));
    }, [sessions, searchTerm]);

    // Update parent component when filtered sessions change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredSessions(filteredSessions, isActivelyFiltering);
    }, [filteredSessions, onFilteredSessions, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = sessions.length;
        const filtered = filteredSessions.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo Email người dùng, JWT ID, Thiết bị, Ngày tạo, ..."
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
                            {filteredSessions.length} phiên tìm thấy
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
                                { label: 'Mobile', value: 'mobile' },
                                { label: 'Chrome', value: 'chrome' },
                                { label: 'Firefox', value: 'firefox' },
                                { label: 'Safari', value: 'safari' },
                                { label: 'Windows', value: 'windows' },
                                { label: 'Mac', value: 'mac' },
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
                                        height: '22px'
                                    }} />
                            ))}
                        </Box>
                    </Box>
                </>
            )}
        </Paper>
    );
};

export default SessionSearch;
