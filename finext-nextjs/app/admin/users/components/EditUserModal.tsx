// finext-nextjs/app/admin/users/components/EditUserModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Divider, Chip, Stack,
    IconButton, Tooltip
} from '@mui/material';
import {
    PersonOff as DeactivateIcon,
    PersonAdd as ActivateIcon,
    BusinessCenter as BrokerIcon,
    RemoveCircleOutline as RemoveBrokerIcon,
    LockReset as LockResetIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { borderRadiusTop } from 'theme/tokens';
interface UserPublic {
    id: string;
    role_ids: string[];
    full_name: string;
    email: string;
    phone_number?: string | null;
    is_active?: boolean;
    created_at: string;
    updated_at: string;
    avatar_url?: string | null;
    referral_code?: string | null;
    google_id?: string | null;
    subscription_id?: string | null;
}

interface RolePublic {
    id: string;
    name: string;
    description?: string;
}

interface EditUserModalProps {
    open: boolean;
    user: UserPublic | null;
    roles: RolePublic[];
    protectedEmails: string[];
    onClose: () => void;
    onUserUpdated: () => void;
}

interface ConfirmAction {
    type: 'activate' | 'deactivate' | 'grant_broker' | 'remove_broker';
    title: string;
    message: string;
    confirmText: string;
    variant: 'contained' | 'outlined';
    color: 'primary' | 'error' | 'warning' | 'success';
}

const EditUserModal: React.FC<EditUserModalProps> = ({
    open,
    user,
    roles,
    protectedEmails,
    onClose,
    onUserUpdated
}) => {
    const theme = useTheme();


    const [formData, setFormData] = useState({
        full_name: '',
        phone_number: '',
        referral_code: '' // Added referral_code
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null); const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null); const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [localUser, setLocalUser] = useState<UserPublic | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);

    // Reset form khi user thay đổi
    useEffect(() => {
        if (user) {
            setLocalUser(user);
            setFormData({
                full_name: user.full_name || '',
                phone_number: user.phone_number || '',
                referral_code: user.referral_code || '' // Initialize referral_code
            });
            setError(null);
            setSuccess(null);
        }
    }, [user]);

    const handleInputChange = (field: keyof typeof formData) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: event.target.value
        }));
    };

    const validateForm = (): string | null => {
        if (!formData.full_name.trim()) {
            return 'Họ và tên là bắt buộc';
        }
        if (formData.phone_number && !/^[0-9+\-\s()]*$/.test(formData.phone_number)) {
            return 'Số điện thoại không hợp lệ';
        }
        // Added referral_code validation
        if (formData.referral_code.trim() !== '' && !/^[a-zA-Z0-9]{4}$/.test(formData.referral_code.trim())) {
            return 'Mã giới thiệu không hợp lệ. Phải là 4 ký tự chữ và số, hoặc để trống.';
        }
        return null;
    };

    // Cập nhật thông tin cơ bản
    const handleUpdateBasicInfo = async () => {
        if (!user || !localUser) return; // Added localUser check for isAdmin/isBroker

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Validate referral_code via API if user is not admin/broker and code is entered
            if (!isAdmin && !isBroker && formData.referral_code.trim() !== '') {
                const brokerCodeToValidate = formData.referral_code.trim().toUpperCase();
                try {
                    const validationResponse = await apiClient({
                        url: `/api/v1/brokers/validate/${brokerCodeToValidate}`,
                        method: 'GET'
                    });
                    // Assuming response.data contains { is_valid: boolean, ... }
                    if (!validationResponse.data?.is_valid) {
                        setError('Mã giới thiệu không hợp lệ hoặc không (còn) hoạt động. Vui lòng kiểm tra lại hoặc để trống.');
                        setLoading(false);
                        return;
                    }
                } catch (validationErr: any) {
                    console.error('Error validating broker code:', validationErr);
                    setError(validationErr.message || 'Lỗi khi kiểm tra mã giới thiệu. Vui lòng thử lại.');
                    setLoading(false);
                    return;
                }
            }

            const updateData: any = {
                full_name: formData.full_name.trim()
            };

            if (formData.phone_number?.trim()) {
                updateData.phone_number = formData.phone_number.trim();
            }

            // Add referral_code to update payload
            if (formData.referral_code.trim() === '') {
                updateData.referral_code = null;
            } else {
                // Broker codes are typically uppercase, and validation ensures 4 chars if not empty
                updateData.referral_code = formData.referral_code.trim().toUpperCase();
            }

            const response = await apiClient({
                url: `/api/v1/users/${user.id}`,
                method: 'PUT',
                body: updateData
            });
            if (response.status === 200) {
                setSuccess('Cập nhật thông tin thành công');
                // Update localUser state with the new form data
                if (localUser) {
                    setLocalUser(prevUser => ({
                        ...prevUser!,
                        full_name: formData.full_name.trim(),
                        phone_number: formData.phone_number.trim() || null,
                        referral_code: updateData.referral_code // Use the processed value
                    }));
                }
                onUserUpdated();
            } else {
                setError(response.message || 'Đã xảy ra lỗi khi cập nhật');
            }
        } catch (err: any) {
            console.error('Error updating user:', err);
            setError(err.message || 'Đã xảy ra lỗi khi cập nhật');
        } finally {
            setLoading(false);
        }
    };    // Xử lý các hành động đặc biệt
    const handleSpecialAction = async (actionType: string) => {
        if (!user || !localUser) return;

        // For password reset, we don't need confirmAction
        if (actionType !== 'reset_password' && !confirmAction) return;

        setActionLoading(actionType);
        setError(null);
        setSuccess(null);

        try {
            let response;
            let successMessage = '';

            switch (actionType) {
                case 'activate':
                    response = await apiClient({
                        url: `/api/v1/users/${localUser.id}`,
                        method: 'PUT',
                        body: { is_active: true }
                    });
                    successMessage = 'Kích hoạt tài khoản thành công';
                    break;

                case 'deactivate':
                    response = await apiClient({
                        url: `/api/v1/users/${localUser.id}`,
                        method: 'PUT',
                        body: { is_active: false }
                    });
                    successMessage = 'Vô hiệu hóa tài khoản thành công';
                    break; case 'grant_broker':
                    response = await apiClient({
                        url: `/api/v1/brokers/`,
                        method: 'POST',
                        body: { user_id: localUser.id }
                    });
                    successMessage = 'Cấp quyền broker thành công.';
                    break; case 'remove_broker':
                    // Use referral_code as broker_code to call delete broker API
                    const brokerCode = localUser.referral_code;

                    if (!brokerCode) {
                        throw new Error('Người dùng không có mã broker để xóa');
                    }

                    response = await apiClient({
                        url: `/api/v1/brokers/${brokerCode}`,
                        method: 'DELETE'
                    });
                    successMessage = 'Xóa quyền broker thành công.';
                    break; case 'reset_password':
                    console.log('Reset password case reached');
                    console.log('newPassword:', newPassword);
                    console.log('confirmPassword:', confirmPassword);

                    if (!newPassword || newPassword.length < 8) {
                        throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự');
                    }

                    if (newPassword !== confirmPassword) {
                        throw new Error('Mật khẩu xác nhận không khớp với mật khẩu mới');
                    }

                    console.log('About to call API...');
                    response = await apiClient({
                        url: `/api/v1/users/${localUser.id}/change-password`,
                        method: 'PUT',
                        body: { new_password: newPassword }
                    });
                    console.log('API response:', response);
                    successMessage = 'Đặt lại mật khẩu thành công.';
                    setNewPassword(''); // Clear password after success
                    setConfirmPassword(''); // Clear confirm password after success
                    setShowPasswordDialog(false);
                    break;

                default:
                    throw new Error('Hành động không hợp lệ');
            }            if (response.status >= 200 && response.status < 300) {
                setSuccess(successMessage);                // Cập nhật localUser state cho các actions
                if (localUser) {
                    let updatedUser = { ...localUser };

                    switch (actionType) {
                        case 'activate':
                            updatedUser.is_active = true;
                            break;
                        case 'deactivate':
                            updatedUser.is_active = false;
                            break; case 'grant_broker':
                            // Add broker role if not already present
                            const brokerRoleId = roles.find(r => r.name.toLowerCase() === 'broker')?.id;
                            if (brokerRoleId && !updatedUser.role_ids.includes(brokerRoleId)) {
                                updatedUser.role_ids = [...updatedUser.role_ids, brokerRoleId];
                            }
                            // Use the broker_code from the API response (response.data is BrokerPublic)
                            const newBrokerCode = response.data?.broker_code;
                            if (newBrokerCode) {
                                updatedUser.referral_code = newBrokerCode;
                                // Also update formData to keep UI consistent
                                setFormData(prev => ({ ...prev, referral_code: newBrokerCode }));
                            }
                            break; case 'remove_broker':
                            // Remove broker role
                            const brokerRoleIdToRemove = roles.find(r => r.name.toLowerCase() === 'broker')?.id;
                            if (brokerRoleIdToRemove) {
                                updatedUser.role_ids = updatedUser.role_ids.filter(id => id !== brokerRoleIdToRemove);
                            }
                            // Clear referral_code as backend does this for the broker user
                            updatedUser.referral_code = null;
                            // Also update formData
                            setFormData(prev => ({ ...prev, referral_code: '' }));
                            break;
                    }

                    setLocalUser(updatedUser);
                }

                onUserUpdated();
            } else {
                setError(response.message || 'Đã xảy ra lỗi');
            }
        } catch (err: any) {
            console.error(`Error ${actionType}:`, err);
            setError(err.message || 'Đã xảy ra lỗi');
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
        }
    }; const openConfirmAction = (action: ConfirmAction) => {
        setConfirmAction(action);
    };

    const closeConfirmAction = () => {
        setConfirmAction(null);
    }; const openPasswordResetDialog = () => {
        setShowPasswordDialog(true);
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        setSuccess(null);
    };

    const closePasswordResetDialog = () => {
        setShowPasswordDialog(false);
        setNewPassword('');
        setConfirmPassword('');
    }; const handleClose = () => {
        if (!loading && !actionLoading) {
            setError(null);
            setSuccess(null);
            setConfirmAction(null);
            setShowPasswordDialog(false);
            setNewPassword('');
            setConfirmPassword('');
            onClose();
        }
    };// Helper functions
    const getRoleNames = (roleIds: string[]): string[] => {
        return roleIds.map(roleId => {
            const role = roles.find(r => r.id === roleId);
            return role ? role.name : roleId;
        });
    }; const isBroker = localUser?.role_ids?.some(roleId => {
        const role = roles.find(r => r.id === roleId);
        return role?.name?.toLowerCase().includes('broker');
    });    // Check if user is protected
    const isProtectedUser = Boolean(localUser?.email && protectedEmails.includes(localUser.email));

    const isAdmin = localUser?.role_ids?.some(roleId => {
        const role = roles.find(r => r.id === roleId);
        return role?.name?.toLowerCase().includes('admin');
    });

    if (!user || !localUser) return null;

    return (
        <>
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
                    <Typography variant="h5" component="div" fontWeight="bold">
                        Chỉnh sửa người dùng
                    </Typography>                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {localUser.email}
                    </Typography>
                </DialogTitle>

                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert severity="success" sx={{ mb: 3 }}>
                                {success}
                            </Alert>
                        )}

                        {/* Thông tin cơ bản */}
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                            Thông tin cơ bản
                        </Typography>

                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            gap: 3,
                            mb: 3
                        }}>
                            {/* Email - chỉ hiển thị */}
                            <TextField
                                fullWidth
                                label="Email"
                                value={localUser.email}
                                disabled
                                variant="outlined"
                                helperText="Không thể chỉnh sửa"
                            />
                            {/* Họ và tên - có thể chỉnh sửa */}
                            <TextField
                                fullWidth
                                label="Họ và tên *"
                                value={formData.full_name}
                                onChange={handleInputChange('full_name')}
                                disabled={loading}
                                variant="outlined"
                            />

                            {/* Mã referral_code - có thể chỉnh sửa */}
                            <TextField
                                fullWidth
                                label="Mã giới thiệu" // Changed label
                                value={formData.referral_code} // Bind to formData
                                onChange={handleInputChange('referral_code')} // Enable input change
                                disabled={loading || Boolean(actionLoading) || isAdmin || isBroker} // Updated disabled logic
                                variant="outlined"
                                helperText="4 ký tự in hoa. Để trống nếu không có." // Updated helper text
                            />

                            {/* Số điện thoại - có thể chỉnh sửa */}
                            <TextField
                                fullWidth
                                label="Số điện thoại"
                                value={formData.phone_number}
                                onChange={handleInputChange('phone_number')}
                                disabled={loading}
                                variant="outlined"
                            />

                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'flex-end' }}>
                            <Button
                                onClick={handleUpdateBasicInfo}
                                disabled={loading || Boolean(actionLoading)}
                                variant="contained"
                                startIcon={loading && <CircularProgress size={20} />}
                            >
                                {loading ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
                            </Button>
                        </Box>

                        <Divider sx={{ my: 3 }} />

                        {/* Thông tin trạng thái */}
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                            Trạng thái tài khoản
                        </Typography>                        <Box sx={{ mb: 3 }}>                            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                            <Chip
                                label={localUser.is_active ? 'Hoạt động' : 'Không hoạt động'}
                                color={localUser.is_active ? 'success' : 'default'}
                                size="small"
                            />                            <Chip
                                label={localUser.google_id ? 'Đăng nhập Google' : 'Đăng nhập Email'}
                                color={localUser.google_id ? 'info' : 'default'}
                                size="small"
                                variant="outlined"
                            />
                            {getRoleNames(localUser.role_ids).map((roleName, index) => (
                                <Chip
                                    key={index}
                                    label={roleName}
                                    size="small"
                                    variant="outlined"
                                    color={
                                        roleName.toLowerCase().includes('admin') ? 'error' :
                                            roleName.toLowerCase().includes('broker') ? 'warning' : 'primary'
                                    }
                                />
                            ))}
                            {isProtectedUser && (
                                <Chip
                                    label="🔒 Tài khoản bảo vệ"
                                    size="small"
                                    color="error"
                                    variant="filled"
                                />
                            )}
                        </Stack>
                        </Box>

                        <Divider sx={{ my: 3 }} />                        {/* Các hành động đặc biệt */}
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                            Hành động đặc biệt
                        </Typography>                        <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 2,
                            justifyContent: 'stretch',
                            '& .MuiButton-root': {
                                flex: 1
                            }
                        }}>                            {/* Activate/Deactivate */}
                            <Button
                                variant="outlined"
                                color={localUser.is_active ? 'error' : 'success'}
                                startIcon={
                                    actionLoading === (localUser.is_active ? 'deactivate' : 'activate') ?
                                        <CircularProgress size={20} /> :
                                        (localUser.is_active ? <DeactivateIcon /> : <ActivateIcon />)
                                } disabled={Boolean(actionLoading) || isProtectedUser}
                                onClick={() => openConfirmAction({
                                    type: localUser.is_active ? 'deactivate' : 'activate',
                                    title: localUser.is_active ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản',
                                    message: localUser.is_active ?
                                        'Bạn có chắc muốn vô hiệu hóa tài khoản này? Người dùng sẽ không thể đăng nhập.' :
                                        'Bạn có chắc muốn kích hoạt tài khoản này? Người dùng sẽ có thể đăng nhập.',
                                    confirmText: localUser.is_active ? 'Vô hiệu hóa' : 'Kích hoạt',
                                    variant: 'contained',
                                    color: localUser.is_active ? 'error' : 'success'
                                })}
                            >
                                {localUser.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                            </Button>

                            {/* Grant/Remove Broker */}
                            <Button
                                variant="outlined"
                                color={isBroker ? 'error' : 'warning'}
                                startIcon={
                                    actionLoading === (isBroker ? 'remove_broker' : 'grant_broker') ?
                                        <CircularProgress size={20} /> :
                                        (isBroker ? <RemoveBrokerIcon /> : <BrokerIcon />)
                                } disabled={Boolean(actionLoading) || isProtectedUser}
                                onClick={() => openConfirmAction({
                                    type: isBroker ? 'remove_broker' : 'grant_broker',
                                    title: isBroker ? 'Xóa quyền Broker' : 'Cấp quyền Broker',
                                    message: isBroker ?
                                        'Bạn có chắc muốn xóa quyền broker? Tất cả subscription sẽ được chuyển về Basic.' :
                                        'Bạn có chắc muốn cấp quyền broker cho người dùng này?',
                                    confirmText: isBroker ? 'Xóa quyền' : 'Cấp quyền',
                                    variant: 'contained',
                                    color: isBroker ? 'error' : 'warning'
                                })}
                            >
                                {isBroker ? 'Xóa quyền Broker' : 'Cấp quyền Broker'}
                            </Button>                            {/* Reset Password */}
                            <Button
                                variant="outlined"
                                color="info"
                                startIcon={
                                    actionLoading === 'reset_password' ?
                                        <CircularProgress size={20} /> :
                                        <LockResetIcon />
                                }
                                disabled={Boolean(actionLoading) || !localUser?.is_active}
                                onClick={openPasswordResetDialog}
                            >
                                Đặt lại mật khẩu
                            </Button>
                        </Box>

                        {/* Ghi chú */}
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
                                borderRadius: borderRadiusTop('sm')
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
                                ⚠️ Lưu ý quan trọng:
                            </Typography>                            <Typography variant="body2" sx={{ mt: 1, color: theme.palette.component.modal.noteText }}>
                                • Các hành động đặc biệt không thể hoàn tác
                            </Typography>
                            <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                • Xóa quyền broker sẽ tự động chuyển subscription về Basic
                            </Typography>
                            <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                • Đặt lại mật khẩu sẽ thay đổi mật khẩu người dùng ngay lập tức
                            </Typography>
                            <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                • Người dùng có thể tự reset mật khẩu qua tính năng "Quên mật khẩu"
                            </Typography>
                            {isAdmin && (
                                <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                                    • Tài khoản Admin không thể bị vô hiệu hóa hoặc thay đổi quyền
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        onClick={handleClose}
                        disabled={loading || Boolean(actionLoading)}
                        variant="outlined"
                    >
                        Đóng
                    </Button>
                </DialogActions>            </Dialog>            {/* Password Reset Dialog */}
            <Dialog
                open={showPasswordDialog}
                onClose={closePasswordResetDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Đặt lại mật khẩu cho {localUser?.full_name}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                        Nhập mật khẩu mới cho người dùng <strong>{localUser?.email}</strong>
                    </Typography>                    <TextField
                        fullWidth
                        label="Mật khẩu mới"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={Boolean(actionLoading)}
                        variant="outlined"
                        sx={{ mt: 2 }}
                        helperText="Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt"
                        autoComplete="new-password"
                        inputProps={{
                            minLength: 8,
                            pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
                            autoComplete: 'new-password'
                        }}
                    />                    <TextField
                        fullWidth
                        label="Xác nhận mật khẩu mới"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={Boolean(actionLoading)}
                        variant="outlined"
                        sx={{ mt: 2 }}
                        error={confirmPassword !== '' && newPassword !== confirmPassword}
                        helperText={
                            confirmPassword !== '' && newPassword !== confirmPassword
                                ? "Mật khẩu xác nhận không khớp"
                                : "Nhập lại mật khẩu mới để xác nhận"
                        }
                        autoComplete="new-password"
                        inputProps={{
                            minLength: 8,
                            autoComplete: 'new-password'
                        }}
                    />

                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={closePasswordResetDialog}
                        disabled={Boolean(actionLoading)}
                    >
                        Hủy
                    </Button>                    <Button
                        onClick={() => handleSpecialAction('reset_password')}
                        variant="contained"
                        color="info"
                        disabled={
                            Boolean(actionLoading) ||
                            !newPassword ||
                            newPassword.length < 8 ||
                            !confirmPassword ||
                            newPassword !== confirmPassword
                        }
                        startIcon={actionLoading === 'reset_password' && <CircularProgress size={20} />}
                    >
                        {actionLoading === 'reset_password' ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Dialog */}
            <Dialog
                open={Boolean(confirmAction)}
                onClose={closeConfirmAction}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {confirmAction?.title}
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        {confirmAction?.message}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeConfirmAction} disabled={Boolean(actionLoading)}>
                        Hủy
                    </Button>
                    <Button
                        onClick={() => handleSpecialAction(confirmAction?.type || '')}
                        variant={confirmAction?.variant || 'contained'}
                        color={confirmAction?.color || 'primary'}
                        disabled={Boolean(actionLoading)}
                        startIcon={actionLoading && <CircularProgress size={20} />}
                    >
                        {actionLoading ? 'Đang xử lý...' : confirmAction?.confirmText}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default EditUserModal;
