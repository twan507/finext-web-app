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

enum PaymentStatusEnumFE {
    PENDING = "pending",
    SUCCEEDED = "succeeded",
    CANCELED = "canceled",
}

enum TransactionTypeEnumFE {
    NEW_PURCHASE = "new_purchase",
    RENEWAL = "renewal",
}

interface TransactionPublic {
    id: string;
    buyer_user_id: string;
    license_id: string;
    license_key: string;
    original_license_price: number;
    purchased_duration_days: number;
    promotion_code_applied?: string | null;
    promotion_discount_amount?: number | null;
    broker_code_applied?: string | null;
    broker_discount_amount?: number | null;
    total_discount_amount?: number | null;
    transaction_amount: number;
    payment_status: PaymentStatusEnumFE;
    transaction_type: TransactionTypeEnumFE;
    notes?: string | null;
    target_subscription_id?: string | null;
    created_at: string;
    updated_at: string;
}

interface TransactionSearchProps {
    transactions: TransactionPublic[];
    onFilteredTransactions: (filteredTransactions: TransactionPublic[], isFiltering: boolean) => void;
    loading?: boolean;
    userEmails?: Map<string, string>;
}

const TransactionSearch: React.FC<TransactionSearchProps> = ({
    transactions,
    onFilteredTransactions,
    loading = false,
    userEmails = new Map()
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Enhanced function to search in all transaction fields and related data
    const searchInTransaction = (transaction: TransactionPublic, term: string): boolean => {
        const searchLower = term.toLowerCase().trim();
        if (!searchLower) return true;

        // Basic transaction fields
        const basicFields = [
            transaction.buyer_user_id,
            transaction.license_id,
            transaction.license_key,
            transaction.promotion_code_applied,
            transaction.broker_code_applied,
            transaction.notes,
            transaction.target_subscription_id,
            userEmails.get(transaction.buyer_user_id), // Include fetched email
            transaction.id
        ].filter(field => field); // Remove null/undefined values

        // Payment status fields
        const paymentStatusFields = [
            transaction.payment_status,
            transaction.payment_status === PaymentStatusEnumFE.SUCCEEDED ? 'thành công' : '',
            transaction.payment_status === PaymentStatusEnumFE.PENDING ? 'đang chờ' : '',
            transaction.payment_status === PaymentStatusEnumFE.CANCELED ? 'đã hủy' : '',
        ].filter(field => field);

        // Transaction type fields
        const typeFields = [
            transaction.transaction_type,
            transaction.transaction_type === TransactionTypeEnumFE.NEW_PURCHASE ? 'mua mới' : '',
            transaction.transaction_type === TransactionTypeEnumFE.RENEWAL ? 'gia hạn' : '',
        ].filter(field => field);

        // Amount fields
        const amountFields = [
            transaction.transaction_amount.toString(),
            transaction.original_license_price.toString(),
            transaction.purchased_duration_days.toString(),
            transaction.promotion_discount_amount?.toString(),
            transaction.broker_discount_amount?.toString(),
            transaction.total_discount_amount?.toString(),
        ].filter(field => field);

        // Date fields (formatted for Vietnamese locale)
        const dateFields = [];
        try {
            if (transaction.created_at) {
                const createdDate = new Date(transaction.created_at);
                const gmt7Date = new Date(createdDate.getTime() + (7 * 60 * 60 * 1000));
                dateFields.push(
                    gmt7Date.toLocaleDateString('vi-VN'),
                    gmt7Date.toLocaleDateString('en-US'),
                    gmt7Date.getFullYear().toString(),
                    gmt7Date.getMonth() + 1 + '/' + gmt7Date.getFullYear(), // MM/YYYY
                );
            }
            if (transaction.updated_at) {
                const updatedDate = new Date(transaction.updated_at);
                const gmt7Date = new Date(updatedDate.getTime() + (7 * 60 * 60 * 1000));
                dateFields.push(
                    gmt7Date.toLocaleDateString('vi-VN'),
                    gmt7Date.toLocaleDateString('en-US'),
                    gmt7Date.getFullYear().toString()
                );
            }
        } catch (error) {
            // Skip invalid dates
        }

        // Combine all searchable fields
        const allSearchableFields = [
            ...basicFields,
            ...paymentStatusFields,
            ...typeFields,
            ...amountFields,
            ...dateFields
        ];

        // Check if any field contains the search term
        return allSearchableFields.some(field =>
            field && field.toString().toLowerCase().includes(searchLower)
        );
    };

    // Memoized filtered transactions
    const filteredTransactions = useMemo(() => {
        if (!searchTerm.trim()) {
            return transactions;
        }
        return transactions.filter(transaction => searchInTransaction(transaction, searchTerm));
    }, [transactions, searchTerm, userEmails]);

    // Update parent component when filtered transactions change
    React.useEffect(() => {
        const isActivelyFiltering = searchTerm.trim() !== '';
        onFilteredTransactions(filteredTransactions, isActivelyFiltering);
    }, [filteredTransactions, onFilteredTransactions, searchTerm]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const getSearchStats = () => {
        const total = transactions.length;
        const filtered = filteredTransactions.length;
        return { total, filtered, isFiltered: searchTerm.trim() !== '' };
    };

    const stats = getSearchStats();

    return (
        <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Tìm kiếm theo ID, User Email, License Key, Mã KM, Mã Broker, Số tiền, Trạng thái, Ngày tạo..."
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
                            {filteredTransactions.length} giao dịch tìm thấy
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
                                { label: 'Thành công', value: 'succeeded' },
                                { label: 'Đang chờ', value: 'pending' },
                                { label: 'Đã hủy', value: 'canceled' },
                                { label: 'Mua mới', value: 'new_purchase' },
                                { label: 'Gia hạn', value: 'renewal' },
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

export default TransactionSearch;
