'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Autocomplete, Chip
} from '@mui/material';
import {
    Edit as EditIcon,
    Close as CloseIcon,
    Assignment as LicenseIcon,
    Numbers as LimitIcon,
    DateRange as DateIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { colorTokens } from 'theme/tokens';
import { convertGMT7ToUTC, convertUTCToGMT7DateString } from 'utils/dateUtils';
import { filterNonSystemLicenses } from 'utils/systemProtection';
import ModernSwitchButton from '../../components/ModernSwitchButton';

enum DiscountTypeEnumFE {
    PERCENTAGE = "percentage",
    FIXED_AMOUNT = "fixed_amount",
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

interface PromotionPublic {
    id: string;
    promotion_code: string;
    description?: string | null;
    discount_type: DiscountTypeEnumFE;
    discount_value: number;
    is_active: boolean;
    start_date?: string | null;
    end_date?: string | null;
    usage_limit?: number | null;
    usage_count: number;
    applicable_license_keys?: string[] | null;
    created_at: string;
    updated_at: string;
}

interface PromotionUpdateRequest {
    description?: string;
    start_date?: string;
    end_date?: string;
    usage_limit?: number;
    applicable_license_keys?: string[];
}

interface EditPromotionModalProps {
    open: boolean;
    onClose: () => void;
    promotion: PromotionPublic | null;
    onPromotionUpdated: () => void;
}

const EditPromotionModal: React.FC<EditPromotionModalProps> = ({
    open,
    onClose,
    promotion,
    onPromotionUpdated
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [allLicenses, setAllLicenses] = useState<LicensePublic[]>([]);

    const [formData, setFormData] = useState<PromotionUpdateRequest>({
        description: '',
        start_date: undefined,
        end_date: undefined,
        usage_limit: undefined,
        applicable_license_keys: []
    });

    const [startDateStr, setStartDateStr] = useState<string>('');
    const [endDateStr, setEndDateStr] = useState<string>('');
    const [selectedLicenses, setSelectedLicenses] = useState<LicensePublic[]>([]);
    const [hasUsageLimit, setHasUsageLimit] = useState(false);
    const [hasDateRange, setHasDateRange] = useState(false);
    const [hasLicenseRestriction, setHasLicenseRestriction] = useState(false);

    const [loading, setLoading] = useState(false);
    const [loadingLicenses, setLoadingLicenses] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form validation
    const [errors, setErrors] = useState<{
        usage_limit?: string;
        date_range?: string;
    }>({});

    // Fetch all licenses
    const fetchLicenses = async () => {
        setLoadingLicenses(true);
        try {
            const response = await apiClient<{ items: LicensePublic[]; total: number } | LicensePublic[]>({
                url: `/api/v1/licenses/?limit=1000`,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items)) {
                    const activeLicenses = response.data.items.filter(license => license.is_active);
                    const nonSystemLicenses = filterNonSystemLicenses(activeLicenses);
                    setAllLicenses(nonSystemLicenses);
                } else if (Array.isArray(response.data)) {
                    const activeLicenses = (response.data as LicensePublic[]).filter(license => license.is_active);
                    const nonSystemLicenses = filterNonSystemLicenses(activeLicenses);
                    setAllLicenses(nonSystemLicenses);
                }
            }
        } catch (err: any) {
            console.error('Failed to load licenses:', err.message);
        } finally {
            setLoadingLicenses(false);
        }
    };

    // Initialize form data when promotion changes
    useEffect(() => {
        if (promotion && open) {
            // Initialize form data
            setFormData({
                description: promotion.description || '',
                start_date: promotion.start_date || undefined,
                end_date: promotion.end_date || undefined,
                usage_limit: promotion.usage_limit || undefined,
                applicable_license_keys: promotion.applicable_license_keys || []
            });

            // Initialize date strings
            if (promotion.start_date) {
                setStartDateStr(convertUTCToGMT7DateString(promotion.start_date));
                setHasDateRange(true);
            } else {
                setStartDateStr('');
            }

            if (promotion.end_date) {
                setEndDateStr(convertUTCToGMT7DateString(promotion.end_date));
                setHasDateRange(true);
            } else {
                setEndDateStr('');
            }

            // Initialize usage limit
            setHasUsageLimit(promotion.usage_limit != null);

            // Initialize license restriction
            setHasLicenseRestriction(promotion.applicable_license_keys != null && promotion.applicable_license_keys.length > 0);

            // Fetch licenses if modal is open
            fetchLicenses();
        }
    }, [promotion, open]);

    // Set selected licenses when licenses are loaded and promotion data is available
    useEffect(() => {
        if (allLicenses.length > 0 && promotion?.applicable_license_keys) {
            const preselectedLicenses = allLicenses.filter(license =>
                promotion.applicable_license_keys?.includes(license.key)
            );
            setSelectedLicenses(preselectedLicenses);
        } else {
            setSelectedLicenses([]);
        }
    }, [allLicenses, promotion?.applicable_license_keys]);

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        // Validate usage limit
        if (hasUsageLimit && formData.usage_limit !== undefined && formData.usage_limit <= 0) {
            newErrors.usage_limit = 'Giới hạn sử dụng phải lớn hơn 0';
        }

        // Validate date range
        if (hasDateRange) {
            if (startDateStr && endDateStr) {
                const startDate = new Date(startDateStr);
                const endDate = new Date(endDateStr);
                if (startDate > endDate) {
                    newErrors.date_range = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu';
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!promotion || !validateForm()) return;

        setLoading(true);
        setError(null);

        try {
            // Prepare form data
            const submitData: PromotionUpdateRequest = {
                description: formData.description?.trim() || undefined,
                start_date: hasDateRange && startDateStr ? convertGMT7ToUTC(startDateStr, false) : undefined,
                end_date: hasDateRange && endDateStr ? convertGMT7ToUTC(endDateStr, true) : undefined,
                usage_limit: hasUsageLimit ? formData.usage_limit : undefined,
                applicable_license_keys: hasLicenseRestriction ? selectedLicenses.map(l => l.key) : undefined
            };

            const response = await apiClient({
                url: `/api/v1/promotions/${promotion.id}`,
                method: 'PUT',
                body: submitData,
            });

            if (response.status === 200) {
                onPromotionUpdated();
                handleClose();
            } else {
                setError(response.message || 'Không thể cập nhật khuyến mãi');
            }
        } catch (err: any) {
            setError(err.message || 'Không thể cập nhật khuyến mãi');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Reset form
        setFormData({
            description: '',
            start_date: undefined,
            end_date: undefined,
            usage_limit: undefined,
            applicable_license_keys: []
        });
        setStartDateStr('');
        setEndDateStr('');
        setSelectedLicenses([]);
        setHasUsageLimit(false);
        setHasDateRange(false);
        setHasLicenseRestriction(false);
        setErrors({});
        setError(null);
        onClose();
    };

    if (!promotion) return null;

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle>
                <Typography variant="h5" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EditIcon color="primary" />
                    Chỉnh sửa khuyến mãi: {promotion.promotion_code}
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

                    {/* Current Promotion Info */}
                    <Box sx={{
                        p: 2,
                        bgcolor: componentColors.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${componentColors.modal.noteBorder}`,
                        mb: 3
                    }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                            Thông tin hiện tại
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                            <Box>
                                <Typography variant="body2" color="text.secondary">Mã khuyến mãi:</Typography>
                                <Typography variant="body1" fontWeight="bold">{promotion.promotion_code}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">Loại giảm giá:</Typography>
                                <Typography variant="body1" fontWeight="bold">
                                    {promotion.discount_type === DiscountTypeEnumFE.PERCENTAGE
                                        ? `${promotion.discount_value}%`
                                        : `${promotion.discount_value.toLocaleString('vi-VN')} VNĐ`}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">Số lần đã sử dụng:</Typography>
                                <Typography variant="body1" fontWeight="bold">{promotion.usage_count}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">Trạng thái:</Typography>
                                <Typography variant="body1" fontWeight="bold" sx={{ color: promotion.is_active ? 'success.main' : 'error.main' }}>
                                    {promotion.is_active ? 'Hoạt động' : 'Không hoạt động'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr' },
                        gap: 3
                    }}>
                        {/* Description */}
                        <TextField
                            label="Mô tả"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Mô tả về chương trình khuyến mãi"
                            multiline
                            rows={3}
                            disabled={loading}
                            fullWidth
                        />

                        {/* Optional Settings Section */}
                        <Box>
                            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
                                Cài đặt khuyến mãi
                            </Typography>                            {/* Usage Limit */}
                            <Box sx={{ mb: 3 }}>
                                <ModernSwitchButton
                                    checked={hasUsageLimit}
                                    onChange={setHasUsageLimit}
                                    label="Giới hạn số lần sử dụng"
                                    description="Đặt giới hạn tối đa số lần khuyến mãi có thể được sử dụng"
                                    disabled={loading}
                                    icon={<LimitIcon />}
                                    variant="unified"
                                    size="small"
                                    showIcon={true}
                                    fullWidth={true}
                                    backgroundColor="subtle"
                                    borderStyle="subtle"
                                />
                                {hasUsageLimit && (
                                    <TextField
                                        label="Số lần sử dụng tối đa"
                                        type="number"
                                        value={formData.usage_limit || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: parseInt(e.target.value) || undefined }))}
                                        error={!!errors.usage_limit}
                                        helperText={errors.usage_limit || `Hiện tại đã sử dụng: ${promotion.usage_count} lần`}
                                        disabled={loading}
                                        fullWidth
                                        sx={{ mt: 2 }}
                                        inputProps={{ min: promotion.usage_count + 1 }}
                                    />
                                )}
                            </Box>                            {/* Date Range */}
                            <Box sx={{ mb: 3 }}>
                                <ModernSwitchButton
                                    checked={hasDateRange}
                                    onChange={setHasDateRange}
                                    label="Thiết lập thời gian có hiệu lực"
                                    description="Đặt ngày bắt đầu và kết thúc cho khuyến mãi"
                                    disabled={loading}
                                    icon={<DateIcon />}
                                    variant="unified"
                                    size="small"
                                    showIcon={true}
                                    fullWidth={true}
                                    backgroundColor="subtle"
                                    borderStyle="subtle"
                                />
                                {hasDateRange && (
                                    <Box sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                        gap: 2,
                                        mt: 2
                                    }}>
                                        <TextField
                                            label="Ngày bắt đầu"
                                            type="date"
                                            value={startDateStr}
                                            onChange={(e) => setStartDateStr(e.target.value)}
                                            disabled={loading}
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            error={!!errors.date_range}
                                        />
                                        <TextField
                                            label="Ngày kết thúc"
                                            type="date"
                                            value={endDateStr}
                                            onChange={(e) => setEndDateStr(e.target.value)}
                                            disabled={loading}
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            error={!!errors.date_range}
                                            helperText={errors.date_range}
                                        />
                                    </Box>
                                )}
                            </Box>                            {/* License Restriction */}
                            <Box>
                                <ModernSwitchButton
                                    checked={hasLicenseRestriction}
                                    onChange={setHasLicenseRestriction}
                                    label="Áp dụng chỉ cho các gói license cụ thể"
                                    description="Giới hạn khuyến mãi chỉ áp dụng cho một số gói license nhất định"
                                    disabled={loading}
                                    icon={<LicenseIcon />}
                                    variant="unified"
                                    size="small"
                                    showIcon={true}
                                    fullWidth={true}
                                    backgroundColor="subtle"
                                    borderStyle="subtle"
                                />
                                {hasLicenseRestriction && (
                                    <Autocomplete
                                        multiple
                                        options={allLicenses}
                                        getOptionLabel={(option) => `${option.key} - ${option.name}`}
                                        value={selectedLicenses}
                                        onChange={(_, newValue) => setSelectedLicenses(newValue)}
                                        disabled={loading || loadingLicenses}
                                        loading={loadingLicenses} renderTags={(value, getTagProps) =>
                                            value.map((option, index) => (
                                                <Chip
                                                    label={option.key}
                                                    {...getTagProps({ index })}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            ))
                                        }
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Chọn các gói license"
                                                placeholder="Tìm kiếm gói license..."
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
                                        sx={{ mt: 2 }}
                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                    />
                                )}
                            </Box>
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
                            bgcolor: 'warning.main',
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
                                color: 'warning.main'
                            }}
                        >
                            ⚠️ Lưu ý khi chỉnh sửa:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Không thể thay đổi mã khuyến mãi, loại giảm giá và giá trị giảm giá
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Số lần sử dụng tối đa phải lớn hơn số lần đã sử dụng ({promotion.usage_count})
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Thay đổi sẽ có hiệu lực ngay lập tức đối với các giao dịch mới
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 1 }}>
                <Button
                    onClick={handleClose}
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
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <EditIcon />}
                    sx={{
                        minWidth: { xs: 'auto', sm: 140 },
                        '& .MuiButton-startIcon': {
                            margin: { xs: 0, sm: '0 8px 0 -4px' }
                        },
                        px: { xs: 1, sm: 2 }
                    }}
                >
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        {loading ? 'Đang cập nhật...' : 'Cập nhật'}
                    </Box>
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditPromotionModal;
