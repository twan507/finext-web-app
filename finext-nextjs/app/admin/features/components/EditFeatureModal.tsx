// finext-nextjs/app/admin/features/components/EditFeatureModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Chip
} from '@mui/material';
import {
    EditSquare as EditIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
interface FeaturePublic {
    id: string;
    key: string;
    name: string;
    description?: string | null;
}

interface FeatureUpdate {
    name?: string;
    description?: string;
}

interface EditFeatureModalProps {
    open: boolean;
    onClose: () => void;
    feature: FeaturePublic | null;
    onFeatureUpdated: () => void;
}

const EditFeatureModal: React.FC<EditFeatureModalProps> = ({
    open,
    onClose,
    feature,
    onFeatureUpdated
}) => {
    const theme = useTheme();
    

    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update form data when feature changes
    useEffect(() => {
        if (feature) {
            setFormData({
                name: feature.name || '',
                description: feature.description || ''
            });
        }
    }, [feature]);

    const validateForm = (): string | null => {
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

    const hasChanges = (): boolean => {
        if (!feature) return false;

        return (
            formData.name.trim() !== (feature.name || '') ||
            formData.description.trim() !== (feature.description || '')
        );
    };

    const handleSubmit = async () => {
        if (!feature) return;

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        if (!hasChanges()) {
            setError('Không có thay đổi nào để cập nhật');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const requestData: FeatureUpdate = {
                name: formData.name.trim(),
                ...(formData.description?.trim() && { description: formData.description.trim() })
            };

            const response = await apiClient({
                url: `/api/v1/features/${feature.id}`,
                method: 'PUT',
                body: requestData
            });

            if (response.status >= 200 && response.status < 300) {
                onFeatureUpdated(); // Refresh the features list
                onClose(); // Close modal
            } else {
                setError(response.message || 'Đã xảy ra lỗi khi cập nhật tính năng');
            }
        } catch (err: any) {
            console.error('Error updating feature:', err);
            setError(err.message || 'Đã xảy ra lỗi khi cập nhật tính năng');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setError(null);
            onClose();
        }
    };

    if (!feature) return null;

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
                    <EditIcon color="primary" />
                    Chỉnh sửa tính năng
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Key:
                    </Typography>
                    <Chip
                        label={feature.key}
                        size="small"
                        variant="outlined"
                    />
                </Box>
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
                        gridTemplateColumns: '1fr',
                        gap: 3
                    }}>
                        {/* Feature Name */}
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

                        {/* Description */}
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

                    {/* Information Note */}
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
                            bgcolor: 'warning.main',
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
                                color: 'warning.main'
                            }}
                        >
                            ⚠️ Lưu ý:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Key tính năng không thể thay đổi
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Thay đổi có thể ảnh hưởng đến các license đang sử dụng tính năng này
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Cập nhật sẽ có hiệu lực ngay lập tức
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
                    disabled={loading || !formData.name.trim() || !hasChanges()}
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

export default EditFeatureModal;
