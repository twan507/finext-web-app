// finext-nextjs/app/admin/transactions/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Button, TextField, MenuItem, Grid
} from '@mui/material';
import { ReceiptLong as TransactionIcon, Refresh as RefreshIcon, Visibility as ViewIcon, Edit as EditIcon, CheckCircleOutline as ConfirmIcon, CancelOutlined as CancelIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

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

interface PaginatedTransactionsResponse {
    items: TransactionPublic[];
    total: number;
}

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionPublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [filterPaymentStatus, setFilterPaymentStatus] = useState<PaymentStatusEnumFE | ''>('');
    const [filterTransactionType, setFilterTransactionType] = useState<TransactionTypeEnumFE | ''>('');
    const [filterBuyerUserId, setFilterBuyerUserId] = useState<string>('');
    const [filterPromotionCode, setFilterPromotionCode] = useState<string>('');
    const [filterBrokerCode, setFilterBrokerCode] = useState<string>('');

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
            };
            if (filterPaymentStatus) queryParams.payment_status = filterPaymentStatus;
            if (filterTransactionType) queryParams.transaction_type = filterTransactionType;
            if (filterBuyerUserId) queryParams.buyer_user_id = filterBuyerUserId;
            if (filterPromotionCode) queryParams.promotion_code = filterPromotionCode;
            if (filterBrokerCode) queryParams.broker_code_applied = filterBrokerCode;

            const response = await apiClient<PaginatedTransactionsResponse | TransactionPublic[]>({
                url: `/api/v1/transactions/admin/all`,
                method: 'GET',
                queryParams,
            });
            
            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    // Handles PaginatedTransactionsResponse { items: [], total: number }
                    setTransactions(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    // Handles direct TransactionPublic[]
                    console.warn("Backend for transactions did not return total count. Pagination might be inaccurate.");
                    setTransactions(response.data as TransactionPublic[]);
                    const currentDataLength = (response.data as TransactionPublic[]).length;
                     if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API.");
                }
            } else {
                setError(response.message || 'Failed to load transactions.');
                setTransactions([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setTransactions([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filterPaymentStatus, filterTransactionType, filterBuyerUserId, filterPromotionCode, filterBrokerCode]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    const handleViewTransaction = (transactionId: string) => {
        console.log("View transaction (not implemented):", transactionId);
    };

    const handleEditPendingTransaction = (transactionId: string) => {
        console.log("Edit pending transaction (not implemented):", transactionId);
    };
    
    const handleConfirmPayment = async (transactionId: string) => {
        const notes = prompt("Enter admin notes for payment confirmation (optional):");
        // setLoading(true); // Consider a more specific loading state for this action
        try {
            await apiClient({
                url: `/api/v1/transactions/admin/${transactionId}/confirm-payment`,
                method: 'PUT',
                body: { admin_notes: notes }
            });
            fetchTransactions();
        } catch (err: any) {
            setError(err.message || "Failed to confirm payment.");
        } finally {
            // setLoading(false);
        }
    };

    const handleCancelTransaction = async (transactionId: string) => {
        if (window.confirm("Are you sure you want to cancel this pending transaction?")) {
            // setLoading(true);
            try {
                await apiClient({
                    url: `/api/v1/transactions/admin/${transactionId}/cancel`,
                    method: 'PUT'
                });
                fetchTransactions();
            } catch (err: any) {
                setError(err.message || "Failed to cancel transaction.");
            } finally {
                // setLoading(false);
            }
        }
    };

    const getPaymentStatusChipColor = (status: PaymentStatusEnumFE): "success" | "warning" | "default" | "error" => {
        switch (status) {
            case PaymentStatusEnumFE.SUCCEEDED: return "success";
            case PaymentStatusEnumFE.PENDING: return "warning";
            case PaymentStatusEnumFE.CANCELED: return "error";
            default: return "default";
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TransactionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Transactions</Typography>
                </Box>
                 <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchTransactions} disabled={loading}>
                    Refresh
                </Button>
            </Box>

            <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <TextField
                            select
                            label="Payment Status"
                            value={filterPaymentStatus}
                            onChange={(e) => setFilterPaymentStatus(e.target.value as PaymentStatusEnumFE | '')}
                            fullWidth
                            size="small"
                        >
                            <MenuItem value=""><em>All</em></MenuItem>
                            {Object.values(PaymentStatusEnumFE).map(status => (
                                <MenuItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <TextField
                            select
                            label="Transaction Type"
                            value={filterTransactionType}
                            onChange={(e) => setFilterTransactionType(e.target.value as TransactionTypeEnumFE | '')}
                            fullWidth
                            size="small"
                        >
                            <MenuItem value=""><em>All</em></MenuItem>
                            {Object.values(TransactionTypeEnumFE).map(type => (
                                <MenuItem key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <TextField
                            label="Buyer User ID"
                            value={filterBuyerUserId}
                            onChange={(e) => setFilterBuyerUserId(e.target.value)}
                            fullWidth
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <TextField
                            label="Promotion Code"
                            value={filterPromotionCode}
                            onChange={(e) => setFilterPromotionCode(e.target.value)}
                            fullWidth
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <TextField
                            label="Broker Code Applied"
                            value={filterBrokerCode}
                            onChange={(e) => setFilterBrokerCode(e.target.value)}
                            fullWidth
                            size="small"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && transactions.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{minWidth: 120}}>ID</TableCell>
                                        <TableCell sx={{minWidth: 120}}>User ID</TableCell>
                                        <TableCell sx={{minWidth: 100}}>Amount</TableCell>
                                        <TableCell sx={{minWidth: 120}}>License Key</TableCell>
                                        <TableCell sx={{minWidth: 130}}>Type</TableCell>
                                        <TableCell sx={{minWidth: 120}}>Status</TableCell>
                                        <TableCell sx={{minWidth: 150}}>Created At</TableCell>
                                        <TableCell sx={{minWidth: 120}}>Promo Code</TableCell>
                                        <TableCell sx={{minWidth: 120}}>Broker Code</TableCell>
                                        <TableCell align="right" sx={{minWidth: 180}}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(transactions) && transactions.map((transaction) => (
                                        <TableRow hover key={transaction.id}>
                                            <TableCell>
                                                <Tooltip title={transaction.id}>
                                                    <Typography variant="body2" sx={{maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        ...{transaction.id.slice(-6)}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={transaction.buyer_user_id}>
                                                    <Typography variant="body2" sx={{maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        ...{transaction.buyer_user_id.slice(-6)}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>${transaction.transaction_amount.toFixed(2)}</TableCell>
                                            <TableCell>{transaction.license_key}</TableCell>
                                            <TableCell>
                                                <Chip label={transaction.transaction_type.replace('_', ' ').toUpperCase()} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={transaction.payment_status} color={getPaymentStatusChipColor(transaction.payment_status)} size="small" />
                                            </TableCell>
                                            <TableCell>{format(parseISO(transaction.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell>{transaction.promotion_code_applied || 'N/A'}</TableCell>
                                            <TableCell>{transaction.broker_code_applied || 'N/A'}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="View Details">
                                                    <IconButton size="small" onClick={() => handleViewTransaction(transaction.id)}><ViewIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                {transaction.payment_status === PaymentStatusEnumFE.PENDING && (
                                                    <>
                                                        <Tooltip title="Edit Pending Details">
                                                            <IconButton size="small" onClick={() => handleEditPendingTransaction(transaction.id)} color="info"><EditIcon fontSize="small" /></IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Confirm Payment">
                                                            <IconButton size="small" onClick={() => handleConfirmPayment(transaction.id)} color="success"><ConfirmIcon fontSize="small" /></IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Cancel Transaction">
                                                            <IconButton size="small" onClick={() => handleCancelTransaction(transaction.id)} color="error"><CancelIcon fontSize="small" /></IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                     {Array.isArray(transactions) && transactions.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={10} align="center">No transactions found matching your criteria.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50, 100]}
                            component="div"
                            count={totalCount}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </>
                )}
            </Paper>
        </Box>
    );
}