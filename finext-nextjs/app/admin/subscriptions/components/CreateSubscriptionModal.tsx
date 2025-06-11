'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Autocomplete, FormControl, FormHelperText,
    InputLabel, Select, MenuItem, Chip
} from '@mui/material';
import {
    Add as CreateIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { colorTokens } from 'theme/tokens';
import { parseISO, addDays, format } from 'date-fns';
import { filterNonSystemLicenses, isSystemLicense } from 'utils/systemProtection';

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

interface SubscriptionCreateRequest {
    user_id: string;
    license_key: string;
    duration_override_days?: number;
}

interface CreateSubscriptionModalProps {
    open: boolean;
    onClose: () => void;
    onSubscriptionCreated: () => void;
}

const CreateSubscriptionModal: React.FC<CreateSubscriptionModalProps> = ({
    open,
    onClose,
    onSubscriptionCreated
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors; const [allUsers, setAllUsers] = useState<UserPublic[]>([]);
    const [allLicenses, setAllLicenses] = useState<LicensePublic[]>([]);
    const [userActiveSubscription, setUserActiveSubscription] = useState<SubscriptionPublic | null>(null);
    const [hasActiveNonBasicSub, setHasActiveNonBasicSub] = useState(false);

    const [formData, setFormData] = useState<SubscriptionCreateRequest>({
        user_id: '',
        license_key: ''
    });

    const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
    const [selectedLicense, setSelectedLicense] = useState<LicensePublic | null>(null);
    const [durationOverride, setDurationOverride] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingLicenses, setLoadingLicenses] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

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
            } else {
                setError('Không thể tải danh sách người dùng. Vui lòng thử lại.');
            }
        } catch (err: any) {
            setError('Không thể tải danh sách người dùng. Vui lòng kiểm tra kết nối mạng và thử lại.');
        } finally {
            setLoadingUsers(false);
        }
    };

    // Fetch all licenses
    const fetchLicenses = async () => {
        setLoadingLicenses(true);
        try {
            const response = await apiClient<{ items: LicensePublic[]; total: number } | LicensePublic[]>({
                url: `/api/v1/licenses/?limit=1000`, // Get all licenses for selection
                method: 'GET',
            }); if (response.status === 200 && response.data) {
                const licenses = 'items' in response.data ? response.data.items : response.data;
                const activeLicenses = licenses.filter(license => license.is_active);
                const nonSystemLicenses = filterNonSystemLicenses(activeLicenses);
                setAllLicenses(nonSystemLicenses);
            } else {
                setError('Không thể tải danh sách gói dịch vụ. Vui lòng thử lại.');
            }
        } catch (err: any) {
            setError('Không thể tải danh sách gói dịch vụ. Vui lòng kiểm tra kết nối mạng và thử lại.');
        } finally {
            setLoadingLicenses(false);
        }
    };

    // Check user's current active subscriptions
    const checkUserActiveSubscriptions = async (userId: string) => {
        if (!userId) {
            setUserActiveSubscription(null);
            setHasActiveNonBasicSub(false);
            return;
        }

        try {
            const response = await apiClient<{ items: SubscriptionPublic[]; total: number } | SubscriptionPublic[]>({
                url: `/api/v1/subscriptions/user/${userId}?limit=100`,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                const subscriptions = 'items' in response.data ? response.data.items : response.data;

                // Find active non-BASIC subscription
                const now = new Date();
                const activeNonBasicSub = subscriptions.find(sub =>
                    sub.is_active &&
                    new Date(sub.expiry_date) > now &&
                    sub.license_key !== 'BASIC'
                );

                if (activeNonBasicSub) {
                    setUserActiveSubscription(activeNonBasicSub);
                    setHasActiveNonBasicSub(true);
                    setWarning(
                        `Người dùng đã có subscription đang hoạt động với license '${activeNonBasicSub.license_key}' ` +
                        `(hết hạn: ${new Date(activeNonBasicSub.expiry_date).toLocaleDateString('vi-VN')}). `
                    );
                } else {
                    setUserActiveSubscription(null);
                    setHasActiveNonBasicSub(false);
                    setWarning(null);
                }
            }
        } catch (err: any) {
            console.error('Error checking user subscriptions:', err);
            // Don't show error for this check, just log it
        }
    };

    // Load initial data when modal opens
    useEffect(() => {
        if (open) {
            fetchUsers();
            fetchLicenses();
        }
    }, [open]);    // Reset form when modal opens/closes
    useEffect(() => {
        if (!open) {
            setFormData({
                user_id: '',
                license_key: ''
            });
            setSelectedUser(null);
            setSelectedLicense(null);
            setDurationOverride('');
            setError(null);
            setWarning(null);
            setUserActiveSubscription(null);
            setHasActiveNonBasicSub(false);
        }
    }, [open]); const handleUserChange = (user: UserPublic | null) => {
        setSelectedUser(user);
        setFormData(prev => ({
            ...prev,
            user_id: user?.id || ''
        }));
        setError(null);
        setWarning(null);

        // Check user's active subscriptions
        if (user?.id) {
            checkUserActiveSubscriptions(user.id);
        } else {
            setUserActiveSubscription(null);
            setHasActiveNonBasicSub(false);
        }
    }; const handleLicenseChange = (license: LicensePublic | null) => {
        setSelectedLicense(license);
        setFormData(prev => ({
            ...prev,
            license_key: license?.key || ''
        }));
        setError(null);
        setWarning(null);
    };

    const handleSubmit = async () => {
        setError(null);
        setWarning(null);

        // Validation
        if (!formData.user_id) {
            setError('Vui lòng chọn người dùng.');
            return;
        } if (!formData.license_key) {
            setError('Vui lòng chọn gói dịch vụ.');
            return;
        }        // Check if selected license is a system license
        if (isSystemLicense(formData.license_key)) {
            setError('Không thể tạo subscription với gói dịch vụ hệ thống. Vui lòng chọn gói dịch vụ khác.');
            return;
        }

        // Check if creating non-BASIC subscription for user who already has active non-BASIC subscription
        if (formData.license_key !== 'BASIC' && hasActiveNonBasicSub && userActiveSubscription) {
            setError(
                `Không thể tạo subscription mới. Người dùng đã có subscription đang hoạt động với license '${userActiveSubscription.license_key}' ` +
                `(hết hạn: ${new Date(userActiveSubscription.expiry_date).toLocaleDateString('vi-VN')}). ` +
                `Vui lòng gia hạn subscription hiện tại thay vì tạo mới.`
            );
            return;
        }

        // Validate duration override if provided
        if (durationOverride.trim()) {
            const duration = parseInt(durationOverride);
            if (isNaN(duration) || duration <= 0) {
                setError('Thời gian ghi đè phải là số nguyên dương.');
                return;
            }
        }

        setLoading(true); try {
            const requestBody: SubscriptionCreateRequest = {
                user_id: formData.user_id,
                license_key: formData.license_key
            };

            if (durationOverride.trim()) {
                requestBody.duration_override_days = parseInt(durationOverride);
            } const response = await apiClient({
                url: '/api/v1/subscriptions/',
                method: 'POST',
                body: requestBody
            });

            if (response.status === 200 || response.status === 201) {
                onSubscriptionCreated();
                onClose();
            } else {
                setError(response.message || 'Không thể tạo subscription.');
            }
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi tạo subscription.');
        } finally {
            setLoading(false);
        }
    };

    const calculateExpiryDate = () => {
        if (!selectedLicense) return null;

        const days = durationOverride.trim() ? parseInt(durationOverride) : selectedLicense.duration_days;
        if (isNaN(days)) return null;

        const startDate = new Date();
        const expiryDate = addDays(startDate, days);
        return format(expiryDate, 'dd/MM/yyyy');
    };

    return (
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
                    <CreateIcon color="primary" />
                    Tạo Subscription Mới
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
                    )}

                    {warning && (
                        <Alert severity="warning" onClose={() => setWarning(null)} sx={{ mb: 3 }}>
                            {warning}
                        </Alert>
                    )}

                    <Box sx={{
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
                                isOptionEqualToValue={(option, value) => option.id === value.id} />
                        </Box>                        {/* Row 1.5: User's Current Active Subscription Info */}
                        {selectedUser && userActiveSubscription && (
                            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                <Box sx={{
                                    mt: 2,
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
                                        bgcolor: hasActiveNonBasicSub ? 'warning.main' : 'info.main',
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
                                            color: hasActiveNonBasicSub ? 'warning.main' : 'info.main'
                                        }}
                                    >
                                        ⚠️ Subscription hiện tại của người dùng:
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            mt: 1,
                                            color: componentColors.modal.noteText
                                        }}
                                    >
                                        • License: <strong>{userActiveSubscription.license_key}</strong>
                                    </Typography>                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: componentColors.modal.noteText
                                        }}
                                    >
                                        • Hết hạn: <strong>{new Date(userActiveSubscription.expiry_date).toLocaleDateString('vi-VN')}</strong>
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: componentColors.modal.noteText
                                            }}
                                        >
                                            • Trạng thái:
                                        </Typography>
                                        <Chip
                                            label={userActiveSubscription.is_active ? "Đang hoạt động" : "Không hoạt động"}
                                            size="small"
                                            color={userActiveSubscription.is_active ? "success" : "default"}
                                            variant="outlined"
                                        />
                                    </Box>
                                </Box>
                            </Box>)}

                        {/* Hide license selection and other components when user has active non-basic subscription */}
                        {!hasActiveNonBasicSub && (
                            <>
                                {/* Row 2 Left: License Selection */}
                                <Autocomplete
                                    value={selectedLicense}
                                    onChange={(_, newValue) => handleLicenseChange(newValue)}
                                    options={allLicenses}
                                    getOptionLabel={(option) => `${option.name} (${option.key})`}
                                    loading={loadingLicenses}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Chọn gói dịch vụ *"
                                            variant="outlined"
                                            placeholder="Tìm kiếm gói dịch vụ theo tên hoặc key"
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

                                {/* Row 2 Right: Duration Override */}
                                <TextField
                                    label="Ghi đè thời gian (ngày)"
                                    type="number"
                                    value={durationOverride}
                                    onChange={(e) => setDurationOverride(e.target.value)}
                                    placeholder={selectedLicense ? selectedLicense.duration_days.toString() : ""}
                                    helperText={
                                        selectedLicense
                                            ? `Mặc định: ${selectedLicense.duration_days} ngày`
                                            : "Tùy chọn - ghi đè thời gian của gói dịch vụ"
                                    }
                                    inputProps={{ min: 1, max: 9999 }}
                                    fullWidth
                                />

                                {/* Row 3: License Info Display */}
                                {selectedLicense && (
                                    <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                        <Box sx={{
                                            p: 2,
                                            bgcolor: componentColors.modal.noteBackground,
                                            borderRadius: 1,
                                            border: `1px solid ${componentColors.modal.noteBorder}`
                                        }}>
                                            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                Thông tin gói đã chọn:
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                                <Chip label={`${selectedLicense.name} (${selectedLicense.key})`} size="small" color="primary" variant="outlined" />
                                                <Chip label={`${selectedLicense.price.toLocaleString('vi-VN')} VNĐ`} size="small" color="success" variant="outlined" />
                                                <Chip
                                                    label={`${durationOverride.trim() ? durationOverride : selectedLicense.duration_days} ngày`}
                                                    size="small"
                                                    color={durationOverride.trim() ? "warning" : "info"}
                                                    variant="outlined"
                                                />
                                            </Box>
                                            {calculateExpiryDate() && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Ngày hết hạn dự kiến: <strong>{calculateExpiryDate()}</strong>
                                                </Typography>)}
                                        </Box>
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>                    {/* Creation Notes - Only show when user doesn't have active non-basic subscription */}
                    {!hasActiveNonBasicSub && (
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
                                💡 Lưu ý về tạo subscription:
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 1,
                                    color: componentColors.modal.noteText
                                }}
                            >
                                • Subscription sẽ được tạo với trạng thái hoạt động ngay lập tức
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: componentColors.modal.noteText
                                }}
                            >
                                • Thời gian bắt đầu là thời điểm hiện tại
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: componentColors.modal.noteText
                                }}
                            >
                                • Ghi đè thời gian sẽ thay thế thời gian mặc định của gói dịch vụ
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: componentColors.modal.noteText
                                }}
                            >
                                • Kiểm tra kỹ thông tin trước khi tạo subscription
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 1 }}>
                <Button
                    onClick={onClose}
                    disabled={loading}
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
                        Hủy
                    </Box>
                </Button>                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || hasActiveNonBasicSub}
                    startIcon={loading ? <CircularProgress size={20} /> : <CreateIcon />}
                    sx={{
                        minWidth: { xs: 'auto', sm: 140 },
                        '& .MuiButton-startIcon': {
                            margin: { xs: 0, sm: '0 8px 0 -4px' }
                        },
                        px: { xs: 1, sm: 2 }
                    }}
                >
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        {loading ? 'Đang tạo...' : 'Tạo Subscription'}
                    </Box>
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateSubscriptionModal;
