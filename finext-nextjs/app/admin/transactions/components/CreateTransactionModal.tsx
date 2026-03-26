// finext-nextjs/app/admin/transactions/components/CreateTransactionModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Autocomplete, FormControl,
    InputLabel, Select, MenuItem,
} from '@mui/material';
import { Payment as TransactionIcon } from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { filterNonSystemLicenses, isSystemLicense } from 'utils/systemProtection';
import { borderRadiusTop } from 'theme/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface BrokerPublic {
    id: string;
    user_id: string;
    broker_code: string;
    is_active: boolean;
}

interface PromotionPublic {
    id: string;
    promotion_code: string;
    description?: string | null;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    is_active: boolean;
    usage_limit?: number | null;
    usage_count: number;
    applicable_license_keys?: string[] | null;
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

// ─── Component ───────────────────────────────────────────────────────────────

const CreateTransactionModal: React.FC<CreateTransactionModalProps> = ({
    open, onClose, onTransactionAdded,
}) => {
    const theme = useTheme();

    // ── Data lists ──
    const [allUsers, setAllUsers] = useState<UserPublic[]>([]);
    const [allLicenses, setAllLicenses] = useState<LicensePublic[]>([]);
    const [allBrokers, setAllBrokers] = useState<BrokerPublic[]>([]);
    const [allPromotions, setAllPromotions] = useState<PromotionPublic[]>([]);
    const [userSubscriptions, setUserSubscriptions] = useState<SubscriptionPublic[]>([]);

    // ── Form state ──
    const [formData, setFormData] = useState<TransactionCreateForAdmin>({
        buyer_user_id: '',
        transaction_type: 'new_purchase',
        purchased_duration_days: 30,
        promotion_code: '',
        notes: '',
        license_id_for_new_purchase: '',
        subscription_id_to_renew: '',
        broker_code: '',
    });

    // ── Selected objects ──
    const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
    const [selectedLicense, setSelectedLicense] = useState<LicensePublic | null>(null);
    const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionPublic | null>(null);
    const [selectedBroker, setSelectedBroker] = useState<BrokerPublic | null>(null);
    const [selectedPromotion, setSelectedPromotion] = useState<PromotionPublic | null>(null);

    // ── Loading/error ──
    const [loading, setLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingLicenses, setLoadingLicenses] = useState(false);
    const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
    const [loadingBrokers, setLoadingBrokers] = useState(false);
    const [loadingPromotions, setLoadingPromotions] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [hasActiveNonBasicSub, setHasActiveNonBasicSub] = useState(false);

    // ─── Fetchers ────────────────────────────────────────────────────────────

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await apiClient<{ items: UserPublic[]; total: number } | UserPublic[]>({
                url: `/api/v1/users/?limit=1000`,
                method: 'GET',
            });
            if (response.status === 200 && response.data) {
                const users = 'items' in response.data ? response.data.items : response.data;
                setAllUsers(users.filter(u => u.is_active));
            } else {
                setAllUsers([]);
            }
        } catch {
            setAllUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchLicenses = async () => {
        setLoadingLicenses(true);
        try {
            const response = await apiClient<{ items: LicensePublic[]; total: number } | LicensePublic[]>({
                url: `/api/v1/licenses/?limit=1000&include_inactive=false`,
                method: 'GET',
            });
            if (response.status === 200 && response.data) {
                const licenses = 'items' in response.data ? response.data.items : response.data;
                setAllLicenses(filterNonSystemLicenses(licenses.filter(l => l.is_active)));
            } else {
                setAllLicenses([]);
            }
        } catch {
            setAllLicenses([]);
        } finally {
            setLoadingLicenses(false);
        }
    };

    const fetchBrokers = async () => {
        setLoadingBrokers(true);
        try {
            const response = await apiClient<{ items: BrokerPublic[]; total: number } | BrokerPublic[]>({
                url: `/api/v1/brokers/`,
                method: 'GET',
                queryParams: { limit: 1000 },
            });
            if (response.status === 200 && response.data) {
                const brokers = 'items' in response.data ? response.data.items : response.data as BrokerPublic[];
                setAllBrokers(brokers.filter(b => b.is_active));
            } else {
                setAllBrokers([]);
            }
        } catch (err: any) {
            console.error('[CreateTransaction] fetchBrokers error:', err);
            setAllBrokers([]);
        } finally {
            setLoadingBrokers(false);
        }
    };

    const fetchPromotions = async () => {
        setLoadingPromotions(true);
        try {
            const response = await apiClient<{ items: PromotionPublic[]; total: number } | PromotionPublic[]>({
                url: `/api/v1/promotions/`,
                method: 'GET',
                queryParams: { limit: 1000 },
            });
            console.log('[CreateTransaction] fetchPromotions response:', response);
            if (response.status === 200 && response.data) {
                const promos = 'items' in response.data ? response.data.items : response.data as PromotionPublic[];
                console.log('[CreateTransaction] promos loaded:', promos?.length, promos);
                setAllPromotions(promos.filter(p => p.is_active));
            } else {
                console.warn('[CreateTransaction] fetchPromotions unexpected response:', response);
                setAllPromotions([]);
            }
        } catch (err: any) {
            console.error('[CreateTransaction] fetchPromotions error:', err);
            setAllPromotions([]);
        } finally {
            setLoadingPromotions(false);
        }
    };

    const fetchUserSubscriptions = async (userId: string) => {
        setLoadingSubscriptions(true);
        try {
            const response = await apiClient<{ items: SubscriptionPublic[]; total: number } | SubscriptionPublic[]>({
                url: `/api/v1/subscriptions/user/${userId}?limit=1000`,
                method: 'GET',
            });
            if (response.status === 200 && response.data) {
                const subscriptions = Array.isArray(response.data) ? response.data : [];
                const renewable = subscriptions.filter(s => s.is_active && s.license_key !== 'BASIC');
                const hasNonBasic = renewable.length > 0;
                setHasActiveNonBasicSub(hasNonBasic);
                setUserSubscriptions(renewable);

                if (subscriptions.length === 0) {
                    setInfo('Người dùng này chưa có gói đăng ký nào trong hệ thống.');
                } else if (renewable.length === 0) {
                    if (subscriptions.some(s => s.license_key === 'BASIC')) {
                        setInfo('Người dùng này chỉ có gói BASIC đang hoạt động. Vui lòng chọn "Mua mới" để nâng cấp.');
                    } else {
                        setInfo('Người dùng này không có gói nào có thể gia hạn. Hãy chọn "Mua mới" thay thế.');
                    }
                } else if (hasNonBasic) {
                    setInfo('Người dùng này đã có gói đăng kí đang hoạt động. Chỉ có thể chọn "Gia hạn".');
                }
            } else {
                setUserSubscriptions([]);
            }
        } catch {
            setUserSubscriptions([]);
            setHasActiveNonBasicSub(false);
        } finally {
            setLoadingSubscriptions(false);
        }
    };

    // ─── Effects ─────────────────────────────────────────────────────────────

    useEffect(() => {
        if (open) {
            fetchUsers();
            fetchLicenses();
            fetchBrokers();
            fetchPromotions();
        }
    }, [open]);

    useEffect(() => {
        if (selectedUser) {
            fetchUserSubscriptions(selectedUser.id);
            // Auto-fill broker from user's referral_code
            if (selectedUser.referral_code) {
                const matched = allBrokers.find(b => b.broker_code === selectedUser.referral_code);
                setSelectedBroker(matched ?? null);
                setFormData(prev => ({ ...prev, broker_code: selectedUser.referral_code ?? '' }));
            } else {
                setSelectedBroker(null);
                setFormData(prev => ({ ...prev, broker_code: '' }));
            }
        } else {
            setUserSubscriptions([]);
            setSelectedSubscription(null);
            setHasActiveNonBasicSub(false);
            setSelectedBroker(null);
            setWarning(null);
            setInfo(null);
            setFormData(prev => ({ ...prev, subscription_id_to_renew: '', broker_code: '' }));
        }
    }, [selectedUser]);

    useEffect(() => {
        if (hasActiveNonBasicSub && formData.transaction_type === 'new_purchase') {
            setFormData(prev => ({ ...prev, transaction_type: 'renewal' }));
            setSelectedLicense(null);
        } else if (!hasActiveNonBasicSub && formData.transaction_type === 'renewal') {
            setFormData(prev => ({ ...prev, transaction_type: 'new_purchase' }));
            setSelectedSubscription(null);
        }
    }, [hasActiveNonBasicSub, formData.transaction_type]);

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
                broker_code: '',
            });
            setSelectedUser(null);
            setSelectedLicense(null);
            setSelectedSubscription(null);
            setSelectedBroker(null);
            setSelectedPromotion(null);
            setError(null);
            setWarning(null);
            setInfo(null);
            setHasActiveNonBasicSub(false);
        }
    }, [open]);

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleUserChange = (user: UserPublic | null) => {
        setSelectedUser(user);
        setFormData(prev => ({ ...prev, buyer_user_id: user?.id || '' }));
        setHasActiveNonBasicSub(false);
        setWarning(null);
        setInfo(null);
        setError(null);
    };

    const handleLicenseChange = (license: LicensePublic | null) => {
        setSelectedLicense(license);
        setFormData(prev => ({
            ...prev,
            license_id_for_new_purchase: license?.id || '',
            purchased_duration_days: license?.duration_days || 30,
        }));
    };

    const handleSubscriptionChange = (subscription: SubscriptionPublic | null) => {
        setSelectedSubscription(subscription);
        setFormData(prev => ({ ...prev, subscription_id_to_renew: subscription?.id || '' }));
        if (subscription) { setError(null); setWarning(null); setInfo(null); }
    };

    const handleBrokerChange = (broker: BrokerPublic | null) => {
        // Only allow manual broker selection if user has no own referral_code
        if (selectedUser?.referral_code) return;
        setSelectedBroker(broker);
        setFormData(prev => ({ ...prev, broker_code: broker?.broker_code || '' }));
    };

    const handlePromotionChange = (promo: PromotionPublic | null) => {
        setSelectedPromotion(promo);
        setFormData(prev => ({ ...prev, promotion_code: promo?.promotion_code || '' }));
    };

    const handleTransactionTypeChange = (type: 'new_purchase' | 'renewal') => {
        if (type === 'new_purchase' && hasActiveNonBasicSub) {
            setError('Không thể tạo giao dịch mua mới. Người dùng đã có subscription đang hoạt động.');
            return;
        }
        if (type === 'renewal' && !hasActiveNonBasicSub) {
            setError('Không thể tạo giao dịch gia hạn. Người dùng không có subscription nào có thể gia hạn.');
            return;
        }
        setFormData(prev => ({
            ...prev,
            transaction_type: type,
            license_id_for_new_purchase: type === 'new_purchase' ? prev.license_id_for_new_purchase : '',
            subscription_id_to_renew: type === 'renewal' ? prev.subscription_id_to_renew : '',
        }));
        if (type === 'new_purchase') setSelectedSubscription(null);
        else setSelectedLicense(null);
        setError(null); setWarning(null); setInfo(null);
    };

    const handleSubmit = async () => {
        setError(null); setWarning(null); setInfo(null);

        if (!formData.buyer_user_id) { setError('Vui lòng chọn người dùng.'); return; }
        if (formData.transaction_type === 'new_purchase' && !formData.license_id_for_new_purchase) {
            setError('Vui lòng chọn license cho giao dịch mua mới.'); return;
        }
        if (formData.transaction_type === 'new_purchase' && formData.license_id_for_new_purchase) {
            const lic = allLicenses.find(l => l.id === formData.license_id_for_new_purchase);
            if (lic && isSystemLicense(lic.key)) {
                setError('Không thể tạo giao dịch với gói dịch vụ hệ thống.'); return;
            }
        }
        if (formData.transaction_type === 'renewal' && !formData.subscription_id_to_renew) {
            setError('Vui lòng chọn subscription để gia hạn.'); return;
        }
        if (formData.purchased_duration_days <= 0) {
            setError('Thời gian mua phải lớn hơn 0 ngày.'); return;
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
                    subscription_id_to_renew: formData.transaction_type === 'renewal' ? formData.subscription_id_to_renew : undefined,
                },
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
    };

    // ─── Broker label helper ──────────────────────────────────────────────────
    const getBrokerLabel = (broker: BrokerPublic) => {
        const user = allUsers.find(u => u.id === broker.user_id);
        return user
            ? `${broker.broker_code} — ${user.full_name} (${user.email})`
            : `${broker.broker_code}`;
    };

    // ─── Promotion label helper ───────────────────────────────────────────────
    const getPromoLabel = (promo: PromotionPublic) => {
        const discountStr = promo.discount_type === 'percentage'
            ? `${promo.discount_value}%`
            : `${promo.discount_value.toLocaleString('vi-VN')}đ`;
        return `${promo.promotion_code} — giảm ${discountStr}${promo.description ? ` · ${promo.description}` : ''}`;
    };

    const isBrokerLocked = Boolean(selectedUser?.referral_code);

    // ─── JSX ─────────────────────────────────────────────────────────────────

    return (
        <Dialog
            open={open}
            onClose={!loading ? onClose : undefined}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: 2 } }}
        >
            <DialogTitle>
                <Typography variant="h5" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TransactionIcon color="primary" />
                    Tạo Giao Dịch Mới
                </Typography>
            </DialogTitle>

            <DialogContent>
                <Box component="form" autoComplete="off" sx={{ mt: 2 }}>
                    {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
                    {warning && <Alert severity="warning" onClose={() => setWarning(null)} sx={{ mb: 2 }}>{warning}</Alert>}
                    {info && <Alert severity="info" onClose={() => setInfo(null)} sx={{ mb: 2 }}>{info}</Alert>}

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>

                        {/* Row 1: User — full width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Autocomplete
                                value={selectedUser}
                                onChange={(_, v) => handleUserChange(v)}
                                options={allUsers}
                                getOptionLabel={(o) => `${o.full_name} (${o.email})`}
                                loading={loadingUsers}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn người dùng *"
                                        variant="outlined"
                                        placeholder="Tìm kiếm theo tên hoặc email"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: <>{loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>,
                                        }}
                                    />
                                )}
                                isOptionEqualToValue={(o, v) => o.id === v.id}
                            />
                        </Box>

                        {/* Row 2 Left: License / Subscription */}
                        {formData.transaction_type === 'new_purchase' ? (
                            <Autocomplete
                                value={selectedLicense}
                                onChange={(_, v) => handleLicenseChange(v)}
                                options={allLicenses}
                                getOptionLabel={(o) => `${o.name} (${o.key})`}
                                loading={loadingLicenses}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn license *"
                                        variant="outlined"
                                        placeholder="Tìm kiếm license theo tên hoặc key"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: <>{loadingLicenses ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>,
                                        }}
                                    />
                                )}
                                isOptionEqualToValue={(o, v) => o.id === v.id}
                            />
                        ) : (
                            <Autocomplete
                                value={selectedSubscription}
                                onChange={(_, v) => handleSubscriptionChange(v)}
                                options={userSubscriptions}
                                getOptionLabel={(o) => `${o.license_key} - ${new Date(o.expiry_date).toLocaleDateString('vi-VN')}`}
                                loading={loadingSubscriptions}
                                disabled={!selectedUser}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn subscription để gia hạn *"
                                        variant="outlined"
                                        placeholder={!selectedUser ? 'Vui lòng chọn người dùng trước' : 'Chọn subscription cần gia hạn'}
                                        helperText={selectedUser && userSubscriptions.length === 0 && !loadingSubscriptions ? "Không có subscription active để gia hạn." : ""}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: <>{loadingSubscriptions ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>,
                                        }}
                                    />
                                )}
                                isOptionEqualToValue={(o, v) => o.id === v.id}
                            />
                        )}

                        {/* Row 2 Right: Transaction type */}
                        <FormControl fullWidth required>
                            <InputLabel>Loại giao dịch</InputLabel>
                            <Select
                                value={formData.transaction_type}
                                onChange={(e) => handleTransactionTypeChange(e.target.value as 'new_purchase' | 'renewal')}
                                label="Loại giao dịch"
                            >
                                <MenuItem value="new_purchase" disabled={hasActiveNonBasicSub} sx={hasActiveNonBasicSub ? { opacity: 0.6 } : {}}>
                                    Mua mới {hasActiveNonBasicSub && '(Không khả dụng)'}
                                </MenuItem>
                                <MenuItem value="renewal" disabled={!hasActiveNonBasicSub} sx={!hasActiveNonBasicSub ? { opacity: 0.6 } : {}}>
                                    Gia hạn {!hasActiveNonBasicSub && '(Không khả dụng)'}
                                </MenuItem>
                            </Select>
                        </FormControl>

                        {/* Row 3 Left: Price (auto) */}
                        <TextField
                            label="Giá (VNĐ)"
                            value={selectedLicense?.price ? selectedLicense.price.toLocaleString('vi-VN') : '0'}
                            disabled
                            helperText="Giá gốc chưa bao gồm khuyến mãi"
                            fullWidth
                        />

                        {/* Row 3 Right: Duration */}
                        <TextField
                            label="Thời gian mua (ngày) *"
                            type="number"
                            value={formData.purchased_duration_days}
                            onChange={(e) => setFormData(prev => ({ ...prev, purchased_duration_days: parseInt(e.target.value) || 0 }))}
                            inputProps={{ min: 1, max: 9999 }}
                            helperText="Số ngày sử dụng dịch vụ"
                            fullWidth
                        />

                        {/* Row 4 Left: Broker — Autocomplete with search */}
                        <Autocomplete
                            value={selectedBroker}
                            onChange={(_, v) => handleBrokerChange(v)}
                            options={allBrokers}
                            getOptionLabel={getBrokerLabel}
                            loading={loadingBrokers}
                            disabled={isBrokerLocked}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Mã broker"
                                    variant="outlined"
                                    placeholder={isBrokerLocked ? 'Tự động từ thông tin người dùng' : 'Tìm kiếm broker theo mã hoặc tên'}
                                    helperText={isBrokerLocked ? 'Broker referral của người dùng (tự động điền)' : 'Tùy chọn — chọn đối tác giới thiệu'}
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: <>{loadingBrokers ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>,
                                    }}
                                />
                            )}
                            isOptionEqualToValue={(o, v) => o.id === v.id}
                        />

                        {/* Row 4 Right: Promotion — Autocomplete with search */}
                        <Autocomplete
                            value={selectedPromotion}
                            onChange={(_, v) => handlePromotionChange(v)}
                            options={allPromotions}
                            getOptionLabel={getPromoLabel}
                            loading={loadingPromotions}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Mã khuyến mãi"
                                    variant="outlined"
                                    placeholder="Tìm kiếm mã giảm giá"
                                    helperText="Tùy chọn — chỉ hiển thị mã đang hoạt động"
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: <>{loadingPromotions ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>,
                                    }}
                                />
                            )}
                            isOptionEqualToValue={(o, v) => o.id === v.id}
                        />

                        {/* Row 5: Notes — full width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <TextField
                                label="Ghi chú"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                multiline
                                rows={3}
                                placeholder="Ghi chú thêm về giao dịch..."
                                helperText="Tùy chọn - thông tin bổ sung về giao dịch"
                                fullWidth
                            />
                        </Box>
                    </Box>

                    {/* Info note box */}
                    <Box sx={{
                        mt: 3, p: 2,
                        bgcolor: theme.palette.component.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                        position: 'relative',
                        '&::before': {
                            content: '""', position: 'absolute',
                            top: 0, left: 0, right: 0, height: '3px',
                            bgcolor: 'info.main', borderRadius: borderRadiusTop('sm'),
                        },
                    }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'info.main' }}>
                            💡 Lưu ý về giao dịch:
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1, color: theme.palette.component.modal.noteText }}>
                            • Giao dịch mua mới: Tạo subscription mới cho người dùng với license đã chọn
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Giao dịch gia hạn: Mở rộng thời gian của subscription hiện tại
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Thời gian mua sẽ được cộng vào ngày bắt đầu/hết hạn tương ứng
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 1 }}>
                <Button onClick={onClose} disabled={loading} variant="outlined">Hủy</Button>
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
