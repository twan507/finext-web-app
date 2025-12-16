'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Alert,
    CircularProgress,
    Card,
    CardContent,
    Chip,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    useTheme,
} from '@mui/material';
import {
    CardMembership,
    Schedule,
    Today,
    History,
    Verified,
    Cancel,
    CheckCircle,
} from '@mui/icons-material';
import { apiClient } from '../../../../services/apiClient';
import { fontSize } from 'theme/tokens';

interface Subscription {
    id: string;
    license_key?: string;
    license_id?: string;
    is_active?: boolean;
    start_date?: string;
    expiry_date?: string;
    created_at?: string;
}

interface Transaction {
    id: string;
    license_key?: string;
    duration_days?: number;
    purchased_duration_days?: number;
    payment_status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
    created_at?: string;
}

interface ILicense {
    _id: string;
    key: string;
    name: string;
    color: string;
}

export default function PageContent() {
    const theme = useTheme();
    const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
    const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [licenseColor, setLicenseColor] = useState<string>("#1565c0");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch current subscription
            const subscriptionResponse = await apiClient<Subscription>({
                url: '/api/v1/subscriptions/me/current',
                method: 'GET',
            });

            // Fetch transaction history  
            const transactionsResponse = await apiClient<Transaction[]>({
                url: '/api/v1/transactions/me/history',
                method: 'GET',
            });

            setCurrentSubscription(subscriptionResponse.data || null);
            setTransactionHistory(transactionsResponse.data || []);

            // Fetch license color if available
            if (subscriptionResponse.data?.license_id) {
                try {
                    const licenseResponse = await apiClient<ILicense>({
                        url: `/api/v1/licenses/${subscriptionResponse.data.license_id}`,
                        method: 'GET',
                    });
                    if (licenseResponse.data?.color) {
                        setLicenseColor(licenseResponse.data.color);
                    }
                } catch (licenseError) {
                    console.error("Error fetching license details:", licenseError);
                }
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error?.message || 'Có lỗi xảy ra khi tải dữ liệu',
            });
        } finally {
            setLoading(false);
        }
    };

    // Helper function to parse date strings consistently
    const parseDate = (dateString: string) => {
        if (!dateString) throw new Error('Invalid date string');
        if (dateString.includes('Z') || dateString.includes('+') ||
            (dateString.includes('T') && dateString.lastIndexOf('-') > 10)) {
            return new Date(dateString);
        } else {
            return new Date(dateString + 'Z');
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Chưa có thông tin';
        try {
            const dbTime = parseDate(dateString);
            return dbTime.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            return 'Lỗi định dạng ngày';
        }
    };

    const formatExpiryDate = (dateString?: string) => {
        if (!dateString) return 'Chưa có thông tin';
        try {
            const dbTime = parseDate(dateString);
            return dbTime.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            return 'Lỗi định dạng ngày';
        }
    };

    const isExpired = (expiryDate?: string) => {
        if (!expiryDate) return false;
        try {
            const expiry = new Date(expiryDate);
            const now = new Date();
            return expiry.getTime() < now.getTime();
        } catch (error) {
            return false;
        }
    };

    const isExpiringSoon = (expiryDate?: string) => {
        if (!expiryDate) return false;
        try {
            const expiry = new Date(expiryDate);
            const now = new Date();
            const diffMs = expiry.getTime() - now.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7; // Sắp hết hạn trong 7 ngày
        } catch (error) {
            return false;
        }
    };

    const isSpecialLicense = (licenseKey?: string) => {
        if (!licenseKey) return false;
        const key = licenseKey.toUpperCase();
        return ['BASIC', 'MANAGER', 'PARTNER', 'BROKER', 'ADMIN'].includes(key);
    };

    const getTransactionStatusText = (status: string) => {
        switch (status) {
            case 'succeeded':
                return 'Thành công';
            case 'pending':
                return 'Đang xử lý';
            case 'failed':
                return 'Thất bại';
            case 'cancelled':
                return 'Đã hủy';
            default:
                return status;
        }
    };

    const getTransactionStatusColors = (status: string, isDark: boolean) => {
        switch (status) {
            case 'succeeded':
                return {
                    borderColor: isDark ? '#4caf50' : '#2e7d32',
                    color: isDark ? '#4caf50' : '#2e7d32',
                    backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(46, 125, 50, 0.08)'
                };
            case 'pending':
                return {
                    borderColor: isDark ? '#ff9800' : '#f57c00',
                    color: isDark ? '#ff9800' : '#f57c00',
                    backgroundColor: isDark ? 'rgba(255, 152, 0, 0.1)' : 'rgba(245, 124, 0, 0.08)'
                };
            case 'failed':
                return {
                    borderColor: isDark ? '#f44336' : '#d32f2f',
                    color: isDark ? '#f44336' : '#d32f2f',
                    backgroundColor: isDark ? 'rgba(244, 67, 54, 0.1)' : 'rgba(211, 47, 47, 0.08)'
                };
            case 'cancelled':
                return {
                    borderColor: isDark ? '#9e9e9e' : '#616161',
                    color: isDark ? '#9e9e9e' : '#616161',
                    backgroundColor: isDark ? 'rgba(158, 158, 158, 0.1)' : 'rgba(97, 97, 97, 0.08)'
                };
            default:
                return {
                    borderColor: isDark ? '#9e9e9e' : '#757575',
                    color: isDark ? '#9e9e9e' : '#757575',
                    backgroundColor: isDark ? 'rgba(158, 158, 158, 0.1)' : 'rgba(117, 117, 117, 0.08)'
                };
        }
    };

    if (loading) {
        return (
            <Box sx={{ maxWidth: 600, width: '100%', color: 'text.primary' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    const renderTransactionTable = () => {
        return (
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', width: '20%' }}>
                                Gói License
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', width: '25%', textAlign: 'center' }}>
                                Thời hạn
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', width: '30%', textAlign: 'center' }}>
                                Ngày thực hiện
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', textAlign: 'center', width: '25%' }}>
                                Trạng thái
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {transactionHistory
                            .sort((a, b) => {
                                const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                                const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                                return bTime - aTime;
                            })
                            .map((transaction, index) => (
                                <TableRow
                                    key={transaction.id}
                                    sx={{
                                        '&:hover': {
                                            bgcolor: 'action.hover'
                                        }
                                    }}
                                >
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                            {transaction.license_key ? transaction.license_key.toUpperCase() : 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center' }}>
                                        <Typography variant="body2">
                                            {transaction.purchased_duration_days || transaction.duration_days || 0} ngày
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center' }}>
                                        <Typography variant="body2">
                                            {transaction.created_at ? formatDate(transaction.created_at) : 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center' }}>
                                        <Chip
                                            label={getTransactionStatusText(transaction.payment_status)}
                                            size="small"
                                            sx={{
                                                ...getTransactionStatusColors(transaction.payment_status, theme.palette.mode === 'dark'),
                                                fontWeight: 'medium',
                                                '&:hover': {
                                                    backgroundColor: getTransactionStatusColors(transaction.payment_status, theme.palette.mode === 'dark').backgroundColor
                                                }
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    return (
        <Box sx={{ maxWidth: 600, width: '100%', color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
                        Gói đăng ký
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Quản lý các gói đã mua và hiện tại
                    </Typography>
                </Box>
            </Box>

            {/* Message */}
            {message && (
                <Alert
                    severity={message.type}
                    sx={{ mb: 3 }}
                    onClose={() => setMessage(null)}
                >
                    {message.text}
                </Alert>
            )}

            {/* Current Subscription Section */}
            <Box sx={{ mb: 3 }}>
                {currentSubscription ? (
                    <Card sx={{
                        position: 'relative',
                        border: '2px solid',
                        borderColor: 'primary.main',
                        borderRadius: 3,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.03) 0%, rgba(25, 118, 210, 0.08) 100%)',
                    }}>
                        <CardContent sx={{ p: 3, pb: 5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', flex: 1 }}>
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ alignItems: 'center', mb: 1.5 }}>
                                            <Typography variant="h6" sx={{
                                                fontWeight: 'bold',
                                                mr: 2,
                                            }}>
                                                Gói hiện tại
                                            </Typography>
                                        </Box>

                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            flexWrap: 'wrap',
                                        }}>
                                            <Box
                                                sx={{
                                                    backgroundColor: licenseColor,
                                                    color: 'white',
                                                    px: 1.2,
                                                    py: 0.4,
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                {currentSubscription.license_key ? currentSubscription.license_key.toUpperCase() : 'N/A'}
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <Today sx={{
                                                    fontSize: fontSize.h6.mobile,
                                                    mr: 1,
                                                    color: 'primary.main'
                                                }} />
                                                <Box>
                                                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                                        {!currentSubscription.license_key ? "Ngày Bắt đầu" : "Thời hạn"}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                        {isSpecialLicense(currentSubscription.license_key) ? 'Vô thời hạn' : (currentSubscription.start_date ? formatDate(currentSubscription.start_date) : 'N/A')}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            {!isSpecialLicense(currentSubscription.license_key) && (
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Schedule sx={{
                                                        fontSize: fontSize.h6.mobile,
                                                        mr: 1,
                                                        color: 'primary.main'
                                                    }} />
                                                    <Box>
                                                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                                            Ngày Kết thúc
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                            {formatExpiryDate(currentSubscription.expiry_date)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <CardMembership sx={{ fontSize: fontSize.display.tablet, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                Chưa có gói đăng ký
                            </Typography>
                            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                                Bạn chưa có gói subscription nào đang hoạt động
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </Box>

            {/* Transaction History Section */}
            <Box>
                {transactionHistory.length === 0 ? (
                    <Card sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 3,
                        boxShadow: '0 2px 16px rgba(0,0,0,0.08)'
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                                Lịch sử đăng ký
                            </Typography>
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <History sx={{ fontSize: fontSize.display.tablet, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary">
                                    Chưa có gói đăng ký nào
                                </Typography>
                                <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                                    Lịch sử các gói đăng ký sẽ được hiển thị tại đây.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                ) : (
                    <Card sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 3,
                        boxShadow: '0 2px 16px rgba(0,0,0,0.08)'
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                                Lịch sử đăng ký
                            </Typography>
                            {renderTransactionTable()}
                        </CardContent>
                    </Card>
                )}
            </Box>
        </Box>
    );
}
