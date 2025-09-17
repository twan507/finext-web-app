// finext-nextjs/app/admin/features/components/CreateFeatureModal.tsx
'use client';

import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme
} from '@mui/material';
import {
    Category as FeatureIcon,
    Add as CreateIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { colorTokens } from 'theme/tokens';

interface FeatureCreate {
    key: string;
    name: string;
    description?: string;
}

interface CreateFeatureModalProps {
    open: boolean;
    onClose: () => void;
    onFeatureCreated: () => void;
}

const CreateFeatureModal: React.FC<CreateFeatureModalProps> = ({
    open,
    onClose,
    onFeatureCreated
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [formData, setFormData] = useState<FeatureCreate>({
        key: '',
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateForm = (): string | null => {
        if (!formData.key.trim()) {
            return 'Key tính năng là bắt buộc';
        }

        if (formData.key.length < 3 || formData.key.length > 100) {
            return 'Key tính năng phải từ 3-100 ký tự';
        }

        if (!/^[a-zA-Z_]+$/.test(formData.key)) {
            return 'Key tính năng chỉ được chứa chữ cái và dấu gạch dưới';
        }

        if (!formData.name.trim()) {
            return 'Tên tính năng là bắt buộc';
        }

        if (formData.name.length < 3 || formData.name.length > 100) {
            return 'Tên tính năng phải từ 3-100 ký tự';
        }

        if (formData.description && formData.description.length > 500) {
            return 'Mô tả tính năng không được vượt quá 500 ký tự';
        }

        return null;
    };

    const handleSubmit = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const requestData: FeatureCreate = {
                key: formData.key.trim(),
                name: formData.name.trim(),
                ...(formData.description?.trim() && { description: formData.description.trim() })
            };

            const response = await apiClient({
                url: '/api/v1/features/',
                method: 'POST',
                body: requestData
            });

            if (response.status >= 200 && response.status < 300) {
                // Reset form
                setFormData({
                    key: '',
                    name: '',
                    description: ''
                });
                onFeatureCreated(); // Refresh the features list
                onClose(); // Close modal
            } else {
                setError(response.message || 'Đã xảy ra lỗi khi tạo tính năng');
            }
        } catch (err: any) {
            console.error('Error creating feature:', err);
            setError(err.message || 'Đã xảy ra lỗi khi tạo tính năng');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            // Reset form when closing
            setFormData({
                key: '',
                name: '',
                description: ''
            });
            setError(null);
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle>
                <Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FeatureIcon color="primary" />
                    Tạo tính năng mới
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
                        {/* Feature Key - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <TextField
                                fullWidth
                                label="Key tính năng *"
                                value={formData.key}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    key: e.target.value.replace(/[^a-zA-Z_]/g, '') // Only allow letters and underscore
                                }))}
                                placeholder="view_advanced_chart"
                                helperText="Key định danh duy nhất (chỉ chữ cái và dấu gạch dưới). Ví dụ: view_advanced_chart"
                                disabled={loading}
                                inputProps={{
                                    maxLength: 100,
                                    pattern: '^[a-zA-Z_]+$'
                                }}
                            />
                        </Box>

                        {/* Feature Name - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <TextField
                                fullWidth
                                label="Tên tính năng *"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    name: e.target.value
                                }))}
                                placeholder="Xem biểu đồ nâng cao"
                                helperText="Tên dễ hiểu của tính năng"
                                disabled={loading}
                                inputProps={{
                                    maxLength: 100
                                }}
                            />
                        </Box>

                        {/* Description - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Mô tả tính năng"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    description: e.target.value
                                }))}
                                placeholder="Cho phép người dùng xem các loại biểu đồ và chỉ báo kỹ thuật phức tạp..."
                                helperText="Mô tả chi tiết về tính năng (tùy chọn)"
                                disabled={loading}
                                inputProps={{
                                    maxLength: 500
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Information Note */}
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
                            sx={{
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: 'info.main'
                            }}
                        >
                            ℹ️ Lưu ý:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Key tính năng phải là duy nhất và không thể thay đổi sau khi tạo
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Tính năng mới sẽ cần được gán vào các license để có hiệu lực
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Chỉ có thể chỉnh sửa tên và mô tả sau khi tạo
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
                    disabled={loading || !formData.key.trim() || !formData.name.trim()}
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
                        {loading ? 'Đang tạo...' : 'Tạo tính năng'}
                    </Box>
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CreateFeatureModal;
