// finext-nextjs/app/admin/permissions/components/EditPermissionModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Chip, Autocomplete
} from '@mui/material';
import {
    Gavel as PermissionIcon,
    Save as SaveIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';

interface PermissionUpdate {
    name: string;
    description?: string;
    category: string;
}

interface PermissionSystemPublic {
    id: string;
    name: string;
    description?: string | null;
    roles: string[];
    category: string;
    created_at: string;
    updated_at: string;
}

interface EditPermissionModalProps {
    open: boolean;
    onClose: () => void;
    onPermissionUpdated: () => void; permission: PermissionSystemPublic | null;
}

const EditPermissionModal: React.FC<EditPermissionModalProps> = ({
    open,
    onClose,
    onPermissionUpdated,
    permission
}) => {
    const theme = useTheme();
    const [formData, setFormData] = useState<PermissionUpdate>({
        name: '',
        description: '',
        category: ''
    }); const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);    // Data state for dropdowns
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [categoryError, setCategoryError] = useState<string | null>(null);

    // Fetch categories when modal opens
    useEffect(() => {
        if (open) {
            fetchAvailableData();
        }
    }, [open]); const fetchAvailableData = async () => {
        setLoadingData(true);
        setCategoryError(null);
        try {
            // Fetch existing categories from permissions
            const permissionsResponse = await apiClient<{ items: { category: string }[] }>({
                url: '/api/v1/permissions/admin/definitions?limit=99999',
                method: 'GET'
            });

            if (permissionsResponse.status === 200 && permissionsResponse.data) {
                const categoriesSet = new Set(permissionsResponse.data.items.map(p => p.category));
                const existingCategories = Array.from(categoriesSet).filter(cat => cat && cat.trim()).sort();

                if (existingCategories.length > 0) {
                    setAvailableCategories(existingCategories);
                } else {
                    setCategoryError('Không tìm thấy danh mục nào. Vui lòng tạo ít nhất một permission với danh mục trước.');
                }
            } else {
                setCategoryError('Không thể tải danh sách danh mục. Vui lòng thử lại.');
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
            setCategoryError('Lỗi khi tải danh sách danh mục. Vui lòng kiểm tra kết nối mạng.');
        } finally {
            setLoadingData(false);
        }
    };

    // Load permission data when permission prop changes
    useEffect(() => {
        if (permission) {
            setFormData({
                name: permission.name,
                description: permission.description || '',
                category: permission.category
            });
            setError(null);
        }
    }, [permission]); const validateForm = (): string | null => {
        if (!formData.name.trim()) {
            return 'Tên permission là bắt buộc';
        }

        // Validate format: abcd:efgh
        const permissionNameRegex = /^[a-z]+:[a-z_]+$/;
        if (!permissionNameRegex.test(formData.name.trim())) {
            return 'Tên permission phải có định dạng "resource:action_name" trong đó resource chỉ chứa chữ thường, action_name chứa chữ thường và dấu gạch dưới';
        }

        // Kiểm tra có đúng 3 thành phần (resource:action)
        const parts = formData.name.trim().split(':');
        if (parts.length !== 2) {
            return 'Tên permission phải có đúng một dấu hai chấm (:) phân cách resource và action_name';
        }

        const [resource, action] = parts;
        if (!resource || !action) {
            return 'Cả resource và action đều là bắt buộc (định dạng: resource:action_name)';
        }

        if (formData.name.length < 3 || formData.name.length > 100) {
            return 'Tên permission phải từ 3-100 ký tự';
        } if (!formData.category.trim()) {
            return 'Danh mục là bắt buộc';
        }

        if (categoryError) {
            return categoryError;
        }

        if (availableCategories.length === 0 && !categoryError) {
            return 'Không có danh mục khả dụng. Vui lòng thử tải lại.';
        }

        if (formData.description && formData.description.length > 500) {
            return 'Mô tả permission không được vượt quá 500 ký tự';
        }

        return null;
    };

    const handleSubmit = async () => {
        if (!permission) return;

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const requestData: PermissionUpdate = {
                name: formData.name.trim(),
                category: formData.category,
                ...(formData.description?.trim() && { description: formData.description.trim() })
            }; const response = await apiClient({
                url: `/api/v1/permissions/${permission.id}`,
                method: 'PUT',
                body: requestData
            });

            if (response.status >= 200 && response.status < 300) {
                onPermissionUpdated();
                onClose();
            } else {
                throw new Error(response.data?.detail || 'Không thể cập nhật permission');
            }
        } catch (err) {
            console.error('Error updating permission:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Đã xảy ra lỗi khi cập nhật permission');
            }
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

    // Check if this is a system permission that shouldn't be fully editable
    const isSystemPermission = permission?.name.includes('admin_only') || permission?.name.includes('system');

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: theme.palette.component.modal.background,
                    borderRadius: 2
                }
            }}
        >            <DialogTitle sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 2
        }}>
                <PermissionIcon color="primary" />
                <Typography variant="h6" component="span">
                    Chỉnh sửa Permission
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {isSystemPermission && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            <strong>Cảnh báo:</strong> Đây là permission hệ thống. Hãy cẩn thận khi chỉnh sửa.
                        </Alert>
                    )}

                    <TextField
                        label="Tên Permission *"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        fullWidth
                        placeholder="vd: admin_only_feature_access"
                        helperText="Chỉ được sử dụng chữ cái và dấu gạch dưới (_)"
                        disabled={loading || isSystemPermission}
                    />

                    <TextField
                        label="Mô tả"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Mô tả chức năng của permission này..."
                        helperText={`${formData.description?.length || 0}/500 ký tự`}
                        disabled={loading}
                    />                    <Autocomplete
                        options={availableCategories}
                        value={formData.category}
                        onChange={(_, newValue) => setFormData(prev => ({ ...prev, category: newValue || '' }))}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Danh mục *"
                                placeholder={categoryError ? "Không có danh mục khả dụng" : "Chọn danh mục"}
                                error={!!categoryError}
                                helperText={categoryError}
                            />
                        )}
                        getOptionLabel={(option) => option}
                        disabled={loading || loadingData || !!categoryError}
                    />

                    {categoryError && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                            {categoryError}
                        </Alert>
                    )}

                    {/* Permission info */}
                    {permission && (
                        <Box sx={{
                            p: 2,
                            backgroundColor: theme.palette.component.modal.noteBackground,
                            border: '1px solid',
                            borderColor: theme.palette.component.modal.noteBorder,
                            borderRadius: 1
                        }}>
                            <Typography variant="body2" color={theme.palette.component.modal.noteText}>
                                <strong>ID:</strong> {permission.id}<br />
                                <strong>Tạo lúc:</strong> {new Date(permission.created_at).toLocaleString('vi-VN')}<br />
                                <strong>Cập nhật lúc:</strong> {new Date(permission.updated_at).toLocaleString('vi-VN')}<br />
                                <strong>Roles hiện tại:</strong> {permission.roles.length > 0 ? permission.roles.join(', ') : 'Chưa có role nào sử dụng'}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{
                p: 3,
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                gap: 1
            }}>
                <Button
                    onClick={handleClose}
                    disabled={loading}
                    startIcon={<CloseIcon />}
                    sx={{ minWidth: 100 }}
                >
                    Hủy
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
                    sx={{ minWidth: 120 }}
                >
                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditPermissionModal;
