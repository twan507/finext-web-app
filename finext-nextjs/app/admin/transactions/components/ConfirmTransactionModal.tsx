'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Chip, InputAdornment, FormControl, InputLabel
} from '@mui/material';
import {
    PlaylistAddCheckCircle as ConfirmIcon,
    Cancel as CancelIcon,
    AttachMoney as MoneyIcon,
    CalendarToday as DaysIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { colorTokens } from 'theme/tokens';

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

interface ConfirmTransactionModalProps {
    open: boolean;
    onClose: () => void;
    transaction: TransactionPublic | null;
    onTransactionUpdated: () => void;
    userEmail?: string;
}

interface TransactionConfirmationRequest {
    admin_notes?: string;
    final_transaction_amount_override?: number;
    duration_days_override?: number;
}

export default function ConfirmTransactionModal({
    open,
    onClose,
    transaction,
    onTransactionUpdated,
    userEmail
}: ConfirmTransactionModalProps) {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    // Form state
    const [adminNotes, setAdminNotes] = useState('');
    const [amountOverride, setAmountOverride] = useState<string>('');
    const [durationOverride, setDurationOverride] = useState<string>('');

    // Loading states
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);

    // Error state
    const [error, setError] = useState<string | null>(null);

    // Reset form when modal opens/closes or transaction changes
    useEffect(() => {
        if (open && transaction) {
            setAdminNotes('');
            setAmountOverride('');
            setDurationOverride('');
            setError(null);
        }
    }, [open, transaction]);

    const handleClose = () => {
        if (!confirmLoading && !cancelLoading) {
            onClose();
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

    const validateForm = (): { isValid: boolean; error?: string } => {
        // Validate amount override
        if (amountOverride.trim() !== '') {
            const amount = parseFloat(amountOverride);
            if (isNaN(amount) || amount < 0) {
                return { isValid: false, error: 'Số tiền ghi đè phải là số không âm' };
            }
        }

        // Validate duration override
        if (durationOverride.trim() !== '') {
            const duration = parseInt(durationOverride);
            if (isNaN(duration) || duration <= 0) {
                return { isValid: false, error: 'Số ngày ghi đè phải là số nguyên dương' };
            }
        }

        return { isValid: true };
    };

    const handleConfirmPayment = async () => {
        if (!transaction) return;

        const validation = validateForm();
        if (!validation.isValid) {
            setError(validation.error || 'Dữ liệu không hợp lệ');
            return;
        }

        setConfirmLoading(true);
        setError(null);

        try {
            const requestBody: TransactionConfirmationRequest = {};

            // Add admin notes if provided
            if (adminNotes.trim()) {
                requestBody.admin_notes = adminNotes.trim();
            }

            // Add amount override if provided
            if (amountOverride.trim()) {
                requestBody.final_transaction_amount_override = parseFloat(amountOverride);
            }

            // Add duration override if provided
            if (durationOverride.trim()) {
                requestBody.duration_days_override = parseInt(durationOverride);
            }

            await apiClient({
                url: `/api/v1/transactions/admin/${transaction.id}/confirm-payment`,
                method: 'PUT',
                body: requestBody
            });

            onTransactionUpdated();
            handleClose();
        } catch (err: any) {
            setError(err.message || "Không thể xác nhận thanh toán.");
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleCancelTransaction = async () => {
        if (!transaction) return;

        setCancelLoading(true);
        setError(null);

        try {
            const requestBody: { admin_notes?: string } = {};

            if (adminNotes.trim()) {
                requestBody.admin_notes = adminNotes.trim();
            }

            await apiClient({
                url: `/api/v1/transactions/admin/${transaction.id}/cancel`,
                method: 'PUT',
                body: requestBody
            });

            onTransactionUpdated();
            handleClose();
        } catch (err: any) {
            setError(err.message || "Không thể hủy giao dịch.");
        } finally {
            setCancelLoading(false);
        }
    };

    if (!transaction) return null;

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    maxHeight: '90vh'
                }
            }}
        >
            <DialogTitle sx={{
                color: 'primary.main',
                fontWeight: 'bold',
                pb: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ConfirmIcon />
                    Xác nhận giao dịch
                </Box>
            </DialogTitle>

            <DialogContent sx={{ pb: 1 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}                {/* Transaction Information - Responsive Layout */}
                <Box sx={{
                    p: 2,
                    bgcolor: componentColors.modal.noteBackground,
                    borderRadius: 1,
                    mb: 3,
                }}>                    <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 4
                }}>
                        {/* Column 1: Basic Information */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                Thông tin cơ bản
                            </Typography>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Email người mua:</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {userEmail || transaction.buyer_user_id}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Trạng thái:</Typography>
                                <Chip
                                    label={transaction.payment_status.toUpperCase()}
                                    size="small"
                                    color={getPaymentStatusChipColor(transaction.payment_status)}
                                    sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}
                                />
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Loại giao dịch:</Typography>
                                <Chip
                                    label={transaction.transaction_type === 'new_purchase' ? 'Mua mới' : 'Gia hạn'}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem' }}
                                />
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">License Key:</Typography>
                                <Chip
                                    label={transaction.license_key}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
                                />
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Thời hạn:</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {transaction.purchased_duration_days} ngày
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Giá gốc:</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {transaction.original_license_price.toLocaleString('vi-VN')} VNĐ
                                </Typography>
                            </Box>
                        </Box>

                        {/* Column 2: Pricing and Discounts */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                                Thông tin giá
                            </Typography>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Mã Broker:</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {transaction.broker_code_applied || 'Không có'}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Giảm giá Broker:</Typography>
                                <Typography variant="body1" fontWeight="bold" sx={{ color: transaction.broker_discount_amount ? 'success.main' : 'text.secondary' }}>
                                    {transaction.broker_discount_amount ? `${transaction.broker_discount_amount.toLocaleString('vi-VN')} VNĐ` : '0 VNĐ'}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Mã khuyến mại:</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {transaction.promotion_code_applied || 'Không có'}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Giảm giá khuyến mại:</Typography>
                                <Typography variant="body1" fontWeight="bold" sx={{ color: transaction.promotion_discount_amount ? 'success.main' : 'text.secondary' }}>
                                    {transaction.promotion_discount_amount ? `${transaction.promotion_discount_amount.toLocaleString('vi-VN')} VNĐ` : '0 VNĐ'}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Tổng giảm giá:</Typography>
                                <Typography variant="body1" fontWeight="bold" sx={{ color: transaction.total_discount_amount ? 'success.main' : 'text.secondary' }}>
                                    {transaction.total_discount_amount ? `${transaction.total_discount_amount.toLocaleString('vi-VN')} VNĐ` : '0 VNĐ'}
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" color="text.secondary">Giá hiện tại:</Typography>
                                <Typography variant="body1" fontWeight="bold" sx={{ color: 'primary.main', fontSize: '1.1rem' }}>
                                    {transaction.transaction_amount.toLocaleString('vi-VN')} VNĐ
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>                {/* Override Fields */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                        Tuỳ chỉnh ưu đãi
                    </Typography>

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 2,
                        mb: 2
                    }}>
                        {/* Amount Override */}
                        <TextField
                            label="Ghi đè số tiền thanh toán"
                            type="number"
                            value={amountOverride}
                            onChange={(e) => setAmountOverride(e.target.value)}
                            placeholder={transaction.transaction_amount.toString()}
                            helperText={`Hiện tại: ${transaction.transaction_amount.toLocaleString('vi-VN')} VNĐ`}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <MoneyIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">VNĐ</InputAdornment>
                                )
                            }}
                            disabled={confirmLoading || cancelLoading}
                            inputProps={{ min: 0, step: 1000 }}
                        />

                        {/* Duration Override */}
                        <TextField
                            label="Ghi đè số ngày sử dụng"
                            type="number"
                            value={durationOverride}
                            onChange={(e) => setDurationOverride(e.target.value)}
                            placeholder={transaction.purchased_duration_days.toString()}
                            helperText={`Hiện tại: ${transaction.purchased_duration_days} ngày`}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DaysIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">ngày</InputAdornment>
                                )
                            }}
                            disabled={confirmLoading || cancelLoading}
                            inputProps={{ min: 1, step: 1 }}
                        />
                    </Box>
                </Box>

                {/* Admin Notes */}
                <Box sx={{ mb: 2 }}>
                    <TextField
                        fullWidth
                        label="Ghi chú admin (tùy chọn)"
                        variant="outlined"
                        multiline
                        rows={4}
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Nhập ghi chú về việc xác nhận/hủy giao dịch..."
                        helperText="Ghi chú này sẽ được lưu cùng với giao dịch để tham khảo sau này"
                        disabled={confirmLoading || cancelLoading}
                    />
                </Box>                {/* Action Information */}
                <Box sx={{
                    p: 2,
                    bgcolor: componentColors.modal.noteBackground,
                    borderRadius: 1,
                    border: `1px solid ${componentColors.modal.noteBorder}`,
                    mb: 2,
                    position: 'relative',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        bgcolor: 'warning.main',
                        borderRadius: '4px 4px 0 0'
                    }
                }}>
                    <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            color: 'warning.main'
                        }}
                    >
                        💡 Lưu ý:
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            mt: 1,
                            color: componentColors.modal.noteText
                        }}
                    >
                        • <strong>Xác nhận thanh toán:</strong> Chuyển trạng thái sang "Thành công" và tạo/gia hạn subscription
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: componentColors.modal.noteText
                        }}
                    >
                        • <strong>Hủy giao dịch:</strong> Chuyển trạng thái sang "Đã hủy"
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 'bold',
                            color: componentColors.modal.noteText
                        }}
                    >
                        • Hành động này không thể hoàn tác
                    </Typography>
                </Box>
            </DialogContent>            <DialogActions sx={{
                p: 3,
                pt: 1,
                gap: 1
            }}>
                <Button
                    onClick={handleClose}
                    disabled={confirmLoading || cancelLoading}
                    variant="outlined"
                    startIcon={<CloseIcon />}
                    sx={{
                        minWidth: { xs: 'auto', sm: 100 },
                        '& .MuiButton-startIcon': {
                            margin: { xs: 0, sm: '0 8px 0 -4px' }
                        },
                        px: { xs: 1, sm: 2 }
                    }}
                >
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        Đóng
                    </Box>
                </Button>

                <Button
                    onClick={handleCancelTransaction}
                    color="error"
                    variant="outlined"
                    disabled={confirmLoading || cancelLoading}
                    startIcon={cancelLoading ? <CircularProgress size={20} /> : <CancelIcon />}
                    sx={{
                        minWidth: { xs: 'auto', sm: 140 },
                        '& .MuiButton-startIcon': {
                            margin: { xs: 0, sm: '0 8px 0 -4px' }
                        },
                        px: { xs: 1, sm: 2 }
                    }}
                >
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        {cancelLoading ? 'Đang hủy...' : 'Hủy giao dịch'}
                    </Box>
                </Button>

                <Button
                    onClick={handleConfirmPayment}
                    color="success"
                    variant="contained"
                    disabled={confirmLoading || cancelLoading}
                    startIcon={confirmLoading ? <CircularProgress size={20} /> : <ConfirmIcon />}
                    sx={{
                        minWidth: { xs: 'auto', sm: 160 },
                        '& .MuiButton-startIcon': {
                            margin: { xs: 0, sm: '0 8px 0 -4px' }
                        },
                        px: { xs: 1, sm: 2 }
                    }}
                >
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        {confirmLoading ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                    </Box>
                </Button>
            </DialogActions>
        </Dialog>
    );
}
