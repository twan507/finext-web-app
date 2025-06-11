'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, FormControl, FormHelperText,
    Chip, Autocomplete, InputAdornment
} from '@mui/material';
import {
    Edit as EditIcon,
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
import ModernSwitchButton from '../../components/ModernSwitchButton';
import {
    getBasicFeatures,
    getSystemFeatures,
    isBasicFeature,
    isSystemFeature,
    filterSelectableFeatures,
    ensureBasicFeaturesIncluded,
    getFeatureKeysWithBasics
} from '../../../../utils/systemProtection';

interface LicensePublic {
    id: string;
    key: string;
    name: string;
    price: number;
    duration_days: number;
    is_active: boolean;
    feature_keys: string[];
    created_at?: string;
    updated_at?: string;
}

interface LicenseUpdateRequest {
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

interface EditLicenseModalProps {
    open: boolean;
    onClose: () => void;
    license: LicensePublic | null;
    onLicenseUpdated: () => void;
}

const EditLicenseModal: React.FC<EditLicenseModalProps> = ({
    open,
    onClose,
    license,
    onLicenseUpdated
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [allFeatures, setAllFeatures] = useState<FeaturePublic[]>([]); const [formData, setFormData] = useState<LicenseUpdateRequest>({
        name: '',
        price: 0,
        duration_days: 0,
        is_active: true,
        feature_keys: []
    });

    const [selectedFeatures, setSelectedFeatures] = useState<FeaturePublic[]>([]);

    const [loading, setLoading] = useState(false);
    const [loadingFeatures, setLoadingFeatures] = useState(false);
    const [error, setError] = useState<string | null>(null);    // Form validation
    const [errors, setErrors] = useState<{
        name?: string;
        price?: string;
        duration_days?: string;
        feature_keys?: string;
    }>({});    // Fetch all features
    const fetchFeatures = async () => {
        console.log('EditModal: Starting to fetch features...');
        setLoadingFeatures(true);
        try {
            const response = await apiClient<{ items: FeaturePublic[]; total: number } | FeaturePublic[]>({
                url: `/api/v1/features/`,
                method: 'GET',
                queryParams: {
                    skip: 0,
                    limit: 99999
                }
            });

            console.log('EditModal: Features API response:', {
                status: response.status,
                data: response.data,
                message: response.message
            });

            if (response.status === 200 && response.data) {
                let features: FeaturePublic[] = [];

                if ('items' in response.data && Array.isArray(response.data.items)) {
                    features = response.data.items;
                    console.log('EditModal: Found paginated features:', features.length);
                } else if (Array.isArray(response.data)) {
                    features = response.data as FeaturePublic[];
                    console.log('EditModal: Found direct array features:', features.length);
                } else {
                    console.warn('EditModal: Unexpected response format:', response.data);
                }                // Set all features (no filtering needed since API returns all)
                console.log(`EditModal: Loading ${features.length} total features`);
                setAllFeatures(features);

                // Auto-select features that are already assigned to the license, ensuring basic features are included
                if (license?.feature_keys && features.length > 0) {
                    const preselectedFeatures = features.filter(feature =>
                        license.feature_keys.includes(feature.key)
                    );
                    // Ensure basic features are always included
                    const finalSelectedFeatures = ensureBasicFeaturesIncluded(preselectedFeatures, features);
                    console.log('EditModal: Pre-selecting features:', finalSelectedFeatures.map(f => f.key));
                    setSelectedFeatures(finalSelectedFeatures);
                } else if (features.length > 0) {
                    // If no license features, at least select basic features
                    const basicFeatures = features.filter(feature => isBasicFeature(feature.key));
                    setSelectedFeatures(basicFeatures);
                }
            } else {
                console.warn('EditModal: Failed to load features, status:', response.status, 'message:', response.message);
                setError('Không thể tải danh sách tính năng từ server.');
            }
        } catch (err: any) {
            console.error('EditModal: Failed to load features:', err);
            setError('Lỗi khi tải danh sách tính năng: ' + err.message);
        } finally {
            setLoadingFeatures(false);
        }
    };    // Initialize form data when license changes
    useEffect(() => {
        if (license && open) {
            console.log('EditModal: Initializing form with license:', license);
            setFormData({
                name: license.name || '',
                price: license.price || 0,
                duration_days: license.duration_days || 0,
                is_active: license.is_active || true,
                feature_keys: getFeatureKeysWithBasics(license.feature_keys || [])
            });

            // Fetch features when modal opens
            fetchFeatures();
        } else if (!open) {
            // Reset when modal closes
            setSelectedFeatures([]);
            setAllFeatures([]);
        }
    }, [license, open]);

    // Additional effect to set selected features when both allFeatures and license are available
    useEffect(() => {
        if (allFeatures.length > 0 && license?.feature_keys && license.feature_keys.length > 0) {
            console.log('EditModal: Setting selected features from license:', license.feature_keys);
            const preselectedFeatures = allFeatures.filter(feature =>
                license.feature_keys.includes(feature.key)
            );
            console.log('EditModal: Found preselected features:', preselectedFeatures.map(f => f.key));
            setSelectedFeatures(preselectedFeatures);
        }
    }, [allFeatures, license?.feature_keys]);

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

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
        if (!license || !validateForm()) {
            return;
        }

        setLoading(true);
        setError(null); try {
            // Ensure basic features are included in the submission
            const finalFormData = {
                ...formData,
                feature_keys: getFeatureKeysWithBasics(formData.feature_keys)
            };

            const response = await apiClient({
                url: `/api/v1/licenses/${license.id}`,
                method: 'PUT',
                body: finalFormData,
            });

            if (response.status === 200) {
                onLicenseUpdated();
                handleClose();
            } else {
                setError(response.message || 'Có lỗi xảy ra khi cập nhật license.');
            }
        } catch (err: any) {
            setError(err.message || 'Không thể kết nối đến server.');
        } finally {
            setLoading(false);
        }
    }; const handleClose = () => {
        if (!loading) {
            console.log('EditModal: Closing and resetting form');            // Reset form
            setFormData({
                name: '',
                price: 0,
                duration_days: 0,
                is_active: true,
                feature_keys: []
            });
            setSelectedFeatures([]);
            setAllFeatures([]);
            setErrors({});
            setError(null);
            onClose();
        }
    };

    const handleInputChange = (field: keyof LicenseUpdateRequest) => (
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
    }; // Common duration options
    const durationOptions = [
        { label: '1 tháng', value: 30 },
        { label: '3 tháng', value: 90 },
        { label: '6 tháng', value: 180 },
        { label: '1 năm', value: 365 },
        { label: '2 năm', value: 730 },
        { label: '3 năm', value: 1095 }
    ];

    if (!license) {
        return null;
    } return (
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
                    Chỉnh sửa License
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {license.key}
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
                        {/* Row 1: License Key (Read-only) and Name */}
                        <TextField
                            label="License Key"
                            value={license.key}
                            disabled
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <KeyIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            helperText="License key không thể thay đổi"
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

                        <Autocomplete
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
                            }}
                            filterOptions={(options, { inputValue }) => {
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
                            }}
                            disabled={loading}
                            fullWidth
                        />                        {/* Row 3: Active Status - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <ModernSwitchButton
                                checked={formData.is_active}
                                onChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                                label="Kích hoạt License"
                                description="Cho phép license có thể được sử dụng"
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
                                </Box>

                                {loadingFeatures ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                                        <CircularProgress size={24} />
                                        <Typography variant="body2" sx={{ ml: 2 }}>
                                            Đang tải danh sách tính năng...
                                        </Typography>
                                    </Box>
                                ) : allFeatures.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                        Không có tính năng nào khả dụng
                                    </Typography>) : (<Box sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                        gap: 2
                                    }}>
                                        {/* Sort features: Basic first, then Regular, then System */}
                                        {[...allFeatures]
                                            .sort((a, b) => {
                                                const aIsBasic = isBasicFeature(a.key);
                                                const bIsBasic = isBasicFeature(b.key);
                                                const aIsSystem = isSystemFeature(a.key);
                                                const bIsSystem = isSystemFeature(b.key);

                                                // Basic features first
                                                if (aIsBasic && !bIsBasic) return -1;
                                                if (!aIsBasic && bIsBasic) return 1;

                                                // System features last
                                                if (aIsSystem && !bIsSystem) return 1;
                                                if (!aIsSystem && bIsSystem) return -1;

                                                // Regular features in between, sort by key
                                                return a.key.localeCompare(b.key);
                                            })
                                            .map((feature) => {
                                                const isSelected = formData.feature_keys.includes(feature.key);
                                                const isBasic = isBasicFeature(feature.key);
                                                const isSystem = isSystemFeature(feature.key);

                                                return (
                                                    <ModernSwitchButton
                                                        key={feature.id}
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            // Basic features cannot be deselected
                                                            if (isBasic && isSelected) {
                                                                return;
                                                            }

                                                            // System features cannot be modified
                                                            if (isSystem) {
                                                                return;
                                                            }

                                                            if (isSelected) {
                                                                // Remove feature
                                                                const newFeatureKeys = formData.feature_keys.filter(key => key !== feature.key);
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    feature_keys: getFeatureKeysWithBasics(newFeatureKeys)
                                                                }));
                                                                setSelectedFeatures(prev => {
                                                                    const filtered = prev.filter(f => f.id !== feature.id);
                                                                    return ensureBasicFeaturesIncluded(filtered, allFeatures);
                                                                });
                                                            } else {
                                                                // Add feature
                                                                const newFeatureKeys = [...formData.feature_keys, feature.key];
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    feature_keys: getFeatureKeysWithBasics(newFeatureKeys)
                                                                }));
                                                                setSelectedFeatures(prev => ensureBasicFeaturesIncluded([...prev, feature], allFeatures));
                                                            }

                                                            // Clear error when user selects features
                                                            if (errors.feature_keys) {
                                                                setErrors(prev => ({ ...prev, feature_keys: undefined }));
                                                            }
                                                        }}
                                                        label={feature.key}
                                                        description={`${feature.name}${isBasic ? ' (Bắt buộc)' : ''}${isSystem ? ' (Hệ thống)' : ''}`}
                                                        disabled={loading || isBasic || isSystem}
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
                                )}
                            </FormControl>
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
                    }}>                        <Typography
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
                            • License key không thể thay đổi sau khi tạo
                        </Typography>                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Thay đổi tính năng có thể ảnh hưởng đến người dùng hiện tại
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Tính năng cơ bản (Basic) sẽ được tự động bao gồm và không thể bỏ chọn
                        </Typography>                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Tính năng hệ thống (System) sẽ hiển thị nhưng không thể chọn hoặc bỏ chọn
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Thay đổi trạng thái hoặc giá có thể ảnh hưởng đến các subscription đang hoạt động
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

export default EditLicenseModal;
