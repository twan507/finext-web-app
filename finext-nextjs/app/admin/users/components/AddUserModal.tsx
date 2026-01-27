// finext-nextjs/app/admin/users/components/AddUserModal.tsx
'use client';

import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Chip,
    FormHelperText, InputAdornment, IconButton,
    Typography, useTheme
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
import { borderRadiusTop } from 'theme/tokens';
interface RolePublic {
    id: string;
    name: string;
    description?: string;
}

interface UserCreate {
    full_name: string;
    email: string;
    phone_number?: string;
    password: string;
    referral_code?: string;
}

interface AddUserModalProps {
    open: boolean;
    onClose: () => void;
    onUserAdded: () => void;
    roles: RolePublic[];
}

const AddUserModal: React.FC<AddUserModalProps> = ({
    open,
    onClose,
    onUserAdded,
    roles
}) => {
    const theme = useTheme();
    const [formData, setFormData] = useState<UserCreate>({
        full_name: '',
        email: '',
        phone_number: '',
        password: '',
        referral_code: ''
    }); const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState(''); const handleInputChange = (field: keyof UserCreate) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = event.target.value;
        setFormData(prev => ({
            ...prev,
            [field]: field === 'referral_code' ? value.toUpperCase() : value
        }));
    }; const validateForm = (): string | null => {
        if (!formData.full_name.trim()) {
            return 'Họ và tên là bắt buộc';
        }
        if (!formData.email.trim()) {
            return 'Email là bắt buộc';
        }
        if (!formData.password || formData.password.length < 8) {
            return 'Mật khẩu phải có ít nhất 8 ký tự';
        }
        if (formData.password !== confirmPassword) {
            return 'Mật khẩu xác nhận không khớp';
        }
        if (formData.phone_number && !/^[0-9+\-\s()]*$/.test(formData.phone_number)) {
            return 'Số điện thoại không hợp lệ';
        }
        // Validate referral_code format if provided
        if (formData.referral_code?.trim() && !/^[a-zA-Z0-9]{4}$/.test(formData.referral_code.trim())) {
            return 'Mã giới thiệu không hợp lệ. Phải là 4 ký tự chữ và số, hoặc để trống.';
        }
        return null;
    }; const handleSubmit = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        } setLoading(true);
        setError(null);

        try {
            // Validate referral_code via API if provided
            if (formData.referral_code?.trim()) {
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

            // Chuẩn bị data để gửi - loại bỏ các field trống
            const submitData: any = {
                full_name: formData.full_name.trim(),
                email: formData.email.trim(),
                password: formData.password
            };

            if (formData.phone_number?.trim()) {
                submitData.phone_number = formData.phone_number.trim();
            }
            if (formData.referral_code?.trim()) {
                submitData.referral_code = formData.referral_code.trim();
            } const response = await apiClient({
                url: '/api/v1/users/',
                method: 'POST',
                body: submitData
            }); if (response.status === 201) {
                // Reset form
                setFormData({
                    full_name: '',
                    email: '',
                    phone_number: '',
                    password: '',
                    referral_code: ''
                });
                setConfirmPassword('');
                onUserAdded(); // Refresh the users list
                onClose(); // Close modal
            } else {
                setError(response.message || 'Đã xảy ra lỗi khi tạo người dùng');
            }
        } catch (err: any) {
            console.error('Error creating user:', err);
            setError(err.message || 'Đã xảy ra lỗi khi tạo người dùng');
        } finally {
            setLoading(false);
        }
    }; const handleClose = () => {
        if (!loading) {
            // Reset form when closing
            setFormData({
                full_name: '',
                email: '',
                phone_number: '',
                password: '',
                referral_code: ''
            });
            setConfirmPassword('');
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
                <Typography variant="h5" component="div" fontWeight="bold">
                    Thêm Người Dùng Mới
                </Typography>
            </DialogTitle>      <DialogContent>
                <Box
                    component="form"
                    autoComplete="off"
                    sx={{ mt: 2 }}
                >
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}          <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 3
                    }}>
                        {/* Họ và tên */}
                        <TextField
                            fullWidth
                            label="Họ và tên *"
                            value={formData.full_name}
                            onChange={handleInputChange('full_name')}
                            disabled={loading}
                            placeholder="Nhập họ và tên đầy đủ"
                            variant="outlined"
                        />            {/* Email */}
                        <TextField
                            fullWidth
                            label="Email *"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange('email')}
                            disabled={loading}
                            placeholder="user@example.com"
                            variant="outlined"
                            autoComplete="new-email"
                            inputProps={{
                                autoComplete: 'new-email'
                            }}
                        />

                        {/* Số điện thoại */}
                        <TextField
                            fullWidth
                            label="Số điện thoại"
                            value={formData.phone_number}
                            onChange={handleInputChange('phone_number')}
                            disabled={loading}
                            placeholder="0912345678"
                            variant="outlined"
                        />
                        {/* Mật khẩu */}
                        <TextField
                            fullWidth
                            label="Mật khẩu *"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={handleInputChange('password')}
                            disabled={loading}
                            placeholder="Tối thiểu 8 ký tự"
                            variant="outlined"
                            autoComplete="new-password"
                            inputProps={{
                                autoComplete: 'new-password'
                            }} InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                            disabled={loading}
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* Xác nhận mật khẩu */}
                        <TextField
                            fullWidth
                            label="Xác nhận mật khẩu *"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            placeholder="Nhập lại mật khẩu"
                            variant="outlined"
                            autoComplete="new-password"
                            error={confirmPassword !== '' && formData.password !== confirmPassword}
                            helperText={
                                confirmPassword !== '' && formData.password !== confirmPassword
                                    ? "Mật khẩu xác nhận không khớp"
                                    : "Nhập lại mật khẩu để xác nhận"
                            }
                            inputProps={{
                                autoComplete: 'new-password'
                            }}
                        />

                        {/* Mã giới thiệu */}
                        <TextField
                            fullWidth
                            label="Mã giới thiệu"
                            value={formData.referral_code}
                            onChange={handleInputChange('referral_code')}
                            disabled={loading}
                            placeholder="Ví dụ: AB12"
                            variant="outlined"
                            helperText="Tùy chọn - mã 4 ký tự từ đối tác (sẽ được kiểm tra tính hợp lệ)"
                            inputProps={{
                                maxLength: 4,
                                style: { textTransform: 'uppercase' }
                            }}
                        />
                    </Box>                    <Box sx={{
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
                    }}>                        <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            color: 'info.main'
                        }}
                    >
                            💡 Lưu ý:
                        </Typography>                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1,
                                color: theme.palette.component.modal.noteText
                            }}
                        >                            • Người dùng mới sẽ được gán vai trò "user" mặc định
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >                            • Tài khoản sẽ được kích hoạt ngay lập tức
                        </Typography>                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Người dùng có thể đăng nhập ngay bằng email và mật khẩu
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>            <DialogActions sx={{ p: 3, pt: 1 }}>
                <Button
                    onClick={handleClose}
                    disabled={loading}
                    variant="outlined"
                >
                    Hủy
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    variant="contained"
                    startIcon={loading && <CircularProgress size={20} />}
                >
                    {loading ? 'Đang tạo...' : 'Tạo Người Dùng'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddUserModal;
