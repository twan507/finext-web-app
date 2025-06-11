'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, FormControl, FormHelperText,
    InputLabel, Select, MenuItem, Chip,
    Autocomplete, InputAdornment
} from '@mui/material';
import {
    Add as CreateIcon,
    Close as CloseIcon,
    Key as KeyIcon,
    Title as NameIcon,
    LocalAtm as PriceIcon,
    Schedule as DurationIcon,
    PowerSettingsNew as ActiveIcon,
    Assignment as FeatureIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { colorTokens } from 'theme/tokens';
import CustomSwitchButton from '../../../../components/CustomSwitchButton';

interface LicenseCreateRequest {
    key: string;
    name: string;
    price: number;
    duration_days: number;
    is_active: boolean;
    feature_keys: string[];
}

interface FeaturePublic {
    id: string;
    key: string;
    name: string;
    description?: string;
    is_active: boolean;
}

interface CreateLicenseModalProps {
    open: boolean;
    onClose: () => void;
    onLicenseCreated: () => void;
}

const CreateLicenseModal: React.FC<CreateLicenseModalProps> = ({
    open,
    onClose,
    onLicenseCreated
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [allFeatures, setAllFeatures] = useState<FeaturePublic[]>([]);

    const [formData, setFormData] = useState<LicenseCreateRequest>({
        key: '',
        name: '',
        price: 0,
        duration_days: 365,
        is_active: true,
        feature_keys: []
    });

    const [selectedFeatures, setSelectedFeatures] = useState<FeaturePublic[]>([]);

    const [loading, setLoading] = useState(false);
    const [loadingFeatures, setLoadingFeatures] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form validation
    const [errors, setErrors] = useState<{
        key?: string;
        name?: string;
        price?: string;
        duration_days?: string;
        feature_keys?: string;
    }>({});

    // Fetch all features
    const fetchFeatures = async () => {
        setLoadingFeatures(true);
        try {
            const response = await apiClient<{ items: FeaturePublic[]; total: number } | FeaturePublic[]>({
                url: `/api/v1/features/?limit=1000`,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items)) {
                    const activeFeatures = response.data.items.filter(feature => feature.is_active);
                    setAllFeatures(activeFeatures);
                } else if (Array.isArray(response.data)) {
                    const activeFeatures = (response.data as FeaturePublic[]).filter(feature => feature.is_active);
                    setAllFeatures(activeFeatures);
                }
            }
        } catch (err: any) {
            console.error('Failed to load features:', err.message);
        } finally {
            setLoadingFeatures(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchFeatures();
        }
    }, [open]);

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        // Validate license key
        if (!formData.key.trim()) {
            newErrors.key = 'License key là bắt buộc';
        } else if (formData.key.length < 3) {
            newErrors.key = 'License key phải có ít nhất 3 ký tự';
        } else if (!/^[A-Z0-9_-]+$/.test(formData.key)) {
            newErrors.key = 'License key chỉ được chứa chữ hoa, số, dấu gạch dưới và dấu gạch ngang';
        }

        // Validate name
        if (!formData.name.trim()) {
            newErrors.name = 'Tên license là bắt buộc';
        } else if (formData.name.length < 3) {
            newErrors.name = 'Tên license phải có ít nhất 3 ký tự';
        }

        // Validate price
        if (formData.price <= 0) {
            newErrors.price = 'Giá phải lớn hơn 0';
        } else if (formData.price > 100000000) {
            newErrors.price = 'Giá không được vượt quá 100,000,000 VND';
        }

        // Validate duration
        if (formData.duration_days <= 0) {
            newErrors.duration_days = 'Thời hạn phải lớn hơn 0 ngày';
        } else if (formData.duration_days > 3650) { // 10 years max
            newErrors.duration_days = 'Thời hạn không được vượt quá 3650 ngày (10 năm)';
        }

        // Validate features
        if (formData.feature_keys.length === 0) {
            newErrors.feature_keys = 'Phải chọn ít nhất một tính năng';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient({
                url: '/api/v1/licenses/',
                method: 'POST',
                body: formData,
            });

            if (response.status === 201 || response.status === 200) {
                onLicenseCreated();
                handleClose();
            } else {
                setError(response.message || 'Có lỗi xảy ra khi tạo license.');
            }
        } catch (err: any) {
            setError(err.message || 'Không thể kết nối đến server.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            // Reset form
            setFormData({
                key: '',
                name: '',
                price: 0,
                duration_days: 365,
                is_active: true,
                feature_keys: []
            });
            setSelectedFeatures([]);
            setErrors({});
            setError(null);
            onClose();
        }
    };

    const handleInputChange = (field: keyof LicenseCreateRequest) => (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const value = event.target.value;
        if (field === 'price' || field === 'duration_days') {
            const numValue = parseFloat(value) || 0;
            setFormData(prev => ({ ...prev, [field]: numValue }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
        // Clear error when user starts typing
        if (errors[field as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleFeatureChange = (event: any, newValue: FeaturePublic[]) => {
        setSelectedFeatures(newValue);
        setFormData(prev => ({
            ...prev,
            feature_keys: newValue.map(feature => feature.key)
        }));
        // Clear feature error when user selects features
        if (errors.feature_keys) {
            setErrors(prev => ({ ...prev, feature_keys: undefined }));
        }
    };

    // Common duration options
    const durationOptions = [
        { label: '30 ngày (1 tháng)', value: 30 },
        { label: '90 ngày (3 tháng)', value: 90 },
        { label: '180 ngày (6 tháng)', value: 180 },
        { label: '365 ngày (1 năm)', value: 365 },
        { label: '730 ngày (2 năm)', value: 730 },
        { label: '1095 ngày (3 năm)', value: 1095 },
    ];

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
                    <CreateIcon color="primary" />
                    Tạo License Mới
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
                        {/* Row 1: License Key and Name */}
                        <TextField
                            label="License Key *"
                            placeholder="Ví dụ: PRO_ANNUAL, PREMIUM_MONTHLY"
                            value={formData.key}
                            onChange={handleInputChange('key')}
                            error={!!errors.key}
                            helperText={errors.key}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <KeyIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            inputProps={{
                                style: { textTransform: 'uppercase' }
                            }}
                            onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                const target = e.target as HTMLInputElement;
                                target.value = target.value.toUpperCase();
                            }}
                            disabled={loading}
                            fullWidth
                        />

                        <TextField
                            label="Tên License *"
                            placeholder="Ví dụ: Gói Pro hàng năm"
                            value={formData.name}
                            onChange={handleInputChange('name')}
                            error={!!errors.name}
                            helperText={errors.name}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <NameIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            disabled={loading}
                            fullWidth
                        />

                        {/* Row 2: Price and Duration */}
                        <TextField
                            label="Giá (VND) *"
                            type="number"
                            placeholder="Ví dụ: 500000"
                            value={formData.price || ''}
                            onChange={handleInputChange('price')}
                            error={!!errors.price}
                            helperText={errors.price}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PriceIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            disabled={loading}
                            fullWidth
                        />

                        <FormControl error={!!errors.duration_days} disabled={loading} fullWidth>
                            <InputLabel>Thời hạn *</InputLabel>
                            <Select
                                value={formData.duration_days}
                                onChange={(e) => setFormData(prev => ({ ...prev, duration_days: Number(e.target.value) }))}
                                label="Thời hạn *"
                                startAdornment={
                                    <InputAdornment position="start">
                                        <DurationIcon fontSize="small" />
                                    </InputAdornment>
                                }
                            >
                                {durationOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                                <MenuItem value={formData.duration_days}>
                                    {!durationOptions.find(opt => opt.value === formData.duration_days) &&
                                        `${formData.duration_days} ngày (Tùy chỉnh)`}
                                </MenuItem>
                            </Select>
                            {errors.duration_days && (
                                <FormHelperText>{errors.duration_days}</FormHelperText>
                            )}
                        </FormControl>

                        {/* Row 3: Custom Duration Input - Full Width when needed */}
                        {!durationOptions.find(opt => opt.value === formData.duration_days) && (
                            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                <TextField
                                    label="Thời hạn tùy chỉnh (ngày)"
                                    type="number"
                                    placeholder="Nhập số ngày tùy chỉnh"
                                    value={formData.duration_days || ''}
                                    onChange={handleInputChange('duration_days')}
                                    error={!!errors.duration_days}
                                    helperText={errors.duration_days || "Nhập số ngày tùy chỉnh cho license"}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <DurationIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                    disabled={loading}
                                    fullWidth
                                />
                            </Box>
                        )}

                        {/* Row 4: Features Selection - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <FormControl error={!!errors.feature_keys} fullWidth>
                                <Autocomplete
                                    multiple
                                    options={allFeatures}
                                    getOptionLabel={(option) => `${option.key} - ${option.name}`}
                                    value={selectedFeatures}
                                    onChange={handleFeatureChange}
                                    loading={loadingFeatures}
                                    disabled={loading}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Tính năng *"
                                            placeholder="Chọn các tính năng cho license này"
                                            error={!!errors.feature_keys}
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: (
                                                    <>
                                                        <InputAdornment position="start">
                                                            <FeatureIcon fontSize="small" />
                                                        </InputAdornment>
                                                        {params.InputProps.startAdornment}
                                                    </>
                                                ),
                                                endAdornment: (
                                                    <>
                                                        {loadingFeatures ? <CircularProgress color="inherit" size={20} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                    renderTags={(tagValue, getTagProps) =>
                                        tagValue.map((option, index) => (
                                            <Chip
                                                label={option.key}
                                                {...getTagProps({ index })}
                                                key={option.id}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        ))
                                    }
                                    renderOption={(props, option) => (
                                        <Box component="li" {...props}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                <Typography variant="body2" fontWeight="medium">
                                                    {option.key}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {option.name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                />
                                {errors.feature_keys && (
                                    <FormHelperText>{errors.feature_keys}</FormHelperText>
                                )}
                            </FormControl>
                        </Box>                        {/* Row 5: Active Status - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <CustomSwitchButton
                                checked={formData.is_active}
                                onChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                                label="Kích hoạt License"
                                description="Cho phép license có thể được sử dụng ngay sau khi tạo"
                                disabled={loading}
                                icon={<ActiveIcon />}
                                variant="unified"
                                size="medium"
                                showIcon={true}
                                fullWidth={true}
                                backgroundColor="subtle"
                                borderStyle="prominent"
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
                            💡 Lưu ý về license:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: componentColors.modal.noteText
                            }}
                        >
                            • License key phải là duy nhất và chỉ chứa chữ hoa, số, dấu gạch dưới và dấu gạch ngang
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Giá và thời hạn có thể được chỉnh sửa sau khi tạo
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Tính năng đã chọn sẽ định nghĩa quyền truy cập của license này
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
                    disabled={loading || loadingFeatures}
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
                        {loading ? 'Đang tạo...' : 'Tạo License'}
                    </Box>
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateLicenseModal;
