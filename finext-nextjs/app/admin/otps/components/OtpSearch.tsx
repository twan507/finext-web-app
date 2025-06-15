// finext-nextjs/app/admin/otps/components/OtpSearch.tsx
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

// OTP Type enum
export enum OtpTypeEnumFE {
    EMAIL_VERIFICATION = "email_verification",
    RESET_PASSWORD = "reset_password",
    PWDLESS_LOGIN = "pwdless_login",
}

// Interface for OTP admin view
export interface OtpPublicAdmin {
    id: string;
    user_id: string;
    otp_type: OtpTypeEnumFE;
    expires_at: string;
    created_at: string;
    verified_at?: string | null;
    attempts?: number;
    user_email?: string;
}

interface OtpSearchProps {
    otps: OtpPublicAdmin[];
    onFilteredOtps: (filteredOtps: OtpPublicAdmin[], isFiltering: boolean) => void;
    loading?: boolean;
}

const OtpSearch: React.FC<OtpSearchProps> = ({
    otps,
    onFilteredOtps,
    loading = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Enhanced function to search in all OTP fields
    const searchInOtp = (otp: OtpPublicAdmin, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic OTP fields
        const basicFields = [
            otp.id,
            otp.user_id,
            otp.user_email,
            otp.otp_type,
            otp.attempts?.toString()
        ].filter(field => field); // Remove null/undefined values

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (otp.created_at) {
                const createdDate = new Date(otp.created_at);
                dateFields.push(
                    createdDate.toLocaleDateString('vi-VN'),
                    createdDate.toLocaleDateString('en-US'),
                    createdDate.getFullYear().toString()
                );
            }
            if (otp.expires_at) {
                const expiresDate = new Date(otp.expires_at);
                dateFields.push(
                    expiresDate.toLocaleDateString('vi-VN'),
                    expiresDate.toLocaleDateString('en-US'),
                    expiresDate.getFullYear().toString()
                );
            }
            if (otp.verified_at) {
                const verifiedDate = new Date(otp.verified_at);
                dateFields.push(
                    verifiedDate.toLocaleDateString('vi-VN'),
                    verifiedDate.toLocaleDateString('en-US'),
                    verifiedDate.getFullYear().toString()
                );
            }
        } catch (error) {
            // Skip invalid dates
        }

        // Status fields
        const statusFields = [];
        const now = new Date();
        const expiresAt = new Date(otp.expires_at);
        if (otp.verified_at) {
            statusFields.push('verified', 'đã xác thực');
        } else if (expiresAt < now) {
            statusFields.push('expired', 'hết hạn');
        } else {
            statusFields.push('pending', 'chờ xác thực');
        }

        // OTP type translations
        const typeTranslations = [];
        switch (otp.otp_type) {
            case OtpTypeEnumFE.EMAIL_VERIFICATION:
                typeTranslations.push('email verification', 'xác thực email');
                break;
            case OtpTypeEnumFE.RESET_PASSWORD:
                typeTranslations.push('reset password', 'đặt lại mật khẩu');
                break;
            case OtpTypeEnumFE.PWDLESS_LOGIN:
                typeTranslations.push('passwordless login', 'đăng nhập không mật khẩu');
                break;
        }

        // Combine all searchable fields
        const allSearchableFields = [
            ...basicFields,
            ...dateFields,
            ...statusFields,
            ...typeTranslations
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered OTPs
    const filteredOtps = useMemo(() => {
        if (!searchTerm.trim()) {
            return otps;
        }
        return otps.filter(otp => searchInOtp(otp, searchTerm));
    }, [otps, searchTerm]);    // Update parent component when filtered OTPs change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredOtps(filteredOtps, isActivelyFiltering);
    }, [filteredOtps, onFilteredOtps, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = otps.length;
        const filtered = filteredOtps.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo Email, Loại OTP, Trạng thái, Ngày tạo, ..."
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
                            {stats.total} OTPs (trang hiện tại)
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
                                { label: 'Đã xác thực', value: 'đã xác thực' },
                                { label: 'Chờ xác thực', value: 'chờ xác thực' },
                                { label: 'Hết hạn', value: 'hết hạn' },
                                { label: 'Email', value: 'email' },
                                { label: 'Đặt lại MK', value: 'đặt lại' },
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

export default OtpSearch;
