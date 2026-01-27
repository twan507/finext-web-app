'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, FormControl, FormHelperText,
    InputLabel, Select, MenuItem, Chip,
    Autocomplete, InputAdornment, IconButton
} from '@mui/material';
import {
    Add as CreateIcon,
    Close as CloseIcon,
    Percent as PercentIcon,
    LocalAtm as MoneyIcon,
    Campaign as PromotionIcon,
    PowerSettingsNew as ActiveIcon,
    Numbers as LimitIcon,
    DateRange as DateIcon,
    Assignment as LicenseIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { convertGMT7ToUTC, convertUTCToGMT7DateString } from 'utils/dateUtils';
import { filterNonSystemLicenses } from 'utils/systemProtection';
import ModernSwitchButton from '../../components/ModernSwitchButton';
import { borderRadiusTop } from 'theme/tokens';

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

interface PromotionCreateRequest {
    promotion_code: string;
    description?: string;
    discount_type: DiscountTypeEnumFE;
    discount_value: number;
    is_active: boolean;
    start_date?: string;
    end_date?: string;
    usage_limit?: number;
    applicable_license_keys?: string[];
}

interface CreatePromotionModalProps {
    open: boolean;
    onClose: () => void;
    onPromotionCreated: () => void;
}

const CreatePromotionModal: React.FC<CreatePromotionModalProps> = ({
    open,
    onClose,
    onPromotionCreated
}) => {
    const theme = useTheme();


    const [allLicenses, setAllLicenses] = useState<LicensePublic[]>([]);

    const [formData, setFormData] = useState<PromotionCreateRequest>({
        promotion_code: '',
        description: '',
        discount_type: DiscountTypeEnumFE.PERCENTAGE,
        discount_value: 0,
        is_active: true,
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
        promotion_code?: string;
        discount_value?: string;
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
            }); if (response.status === 200 && response.data) {
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

    useEffect(() => {
        if (open) {
            fetchLicenses();
        }
    }, [open]);

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        // Validate promotion code
        if (!formData.promotion_code.trim()) {
            newErrors.promotion_code = 'Mã khuyến mãi là bắt buộc';
        } else if (formData.promotion_code.length < 3) {
            newErrors.promotion_code = 'Mã khuyến mãi phải có ít nhất 3 ký tự';
        } else if (!/^[A-Z0-9_-]+$/.test(formData.promotion_code)) {
            newErrors.promotion_code = 'Mã khuyến mãi chỉ được chứa chữ hoa, số, dấu gạch dưới và dấu gạch ngang';
        }

        // Validate discount value
        if (formData.discount_value <= 0) {
            newErrors.discount_value = 'Giá trị giảm giá phải lớn hơn 0';
        } else if (formData.discount_type === DiscountTypeEnumFE.PERCENTAGE && formData.discount_value > 100) {
            newErrors.discount_value = 'Phần trăm giảm giá không được vượt quá 100%';
        } else if (formData.discount_type === DiscountTypeEnumFE.FIXED_AMOUNT && formData.discount_value > 1000000) {
            newErrors.discount_value = 'Số tiền giảm giá không được vượt quá 1,000,000';
        }

        // Validate usage limit
        if (hasUsageLimit && formData.usage_limit !== undefined && formData.usage_limit <= 0) {
            newErrors.usage_limit = 'Giới hạn sử dụng phải lớn hơn 0';
        }        // Validate date range
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
        if (!validateForm()) return;

        setLoading(true);
        setError(null);

        try {            // Prepare form data
            const submitData: PromotionCreateRequest = {
                ...formData,
                start_date: hasDateRange && startDateStr ? convertGMT7ToUTC(startDateStr, false) : undefined,
                end_date: hasDateRange && endDateStr ? convertGMT7ToUTC(endDateStr, true) : undefined,
                usage_limit: hasUsageLimit ? formData.usage_limit : undefined,
                applicable_license_keys: hasLicenseRestriction ? selectedLicenses.map(l => l.key) : undefined
            };

            const response = await apiClient({
                url: '/api/v1/promotions/',
                method: 'POST',
                body: submitData,
            });

            if (response.status === 201 || response.status === 200) {
                onPromotionCreated();
                handleClose();
            } else {
                setError(response.message || 'Failed to create promotion');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create promotion');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Reset form
        setFormData({
            promotion_code: '',
            description: '',
            discount_type: DiscountTypeEnumFE.PERCENTAGE,
            discount_value: 0,
            is_active: true,
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

    const generatePromotionCode = () => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        setFormData(prev => ({ ...prev, promotion_code: result }));
    }; return (
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
                <Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PromotionIcon color="primary" />
                    Tạo khuyến mãi mới
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

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 3
                    }}>
                        {/* Row 1: Promotion Code - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                    label="Mã khuyến mãi *"
                                    value={formData.promotion_code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, promotion_code: e.target.value.toUpperCase() }))}
                                    error={!!errors.promotion_code}
                                    helperText={errors.promotion_code}
                                    disabled={loading}
                                    fullWidth
                                    placeholder="VD: SUMMER2024"
                                />
                                <Button
                                    onClick={generatePromotionCode}
                                    variant="outlined"
                                    disabled={loading}
                                    sx={{ minWidth: 'auto', whiteSpace: 'nowrap' }}
                                >
                                    Tự động
                                </Button>
                            </Box>
                        </Box>

                        {/* Row 2: Description - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <TextField
                                label="Mô tả"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Mô tả về chương trình khuyến mãi"
                                multiline
                                rows={2}
                                disabled={loading}
                                fullWidth
                            />
                        </Box>

                        {/* Row 3 Left: Discount Type */}
                        <FormControl fullWidth>
                            <InputLabel>Loại giảm giá *</InputLabel>
                            <Select
                                value={formData.discount_type}
                                onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value as DiscountTypeEnumFE }))}
                                disabled={loading}
                                label="Loại giảm giá *"
                            >
                                <MenuItem value={DiscountTypeEnumFE.PERCENTAGE}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <PercentIcon sx={{ mr: 1, fontSize: 'small' }} />
                                        Phần trăm
                                    </Box>
                                </MenuItem>
                                <MenuItem value={DiscountTypeEnumFE.FIXED_AMOUNT}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <MoneyIcon sx={{ mr: 1, fontSize: 'small' }} />
                                        Số tiền cố định
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>

                        {/* Row 3 Right: Discount Value */}
                        <TextField
                            label="Giá trị giảm giá *"
                            type="number"
                            value={formData.discount_value}
                            onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                            error={!!errors.discount_value}
                            helperText={errors.discount_value}
                            disabled={loading}
                            fullWidth
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {formData.discount_type === DiscountTypeEnumFE.PERCENTAGE ? '%' : 'VND'}
                                    </InputAdornment>
                                ),
                            }}
                        />                        {/* Row 4: Active Status - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <ModernSwitchButton
                                checked={formData.is_active}
                                onChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                                label="Kích hoạt khuyến mãi"
                                description="Cho phép khuyến mãi có thể được sử dụng bởi người dùng"
                                disabled={loading}
                                icon={<ActiveIcon />}
                                variant="unified"
                                size="small"
                                showIcon={true}
                                fullWidth={true}
                                backgroundColor="subtle"
                                borderStyle="prominent"
                            />
                        </Box>

                        {/* Row 5: Optional Settings Section - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
                                Cài đặt tùy chọn
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
                                        helperText={errors.usage_limit}
                                        disabled={loading}
                                        fullWidth
                                        sx={{ mt: 2 }}
                                        inputProps={{ min: 1 }}
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
                                    }}><TextField
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
                        bgcolor: theme.palette.component.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            bgcolor: 'info.main',
                            borderRadius: borderRadiusTop('sm')
                        },
                        position: 'relative'
                    }}>
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: 'info.main'
                            }}
                        >
                            💡 Lưu ý về khuyến mãi:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Mã khuyến mãi sẽ được kích hoạt ngay sau khi tạo (nếu chọn kích hoạt)
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Các cài đặt tùy chọn có thể được thay đổi sau khi tạo
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Khuyến mãi sẽ áp dụng cho tất cả gói license nếu không chọn hạn chế cụ thể
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
                        {loading ? 'Đang tạo...' : 'Tạo khuyến mãi'}
                    </Box>
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreatePromotionModal;
