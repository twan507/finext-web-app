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

    const [allFeatures, setAllFeatures] = useState<FeaturePublic[]>([]); const [formData, setFormData] = useState<LicenseCreateRequest>({
        key: '',
        name: '',
        price: 0,
        duration_days: 0, // No default duration
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
    }>({});    // Fetch all features
    const fetchFeatures = async () => {
        console.log('Starting to fetch features...');
        setLoadingFeatures(true);
        try {
            const response = await apiClient<{ items: FeaturePublic[]; total: number } | FeaturePublic[]>({
                url: `/api/v1/features/`,
                method: 'GET',
                queryParams: {
                    limit: 1000,
                    include_inactive: false
                }
            });

            console.log('Features API response:', {
                status: response.status,
                data: response.data,
                message: response.message
            });

            if (response.status === 200 && response.data) {
                let features: FeaturePublic[] = [];

                if ('items' in response.data && Array.isArray(response.data.items)) {
                    features = response.data.items;
                    console.log('Found paginated features:', features.length);
                } else if (Array.isArray(response.data)) {
                    features = response.data as FeaturePublic[];
                    console.log('Found direct array features:', features.length);
                } else {
                    console.warn('Unexpected response format:', response.data);
                }

                // Filter only active features
                const activeFeatures = features.filter(feature => feature.is_active);
                console.log(`Filtered ${activeFeatures.length} active features from ${features.length} total`);

                setAllFeatures(activeFeatures);

                if (activeFeatures.length > 0) {
                    console.log('Sample feature:', activeFeatures[0]);
                } else {
                    console.warn('No active features found, adding mock data for testing');
                    // Add mock data for testing if no features are returned
                    const mockFeatures: FeaturePublic[] = [
                        {
                            id: 'mock-1',
                            key: 'basic_feature',
                            name: 'Tính năng cơ bản',
                            description: 'Các tính năng cơ bản của hệ thống',
                            is_active: true
                        },
                        {
                            id: 'mock-2',
                            key: 'advanced_feature',
                            name: 'Tính năng nâng cao',
                            description: 'Các tính năng nâng cao',
                            is_active: true
                        }
                    ];
                    setAllFeatures(mockFeatures);
                    console.log('Set mock features:', mockFeatures.length);
                }
            } else {
                console.warn('Failed to load features, status:', response.status, 'message:', response.message);
                // Set mock data as fallback
                const mockFeatures: FeaturePublic[] = [
                    {
                        id: 'mock-1',
                        key: 'basic_feature',
                        name: 'Tính năng cơ bản',
                        description: 'Các tính năng cơ bản của hệ thống',
                        is_active: true
                    },
                    {
                        id: 'mock-2',
                        key: 'advanced_feature',
                        name: 'Tính năng nâng cao',
                        description: 'Các tính năng nâng cao',
                        is_active: true
                    }
                ];
                setAllFeatures(mockFeatures);
                setError('Không thể tải danh sách tính năng từ server. Đang sử dụng dữ liệu mẫu.');
            }
        } catch (err: any) {
            console.error('Failed to load features:', err);
            // Set mock data as fallback for errors
            const mockFeatures: FeaturePublic[] = [
                {
                    id: 'mock-1',
                    key: 'basic_feature',
                    name: 'Tính năng cơ bản',
                    description: 'Các tính năng cơ bản của hệ thống',
                    is_active: true
                },
                {
                    id: 'mock-2',
                    key: 'advanced_feature',
                    name: 'Tính năng nâng cao',
                    description: 'Các tính năng nâng cao',
                    is_active: true
                }
            ];
            setAllFeatures(mockFeatures);
            setError('Lỗi khi tải danh sách tính năng: ' + err.message + '. Đang sử dụng dữ liệu mẫu.');
        } finally {
            setLoadingFeatures(false);
        }
    }; useEffect(() => {
        if (open) {
            fetchFeatures();
        } else {            // Reset form when modal closes
            setFormData({
                key: '',
                name: '',
                price: 0,
                duration_days: 0, // No default duration
                is_active: true,
                feature_keys: []
            });
            setSelectedFeatures([]);
            setErrors({});
            setError(null);
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
    }; const handleClose = () => {
        if (!loading) {
            // Reset form
            setFormData({
                key: '',
                name: '',
                price: 0,
                duration_days: 0, // No default duration
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
    }; const handleFeatureChange = (_event: any, newValue: FeaturePublic[]) => {
        setSelectedFeatures(newValue);
        setFormData(prev => ({
            ...prev,
            feature_keys: newValue.map(feature => feature.key)
        }));
        // Clear feature error when user selects features
        if (errors.feature_keys) {
            setErrors(prev => ({ ...prev, feature_keys: undefined }));
        }
    };    // Common duration options
    const durationOptions = [
        { label: '1 tháng', value: 30 },
        { label: '3 tháng', value: 90 },
        { label: '6 tháng', value: 180 },
        { label: '1 năm', value: 365 },
        { label: '2 năm', value: 730 },
        { label: '3 năm', value: 1095 }
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

                        {/* Row 2: Price and Duration */}                        <TextField
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
                        />                        <Autocomplete
                            freeSolo
                            options={durationOptions}
                            getOptionLabel={(option) => {
                                if (typeof option === 'string') return option;
                                return option.label;
                            }}
                            inputValue={formData.duration_days ? formData.duration_days.toString() : ''}
                            onChange={(event, newValue) => {
                                // Only update when user selects from dropdown
                                if (newValue && typeof newValue === 'object') {
                                    setFormData(prev => ({ ...prev, duration_days: newValue.value }));
                                    // Clear error when user makes a selection
                                    if (errors.duration_days) {
                                        setErrors(prev => ({ ...prev, duration_days: undefined }));
                                    }
                                }
                            }}
                            onInputChange={(event, newInputValue, reason) => {
                                // Only update form data when user manually types (not from selection)
                                if (reason === 'input') {
                                    const numValue = parseInt(newInputValue) || 0;
                                    setFormData(prev => ({ ...prev, duration_days: numValue }));
                                    // Clear error when user types
                                    if (errors.duration_days) {
                                        setErrors(prev => ({ ...prev, duration_days: undefined }));
                                    }
                                }
                            }} filterOptions={(options, { inputValue }) => {
                                const numValue = parseInt(inputValue) || 0;
                                if (!numValue) return options;

                                // Filter options based on smart matching
                                return options.filter(option => {
                                    const optionValue = option.value;
                                    const optionLabel = option.label.toLowerCase();
                                    const inputStr = numValue.toString();

                                    // Exact match
                                    if (optionValue === numValue) return true;

                                    // Check if the option label contains the input number
                                    // For example: input "1" should match "1 tháng" and "1 năm"
                                    const labelContainsInput = optionLabel.includes(inputStr + ' ');
                                    if (labelContainsInput) return true;

                                    // Check if option value contains the input digits
                                    const optionStr = optionValue.toString();
                                    if (optionStr.includes(inputStr)) return true;

                                    // For longer inputs, show if input is close to option value (within reasonable range)
                                    if (inputStr.length >= 2) {
                                        const percentDiff = Math.abs(optionValue - numValue) / Math.max(optionValue, numValue);
                                        return percentDiff <= 0.3; // Within 30% difference
                                    }

                                    return false;
                                });
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Thời hạn (ngày) *"
                                    placeholder="Nhập số ngày hoặc chọn từ gợi ý"
                                    type="number"
                                    error={!!errors.duration_days}
                                    helperText={errors.duration_days}
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <DurationIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                    inputProps={{
                                        ...params.inputProps,
                                        min: 1,
                                        max: 3650,
                                    }}
                                />
                            )}
                            renderOption={(props, option) => {
                                const { key, ...otherProps } = props;
                                return (
                                    <Box component="li" key={`duration-${option.value}`} {...otherProps}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                            <Typography variant="body2">{option.label}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {option.value} ngày
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            }} disabled={loading}
                            fullWidth
                        />                        {/* Row 3: Active Status - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <CustomSwitchButton
                                checked={formData.is_active}
                                onChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                                label="Kích hoạt License"
                                description="Cho phép license có thể được sử dụng ngay sau khi tạo"
                                disabled={loading}
                                icon={<ActiveIcon />}
                                variant="unified"
                                size="small"
                                showIcon={true}
                                fullWidth={true}
                                backgroundColor="subtle"
                                borderStyle="prominent"
                                borderRadius={2}
                            />
                        </Box>

                        {/* Row 4: Features Selection - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <FormControl error={!!errors.feature_keys} fullWidth>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <FeatureIcon fontSize="small" color="primary" />
                                    <Typography variant="h6" fontWeight="medium">
                                        Tính năng *
                                    </Typography>
                                    {loadingFeatures && <CircularProgress size={16} />}
                                </Box>                                {loadingFeatures ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                                        <CircularProgress size={24} />
                                        <Typography variant="body2" sx={{ ml: 2 }}>
                                            Đang tải danh sách tính năng...
                                        </Typography>
                                    </Box>
                                ) : allFeatures.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                        Không có tính năng nào khả dụng
                                    </Typography>
                                ) : (
                                    <Box sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                        gap: 2
                                    }}>
                                        {allFeatures.map((feature) => {
                                            const isSelected = formData.feature_keys.includes(feature.key);
                                            return (
                                                <CustomSwitchButton
                                                    key={feature.id}
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        if (isSelected) {
                                                            // Remove feature
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                feature_keys: prev.feature_keys.filter(key => key !== feature.key)
                                                            }));
                                                            setSelectedFeatures(prev => prev.filter(f => f.id !== feature.id));
                                                        } else {
                                                            // Add feature
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                feature_keys: [...prev.feature_keys, feature.key]
                                                            }));
                                                            setSelectedFeatures(prev => [...prev, feature]);
                                                        }

                                                        // Clear error when user selects features
                                                        if (errors.feature_keys) {
                                                            setErrors(prev => ({ ...prev, feature_keys: undefined }));
                                                        }
                                                    }}
                                                    label={feature.key}
                                                    description={feature.name}
                                                    disabled={loading}
                                                    variant="unified"
                                                    size="small"
                                                    showIcon={false}
                                                    fullWidth={false}
                                                    backgroundColor="subtle"
                                                    borderStyle="prominent"
                                                    borderRadius={2}
                                                />
                                            );
                                        })}
                                    </Box>
                                )}

                                {/* Selected features summary */}
                                {formData.feature_keys.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Đã chọn {formData.feature_keys.length} tính năng:
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                            {selectedFeatures.map((feature) => (
                                                <Chip
                                                    key={feature.id}
                                                    label={feature.key}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                )}

                                {errors.feature_keys && (
                                    <FormHelperText sx={{ mt: 1 }}>{errors.feature_keys}</FormHelperText>
                                )}                            </FormControl>
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
