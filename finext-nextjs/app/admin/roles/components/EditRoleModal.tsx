'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, FormControl, FormHelperText,
    InputAdornment, Chip, Collapse, IconButton
} from '@mui/material';
import {
    Edit as EditIcon,
    Close as CloseIcon,
    Security as NameIcon,
    Description as DescriptionIcon,
    Assignment as PermissionIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    ToggleOff as ToggleOffIcon,
    ToggleOn as ToggleOnIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { colorTokens } from 'theme/tokens';
import ModernSwitchButton from '../../components/ModernSwitchButton';

interface RoleUpdateRequest {
    name: string;
    description?: string;
    permission_ids: string[];
}

interface PermissionPublic {
    id: string;
    name: string;
    description?: string;
    category: string;
    roles: string[];
    created_at?: string;
    updated_at?: string;
}

interface RolePublic {
    id: string;
    name: string;
    description?: string | null;
    permission_ids: string[];
    created_at: string;
    updated_at: string;
}

interface EditRoleModalProps {
    open: boolean;
    onClose: () => void;
    role: RolePublic | null;
    onRoleUpdated?: () => void;
}

const EditRoleModal: React.FC<EditRoleModalProps> = ({
    open,
    onClose,
    role,
    onRoleUpdated
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [allPermissions, setAllPermissions] = useState<PermissionPublic[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, PermissionPublic[]>>({});

    const [formData, setFormData] = useState<RoleUpdateRequest>({
        name: '',
        description: '',
        permission_ids: []
    });

    const [selectedPermissions, setSelectedPermissions] = useState<PermissionPublic[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const [loading, setLoading] = useState(false);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form validation
    const [errors, setErrors] = useState<{
        name?: string;
        description?: string;
        permission_ids?: string;
    }>({});    // Get category names sorted by priority
    const categoryNames = useMemo(() => {
        const priorityOrder = [
            'admin_system',
            'user_management',
            'broker_management',
            'transaction_management',
            'subscription_management',
            'others'
        ];

        return categories.sort((a, b) => {
            const indexA = priorityOrder.indexOf(a);
            const indexB = priorityOrder.indexOf(b);

            // If both categories are in priority list, sort by their index
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }

            // If only A is in priority list, A comes first
            if (indexA !== -1) return -1;

            // If only B is in priority list, B comes first
            if (indexB !== -1) return 1;

            // If neither is in priority list, sort alphabetically
            return a.localeCompare(b);
        });
    }, [categories]);

    // Fetch all permissions and group by category
    const fetchPermissions = async () => {
        console.log('EditRoleModal: Starting to fetch permissions...');
        setLoadingPermissions(true);
        try {
            const response = await apiClient<{ items: PermissionPublic[]; total: number } | PermissionPublic[]>({
                url: `/api/v1/permissions/admin/definitions`,
                method: 'GET',
                queryParams: {
                    skip: 0,
                    limit: 99999
                }
            });

            console.log('EditRoleModal: Permissions API response:', {
                status: response.status,
                data: response.data,
                message: response.message
            });

            if (response.status === 200 && response.data) {
                let permissions: PermissionPublic[] = [];

                if ('items' in response.data && Array.isArray(response.data.items)) {
                    permissions = response.data.items;
                    console.log('EditRoleModal: Found paginated permissions:', permissions.length);
                } else if (Array.isArray(response.data)) {
                    permissions = response.data as PermissionPublic[];
                    console.log('EditRoleModal: Found direct array permissions:', permissions.length);
                } else {
                    console.warn('EditRoleModal: Unexpected response format:', response.data);
                }

                console.log(`EditRoleModal: Loading ${permissions.length} total permissions`);
                setAllPermissions(permissions);

                // Group permissions by category (using resource as fallback)
                const grouped: Record<string, PermissionPublic[]> = {};
                const foundCategories: Set<string> = new Set();

                permissions.forEach(permission => {
                    // Use category field if available, otherwise fall back to resource
                    const category = permission.category;
                    if (!grouped[category]) {
                        grouped[category] = [];
                    }
                    grouped[category].push(permission);
                    foundCategories.add(category);
                });                // Sort permissions within each category by name
                Object.keys(grouped).forEach(category => {
                    grouped[category].sort((a, b) => {
                        const nameA = a.name || '';
                        const nameB = b.name || '';
                        return nameA.localeCompare(nameB);
                    });
                });

                console.log(`EditRoleModal: Grouped permissions into ${Object.keys(grouped).length} categories:`, Object.keys(grouped));
                setCategories(Array.from(foundCategories).sort());
                setPermissionsByCategory(grouped);

                // Auto-select existing permissions if role is provided
                if (role && role.permission_ids) {
                    console.log('EditRoleModal: Auto-selecting existing permissions:', role.permission_ids);
                    const existingSelectedPermissions = permissions.filter(p =>
                        role.permission_ids.includes(p.id)
                    );
                    setSelectedPermissions(existingSelectedPermissions);
                }
            } else {
                console.warn('EditRoleModal: Failed to load permissions, status:', response.status, 'message:', response.message);
                setError('Không thể tải danh sách quyền từ server.');
            }
        } catch (err: any) {
            console.error('EditRoleModal: Failed to load permissions:', err);
            setError('Lỗi khi tải danh sách quyền: ' + err.message);
        } finally {
            setLoadingPermissions(false);
        }
    };

    // Initialize form data when role changes
    useEffect(() => {
        if (open && role) {
            console.log('EditRoleModal: Initializing form with role data:', role);
            setFormData({
                name: role.name,
                description: role.description || '',
                permission_ids: role.permission_ids || []
            });
            fetchPermissions();
        } else if (open) {
            fetchPermissions();
        } else {
            // Reset form when modal closes
            setFormData({
                name: '',
                description: '',
                permission_ids: []
            });
            setSelectedPermissions([]);
            setExpandedCategories(new Set());
            setCategories([]);
            setPermissionsByCategory({});
            setAllPermissions([]);
            setErrors({});
            setError(null);
        }
    }, [open, role]);

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        // Validate role name
        if (!formData.name.trim()) {
            newErrors.name = 'Tên vai trò là bắt buộc';
        } else if (formData.name.length < 2) {
            newErrors.name = 'Tên vai trò phải có ít nhất 2 ký tự';
        } else if (formData.name.length > 50) {
            newErrors.name = 'Tên vai trò không được vượt quá 50 ký tự';
        }

        // Validate description (optional)
        if (formData.description && formData.description.length > 500) {
            newErrors.description = 'Mô tả không được vượt quá 500 ký tự';
        }

        // Validate permissions
        if (formData.permission_ids.length === 0) {
            newErrors.permission_ids = 'Phải chọn ít nhất một quyền';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm() || !role) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient({
                url: `/api/v1/roles/${role.id}`,
                method: 'PUT',
                body: formData,
            });

            if (response.status === 200) {
                if (onRoleUpdated) {
                    onRoleUpdated();
                }
                handleClose();
            } else {
                setError(response.message || 'Có lỗi xảy ra khi cập nhật vai trò.');
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
                name: '',
                description: '',
                permission_ids: []
            });
            setSelectedPermissions([]);
            setExpandedCategories(new Set());
            setCategories([]);
            setPermissionsByCategory({});
            setAllPermissions([]);
            setErrors({});
            setError(null);
            onClose();
        }
    };

    const handleInputChange = (field: keyof RoleUpdateRequest) => (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const value = event.target.value;
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleCategoryToggle = (category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    const handleCategorySelectAll = (category: string) => {
        const categoryPermissions = permissionsByCategory[category] || [];
        const categoryPermissionIds = categoryPermissions.map(p => p.id);
        const selectedCategoryIds = formData.permission_ids.filter(id =>
            categoryPermissionIds.includes(id)
        );

        const isAllSelected = selectedCategoryIds.length === categoryPermissions.length;

        if (isAllSelected) {
            // Deselect all permissions in this category
            setFormData(prev => ({
                ...prev,
                permission_ids: prev.permission_ids.filter(id => !categoryPermissionIds.includes(id))
            }));
            setSelectedPermissions(prev =>
                prev.filter(p => !categoryPermissionIds.includes(p.id))
            );
        } else {
            // Select all permissions in this category
            const newPermissionIds = Array.from(new Set([...formData.permission_ids, ...categoryPermissionIds]));
            const newSelectedPermissions = [...selectedPermissions];

            categoryPermissions.forEach(permission => {
                if (!selectedPermissions.find(p => p.id === permission.id)) {
                    newSelectedPermissions.push(permission);
                }
            });

            setFormData(prev => ({
                ...prev,
                permission_ids: newPermissionIds
            }));
            setSelectedPermissions(newSelectedPermissions);
        }

        // Clear permission error when user selects permissions
        if (errors.permission_ids) {
            setErrors(prev => ({ ...prev, permission_ids: undefined }));
        }
    };

    const handlePermissionToggle = (permission: PermissionPublic) => {
        const isSelected = formData.permission_ids.includes(permission.id);

        if (isSelected) {
            // Remove permission
            setFormData(prev => ({
                ...prev,
                permission_ids: prev.permission_ids.filter(id => id !== permission.id)
            }));
            setSelectedPermissions(prev => prev.filter(p => p.id !== permission.id));
        } else {
            // Add permission
            setFormData(prev => ({
                ...prev,
                permission_ids: [...prev.permission_ids, permission.id]
            }));
            setSelectedPermissions(prev => [...prev, permission]);
        }

        // Clear permission error when user selects permissions
        if (errors.permission_ids) {
            setErrors(prev => ({ ...prev, permission_ids: undefined }));
        }
    };

    const isCategorySelected = (category: string): boolean => {
        const categoryPermissions = permissionsByCategory[category] || [];
        return categoryPermissions.some(permission =>
            formData.permission_ids.includes(permission.id)
        );
    };

    const getCategorySelectedCount = (category: string): number => {
        const categoryPermissions = permissionsByCategory[category] || [];
        return categoryPermissions.filter(permission =>
            formData.permission_ids.includes(permission.id)
        ).length;
    };

    const isCategoryFullySelected = (category: string): boolean => {
        const categoryPermissions = permissionsByCategory[category] || [];
        if (categoryPermissions.length === 0) return false;
        return categoryPermissions.every(permission =>
            formData.permission_ids.includes(permission.id)
        );
    };

    if (!role) return null; return (
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
                    Chỉnh sửa Vai trò
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
                        {/* Row 1: Role Name and Description */}
                        <TextField
                            label="Tên vai trò *"
                            placeholder="Ví dụ: Admin, Manager, User"
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

                        <TextField
                            label="Mô tả"
                            placeholder="Ví dụ: Người quản trị hệ thống"
                            value={formData.description}
                            onChange={handleInputChange('description')}
                            error={!!errors.description}
                            helperText={errors.description}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DescriptionIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            disabled={loading}
                            fullWidth
                        />

                        {/* Row 2: Permissions Selection - Full Width */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <FormControl error={!!errors.permission_ids} fullWidth>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <PermissionIcon fontSize="small" color="primary" />
                                    <Typography variant="h6" fontWeight="medium">
                                        Quyền hạn *
                                    </Typography>
                                    {loadingPermissions && <CircularProgress size={16} />}
                                </Box>

                                {loadingPermissions ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                                        <CircularProgress size={24} />
                                        <Typography variant="body2" sx={{ ml: 2 }}>
                                            Đang tải danh sách quyền...
                                        </Typography>
                                    </Box>
                                ) : categories.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                        Không có quyền nào khả dụng
                                    </Typography>
                                ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {categoryNames.map((category) => {
                                            const categoryPermissions = permissionsByCategory[category] || [];
                                            const isExpanded = expandedCategories.has(category);
                                            const selectedCount = getCategorySelectedCount(category);
                                            const totalCount = categoryPermissions.length;

                                            // Skip categories with no permissions
                                            if (totalCount === 0) {
                                                return null;
                                            }

                                            return (
                                                <Box key={category} sx={{
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 2,
                                                    overflow: 'hidden'
                                                }}>
                                                    {/* Category Header */}
                                                    <Box
                                                        sx={{
                                                            px: 1.5,
                                                            py: 1,
                                                            bgcolor: 'background.default',
                                                            borderBottom: isExpanded ? '1px solid' : 'none',
                                                            borderColor: 'divider',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between'
                                                        }}
                                                    >
                                                        {/* Left side: Category name and count - clickable for expand/collapse */}
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1,
                                                                cursor: 'pointer',
                                                                flex: 1,
                                                                '&:hover': {
                                                                    '& .category-title': {
                                                                        color: 'primary.main'
                                                                    }
                                                                }
                                                            }}
                                                            onClick={() => handleCategoryToggle(category)}
                                                        >
                                                            <Typography
                                                                className="category-title"
                                                                variant="body1"
                                                                fontWeight="500"
                                                                sx={{ transition: 'color 0.2s' }}
                                                            >
                                                                {category}
                                                            </Typography>
                                                            <Chip
                                                                label={`${selectedCount}/${totalCount}`}
                                                                size="small"
                                                                color={selectedCount > 0 ? "primary" : "default"}
                                                                variant={selectedCount > 0 ? "filled" : "outlined"}
                                                            />
                                                        </Box>

                                                        {/* Right side: Select All button and Expand button */}
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCategorySelectAll(category);
                                                                }}
                                                                title={isCategoryFullySelected(category) ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                                                sx={{
                                                                    px: 1.5,
                                                                    py: 0.5,
                                                                    borderRadius: '12px',
                                                                    '&:hover': {
                                                                        bgcolor: 'action.hover'
                                                                    }
                                                                }}
                                                            >
                                                                {isCategoryFullySelected(category) ?
                                                                    <ToggleOnIcon fontSize="large" sx={{ color: 'primary.main' }} /> :
                                                                    <ToggleOffIcon fontSize="large" sx={{ color: 'text.disabled' }} />
                                                                }
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleCategoryToggle(category)}
                                                                sx={{
                                                                    '&:hover': {
                                                                        bgcolor: 'action.hover'
                                                                    }
                                                                }}
                                                            >
                                                                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                            </IconButton>
                                                        </Box>
                                                    </Box>

                                                    {/* Category Permissions */}
                                                    <Collapse in={isExpanded}>
                                                        <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                                                            {categoryPermissions.map((permission) => {
                                                                const isSelected = formData.permission_ids.includes(permission.id);

                                                                return (
                                                                    <ModernSwitchButton
                                                                        key={permission.id}
                                                                        checked={isSelected}
                                                                        onChange={() => handlePermissionToggle(permission)} label={permission.name}
                                                                        description={permission.description || permission.name}
                                                                        disabled={loading}
                                                                        variant="unified"
                                                                        size="small"
                                                                        showIcon={false}
                                                                        fullWidth={false}
                                                                        backgroundColor="subtle"
                                                                        borderStyle="prominent"
                                                                        borderRadius={1}
                                                                    />
                                                                );
                                                            })}
                                                        </Box>
                                                    </Collapse>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                )}

                                {/* Selected permissions summary */}
                                {formData.permission_ids.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Đã chọn {formData.permission_ids.length} quyền:
                                        </Typography>                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                            {selectedPermissions.map((permission) => (
                                                <Chip
                                                    key={permission.id}
                                                    label={permission.name || 'Unknown'}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                )}

                                {errors.permission_ids && (
                                    <FormHelperText sx={{ mt: 1 }}>{errors.permission_ids}</FormHelperText>
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
                            ✏️ Chỉnh sửa vai trò:
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Tên vai trò phải là duy nhất và mô tả ý nghĩa của vai trò
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Các quyền đã có sẽ được tự động chọn khi mở modal
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Thay đổi quyền hạn sẽ ảnh hưởng đến tất cả người dùng có vai trò này
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: componentColors.modal.noteText
                            }}
                        >
                            • Vai trò được bảo vệ (admin, user, broker) không thể xóa
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
                    disabled={loading || loadingPermissions}
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
                        {loading ? 'Đang cập nhật...' : 'Cập nhật Vai trò'}
                    </Box>
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditRoleModal;
