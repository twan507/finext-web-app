// finext-nextjs/app/admin/transactions/components/AddTransactionModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Autocomplete, FormControl,
    InputLabel, Select, MenuItem, FormHelperText
} from '@mui/material';
import {
    Payment as TransactionIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { colorTokens } from 'theme/tokens';

interface UserPublic {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string | null;
    is_active?: boolean;
    role_ids: string[];
    referral_code?: string | null;
}

interface LicensePublic {
    id: string;
    key: string;
    name: string;
    price: number;
    duration_days: number;
    feature_keys: string[];
    is_active: boolean;
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

interface TransactionCreateForAdmin {
    buyer_user_id: string;
    transaction_type: 'new_purchase' | 'renewal';
    purchased_duration_days: number;
    promotion_code?: string;
    notes?: string;
    license_id_for_new_purchase?: string;
    subscription_id_to_renew?: string;
    broker_code?: string;
}

interface CreateTransactionModalProps {
    open: boolean;
    onClose: () => void;
    onTransactionAdded: () => void;
}

const CreateTransactionModal: React.FC<CreateTransactionModalProps> = ({
    open,
    onClose,
    onTransactionAdded
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [allUsers, setAllUsers] = useState<UserPublic[]>([]);
    const [allLicenses, setAllLicenses] = useState<LicensePublic[]>([]);
    const [userSubscriptions, setUserSubscriptions] = useState<SubscriptionPublic[]>([]); const [formData, setFormData] = useState<TransactionCreateForAdmin>({
        buyer_user_id: '',
        transaction_type: 'new_purchase',
        purchased_duration_days: 30,
        promotion_code: '',
        notes: '',
        license_id_for_new_purchase: '',
        subscription_id_to_renew: '',
        broker_code: ''
    });

    const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
    const [selectedLicense, setSelectedLicense] = useState<LicensePublic | null>(null);
    const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionPublic | null>(null); const [loading, setLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingLicenses, setLoadingLicenses] = useState(false);
    const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [brokerCodeError, setBrokerCodeError] = useState<string | null>(null);

    // Fetch all users
    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await apiClient<{ items: UserPublic[]; total: number } | UserPublic[]>({
                url: `/api/v1/users/?limit=1000`, // Get all users for selection
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                const users = 'items' in response.data ? response.data.items : response.data;
                setAllUsers(users.filter(user => user.is_active));
            }
        } catch (err: any) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Fetch all active licenses
    const fetchLicenses = async () => {
        setLoadingLicenses(true);
        try {
            const response = await apiClient<{ items: LicensePublic[]; total: number } | LicensePublic[]>({
                url: `/api/v1/licenses/?limit=1000&include_inactive=false`, // Only active licenses
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                const licenses = 'items' in response.data ? response.data.items : response.data;
                setAllLicenses(licenses.filter(license => license.is_active));
            }
        } catch (err: any) {
            console.error('Failed to fetch licenses:', err);
        } finally {
            setLoadingLicenses(false);
        }
    };

    // Fetch user's active subscriptions for renewal
    const fetchUserSubscriptions = async (userId: string) => {
        setLoadingSubscriptions(true);
        try {
            const response = await apiClient<{ items: SubscriptionPublic[]; total: number } | SubscriptionPublic[]>({
                url: `/api/v1/subscriptions/?user_id=${userId}&limit=1000`,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                const subscriptions = 'items' in response.data ? response.data.items : response.data;
                setUserSubscriptions(subscriptions.filter(sub => sub.is_active));
            }
        } catch (err: any) {
            console.error('Failed to fetch user subscriptions:', err);
            setUserSubscriptions([]);
        } finally {
            setLoadingSubscriptions(false);
        }
    };

    // Load initial data when modal opens
    useEffect(() => {
        if (open) {
            fetchUsers();
            fetchLicenses();
        }
    }, [open]);

    // When user changes, fetch their subscriptions if renewal is selected
    useEffect(() => {
        if (selectedUser && formData.transaction_type === 'renewal') {
            fetchUserSubscriptions(selectedUser.id);
        } else {
            setUserSubscriptions([]);
            setSelectedSubscription(null);
            setFormData(prev => ({ ...prev, subscription_id_to_renew: '' }));
        }
    }, [selectedUser, formData.transaction_type]);    // Reset form when modal opens/closes
    useEffect(() => {
        if (!open) {
            setFormData({
                buyer_user_id: '',
                transaction_type: 'new_purchase',
                purchased_duration_days: 30,
                promotion_code: '',
                notes: '',
                license_id_for_new_purchase: '',
                subscription_id_to_renew: '',
                broker_code: ''
            });
            setSelectedUser(null);
            setSelectedLicense(null);
            setSelectedSubscription(null);
            setError(null);
            setBrokerCodeError(null);
        }
    }, [open]); const handleUserChange = (user: UserPublic | null) => {
        setSelectedUser(user);
        setFormData(prev => ({
            ...prev,
            buyer_user_id: user?.id || '',
            broker_code: user?.referral_code || ''
        }));
        setBrokerCodeError(null);
    };

    const handleLicenseChange = (license: LicensePublic | null) => {
        setSelectedLicense(license);
        setFormData(prev => ({
            ...prev,
            license_id_for_new_purchase: license?.id || '',
            purchased_duration_days: license?.duration_days || 30
        }));
    };

    const handleSubscriptionChange = (subscription: SubscriptionPublic | null) => {
        setSelectedSubscription(subscription);
        setFormData(prev => ({
            ...prev,
            subscription_id_to_renew: subscription?.id || ''
        }));
    }; const handleTransactionTypeChange = (type: 'new_purchase' | 'renewal') => {
        setFormData(prev => ({
            ...prev,
            transaction_type: type,
            license_id_for_new_purchase: type === 'new_purchase' ? prev.license_id_for_new_purchase : '',
            subscription_id_to_renew: type === 'renewal' ? prev.subscription_id_to_renew : ''
        }));

        if (type === 'new_purchase') {
            setSelectedSubscription(null);
        } else {
            setSelectedLicense(null);
        }
    };

    // Validate broker code
    const validateBrokerCode = async (brokerCode: string): Promise<boolean> => {
        if (!brokerCode.trim()) {
            setBrokerCodeError(null);
            return true; // Empty broker code is allowed
        }

        // Validate format
        if (!/^[a-zA-Z0-9]{4}$/.test(brokerCode.trim())) {
            setBrokerCodeError('Mã broker không hợp lệ. Phải là 4 ký tự chữ và số.');
            return false;
        }

        try {
            const brokerCodeToValidate = brokerCode.trim().toUpperCase();
            const validationResponse = await apiClient({
                url: `/api/v1/brokers/validate/${brokerCodeToValidate}`,
                method: 'GET'
            });

            if (validationResponse.status === 200 && validationResponse.data?.is_valid) {
                setBrokerCodeError(null);
                return true;
            } else {
                setBrokerCodeError('Mã broker không tồn tại trong hệ thống.');
                return false;
            }
        } catch (err: any) {
            setBrokerCodeError('Không thể xác thực mã broker. Vui lòng thử lại.');
            return false;
        }
    };

    const handleBrokerCodeChange = (value: string) => {
        const upperValue = value.toUpperCase();
        setFormData(prev => ({
            ...prev,
            broker_code: upperValue
        }));

        // Clear previous error
        setBrokerCodeError(null);

        // Validate if not empty
        if (upperValue.trim()) {
            validateBrokerCode(upperValue);
        }
    }; const handleSubmit = async () => {
        setError(null);

        // Validation
        if (!formData.buyer_user_id) {
            setError('Vui lòng chọn người dùng.');
            return;
        }

        if (formData.transaction_type === 'new_purchase' && !formData.license_id_for_new_purchase) {
            setError('Vui lòng chọn license cho giao dịch mua mới.');
            return;
        }

        if (formData.transaction_type === 'renewal' && !formData.subscription_id_to_renew) {
            setError('Vui lòng chọn subscription để gia hạn.');
            return;
        }

        if (formData.purchased_duration_days <= 0) {
            setError('Thời gian mua phải lớn hơn 0 ngày.');
            return;
        }

        // Validate broker code if provided
        if (formData.broker_code?.trim()) {
            const isValidBroker = await validateBrokerCode(formData.broker_code);
            if (!isValidBroker) {
                return; // Error message already set in validateBrokerCode
            }
        }

        setLoading(true);

        try {
            const response = await apiClient({
                url: '/api/v1/transactions/admin/create',
                method: 'POST',
                body: {
                    buyer_user_id: formData.buyer_user_id,
                    transaction_type: formData.transaction_type,
                    purchased_duration_days: formData.purchased_duration_days,
                    promotion_code: formData.promotion_code || undefined,
                    notes: formData.notes || undefined,
                    broker_code: formData.broker_code?.trim() || undefined,
                    license_id_for_new_purchase: formData.transaction_type === 'new_purchase' ? formData.license_id_for_new_purchase : undefined,
                    subscription_id_to_renew: formData.transaction_type === 'renewal' ? formData.subscription_id_to_renew : undefined
                }
            });

            if (response.status === 200 || response.status === 201) {
                onTransactionAdded();
                onClose();
            } else {
                setError(response.message || 'Không thể tạo giao dịch.');
            }
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi tạo giao dịch.');
        } finally {
            setLoading(false);
        }
    }; return (
        <Dialog
            open={open}
            onClose={!loading ? onClose : undefined}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle>
                <Typography variant="h5" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TransactionIcon color="primary" />
                    Tạo Giao Dịch Mới
                </Typography>
            </DialogTitle>

            <DialogContent>
                <Box
                    component="form"
                    autoComplete="off"
                    sx={{ mt: 2 }}
                >
                    {error && (
                        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 3
                    }}>
                        {/* Row 1: User Selection - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Autocomplete
                                value={selectedUser}
                                onChange={(_, newValue) => handleUserChange(newValue)}
                                options={allUsers}
                                getOptionLabel={(option) => `${option.full_name} (${option.email})`}
                                loading={loadingUsers}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn người dùng *"
                                        variant="outlined"
                                        placeholder="Tìm kiếm theo tên hoặc email"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                            />
                        </Box>

                        {/* Row 2 Left: License Selection */}
                        {formData.transaction_type === 'new_purchase' ? (
                            <Autocomplete
                                value={selectedLicense}
                                onChange={(_, newValue) => handleLicenseChange(newValue)}
                                options={allLicenses}
                                getOptionLabel={(option) => `${option.name} (${option.key})`}
                                loading={loadingLicenses}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn license *"
                                        variant="outlined"
                                        placeholder="Tìm kiếm license theo tên hoặc key"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {loadingLicenses ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                            />
                        ) : (
                            <Autocomplete
                                value={selectedSubscription}
                                onChange={(_, newValue) => handleSubscriptionChange(newValue)}
                                options={userSubscriptions}
                                getOptionLabel={(option) => `${option.license_key} - ${new Date(option.expiry_date).toLocaleDateString()}`}
                                loading={loadingSubscriptions}
                                disabled={!selectedUser}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn subscription để gia hạn *"
                                        variant="outlined"
                                        placeholder={!selectedUser ? "Vui lòng chọn người dùng trước" : "Chọn subscription cần gia hạn"}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {loadingSubscriptions ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                        helperText={!selectedUser ? "Vui lòng chọn người dùng trước" : ""}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                            />
                        )}

                        {/* Row 2 Right: Transaction Type */}
                        <FormControl fullWidth required>
                            <InputLabel>Loại giao dịch</InputLabel>
                            <Select
                                value={formData.transaction_type}
                                onChange={(e) => handleTransactionTypeChange(e.target.value as 'new_purchase' | 'renewal')}
                                label="Loại giao dịch"
                            >
                                <MenuItem value="new_purchase">Mua mới</MenuItem>
                                <MenuItem value="renewal">Gia hạn</MenuItem>
                            </Select>
                        </FormControl>                        {/* Row 3 Left: Price - Auto-filled from license */}
                        <TextField
                            label="Giá (VNĐ)"
                            type="text"
                            value={selectedLicense?.price ? selectedLicense.price.toLocaleString('vi-VN') : '0'}
                            disabled
                            placeholder="Sẽ tự động điền từ license"
                            helperText="Đây là giá gốc chưa bao gồm khuyến mãi"
                            fullWidth
                        />

                        {/* Row 3 Right: Duration */}
                        <TextField
                            label="Thời gian mua (ngày) *"
                            type="number"
                            value={formData.purchased_duration_days}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                purchased_duration_days: parseInt(e.target.value) || 0
                            }))}
                            inputProps={{ min: 1, max: 9999 }}
                            placeholder="Ví dụ: 30"
                            helperText="Số ngày sử dụng dịch vụ"
                            fullWidth
                        />                        {/* Row 4 Left: Broker Code - Auto-filled from user or manual input */}
                        <TextField
                            label="Mã broker"
                            value={formData.broker_code || ''}
                            onChange={(e) => handleBrokerCodeChange(e.target.value)}
                            disabled={selectedUser?.referral_code ? true : false}
                            placeholder={selectedUser?.referral_code ? "Tự động điền từ thông tin người dùng" : "Nhập mã broker (tùy chọn)"}
                            helperText={
                                selectedUser?.referral_code
                                    ? "Mã broker của người dùng (tự động điền)"
                                    : brokerCodeError || "Tùy chọn - mã 4 ký tự từ đối tác"
                            }
                            error={!!brokerCodeError}
                            fullWidth
                            inputProps={{
                                maxLength: 4,
                                style: { textTransform: 'uppercase' }
                            }}
                        />

                        {/* Row 4 Right: Promotion Code */}
                        <TextField
                            label="Mã khuyến mãi"
                            value={formData.promotion_code}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                promotion_code: e.target.value
                            }))}
                            placeholder="Nhập mã khuyến mãi (nếu có)"
                            helperText="Tùy chọn - mã giảm giá cho giao dịch"
                            fullWidth
                        />

                        {/* Row 5: Notes - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <TextField
                                label="Ghi chú"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    notes: e.target.value
                                }))}
                                multiline
                                rows={3}
                                placeholder="Ghi chú thêm về giao dịch..."
                                helperText="Tùy chọn - thông tin bổ sung về giao dịch"
                                fullWidth
                            />
                        </Box>
                    </Box>

                    {/* Informational Note Box */}
                    <Box sx={{
                        mt: 3,
                        p: 2,
                        bgcolor: componentColors.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${componentColors.modal.noteBorder}`,
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            bgcolor: 'info.main',
                            borderRadius: '4px 4px 0 0'
                        },
                        position: 'relative'
                    }}>
                        <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: 'info.main'
                            }}
                        >
                            💡 Lưu ý về giao dịch:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Giao dịch mua mới: Tạo subscription mới cho người dùng với license đã chọn
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Giao dịch gia hạn: Mở rộng thời gian của subscription hiện tại
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Thời gian mua sẽ được cộng vào ngày bắt đầu/hết hạn tương ứng
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={loading}
                    variant="outlined"
                >
                    Hủy
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <TransactionIcon />}
                >
                    {loading ? 'Đang tạo...' : 'Tạo Giao Dịch'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateTransactionModal;
