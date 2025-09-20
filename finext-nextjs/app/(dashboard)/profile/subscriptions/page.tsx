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
    Divider,
} from '@mui/material';
import {
    CardMembership,
    Schedule,
    Today,
    History,
    Verified,
    Cancel,
} from '@mui/icons-material';
import { apiClient } from '../../../../services/apiClient';
import { useAuth } from '../../../../components/AuthProvider';

interface Subscription {
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

interface Transaction {
    id: string;
    buyer_user_id: string;
    license_key: string;
    duration_days: number;
    payment_status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
    transaction_type: 'purchase' | 'renewal' | 'upgrade';
    amount: number;
    currency: string;
    broker_code_applied?: string;
    promotion_code?: string;
    created_at: string;
    updated_at: string;
}

export default function SubscriptionsPage() {
    const { session: currentSession } = useAuth();
    const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
    const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

            console.log('Fetched current subscription:', subscriptionResponse.data);
            console.log('Fetched transaction history:', transactionsResponse.data);

            setCurrentSubscription(subscriptionResponse.data || null);
            setTransactionHistory(transactionsResponse.data || []);
        } catch (error: any) {
            console.error('Fetch data error:', error);
            setMessage({
                type: 'error',
                text: error?.message || 'Có lỗi xảy ra khi tải dữ liệu',
            });
        } finally {
            setLoading(false);
        }
    };

    const getLicenseName = (licenseKey: string) => {
        const key = licenseKey.toUpperCase();
        switch (key) {
            case 'BASIC':
                return 'Gói Cơ Bản';
            case 'PRO':
                return 'Gói Pro';
            case 'PREMIUM':
                return 'Gói Premium';
            default:
                return licenseKey;
        }
    };

    const formatDate = (dateString: string) => {
        let dbTime;
        if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('T') && dateString.lastIndexOf('-') > 10) {
            dbTime = new Date(dateString);
        } else {
            dbTime = new Date(dateString + 'Z');
        }

        return dbTime.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatExpiryDate = (dateString: string) => {
        let dbTime;
        if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('T') && dateString.lastIndexOf('-') > 10) {
            dbTime = new Date(dateString);
        } else {
            dbTime = new Date(dateString + 'Z');
        }

        const now = new Date();
        const diffMs = dbTime.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Đã hết hạn';
        if (diffDays === 0) return 'Hết hạn hôm nay';
        if (diffDays === 1) return 'Hết hạn ngày mai';
        if (diffDays < 30) return `Còn ${diffDays} ngày`;

        return dbTime.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const isExpired = (expiryDate: string) => {
        const expiry = new Date(expiryDate);
        const now = new Date();
        return expiry.getTime() < now.getTime();
    };

    const isExpiringSoon = (expiryDate: string) => {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffMs = expiry.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7; // Sắp hết hạn trong 7 ngày
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

    if (loading) {
        return (
            <Box sx={{ maxWidth: 700, color: 'text.primary' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    const renderSubscriptionCard = (subscription: Subscription) => {
        const isActive = subscription.is_active && !isExpired(subscription.expiry_date);
        const expired = isExpired(subscription.expiry_date);
        const expiringSoon = !expired && isExpiringSoon(subscription.expiry_date);

        return (
            <Card key={subscription.id} sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
                }
            }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {getLicenseName(subscription.license_key)}
                        </Typography>

                        {isActive && (
                            <Chip
                                label="Đang hoạt động"
                                size="small"
                                sx={{
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    fontWeight: 'bold',
                                }}
                            />
                        )}

                        {expired && (
                            <Chip
                                label="Đã hết hạn"
                                size="small"
                                sx={{
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    fontWeight: 'bold',
                                }}
                            />
                        )}

                        {expiringSoon && (
                            <Chip
                                label="Sắp hết hạn"
                                size="small"
                                sx={{
                                    bgcolor: 'warning.main',
                                    color: 'white',
                                    fontWeight: 'bold',
                                }}
                            />
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            <strong>Bắt đầu:</strong> {formatDate(subscription.start_date)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            <strong>Hết hạn:</strong> {formatExpiryDate(subscription.expiry_date)}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const renderTransactionCard = (transaction: Transaction) => {
        const isSuccessful = transaction.payment_status === 'succeeded';

        return (
            <Card key={transaction.id} sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
                }
            }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {getLicenseName(transaction.license_key)}
                        </Typography>

                        <Chip
                            label={getTransactionStatusText(transaction.payment_status)}
                            size="small"
                            color={isSuccessful ? 'success' : 'default'}
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                        <strong>Ngày giao dịch:</strong> {formatDate(transaction.created_at)}
                    </Typography>
                </CardContent>
            </Card>
        );
    };

    return (
        <Box sx={{ maxWidth: 700, color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                        Gói đăng ký
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Quản lý các gói subscription đã mua và hiện tại
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
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Gói đăng ký hiện tại
                </Typography>
                {!currentSubscription ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <CardMembership sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                Bạn chưa có gói subscription nào đang hoạt động
                            </Typography>
                            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                                Hãy mua một gói để trải nghiệm các tính năng premium
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    renderSubscriptionCard(currentSubscription)
                )}
            </Box>

            {/* Transaction History Section */}
            <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Lịch sử giao dịch
                </Typography>
                {transactionHistory.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <History sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                Chưa có lịch sử giao dịch
                            </Typography>
                            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                                Các giao dịch mua subscription sẽ hiển thị ở đây
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <Stack spacing={2}>
                        {transactionHistory
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map(transaction => renderTransactionCard(transaction))}
                    </Stack>
                )}
            </Box>
        </Box>
    );
}
