'use client';

import React, { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    IconButton,
    InputAdornment,
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Lock,
    LockReset,
    Security,
} from '@mui/icons-material';
import { apiClient } from '../../../../services/apiClient';

interface ChangePasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export default function ChangePasswordPage() {
    const [formData, setFormData] = useState<ChangePasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const handleInputChange = (field: keyof ChangePasswordFormData) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: event.target.value,
        }));
        // Clear field error when user starts typing
        if (fieldErrors[field]) {
            setFieldErrors(prev => ({
                ...prev,
                [field]: '',
            }));
        }
        // Clear general message when user starts typing
        if (message) {
            setMessage(null);
        }
    };

    const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field],
        }));
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.currentPassword) {
            errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
        }

        if (!formData.newPassword) {
            errors.newPassword = 'Vui lòng nhập mật khẩu mới';
        } else if (formData.newPassword.length < 8) {
            errors.newPassword = 'Mật khẩu mới phải có ít nhất 8 ký tự';
        }

        if (!formData.confirmPassword) {
            errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
        } else if (formData.newPassword !== formData.confirmPassword) {
            errors.confirmPassword = 'Mật khẩu xác nhận không khớp với mật khẩu mới';
        }

        if (formData.currentPassword && formData.newPassword && formData.currentPassword === formData.newPassword) {
            errors.newPassword = 'Mật khẩu mới không được trùng với mật khẩu hiện tại';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await apiClient({
                url: '/api/v1/auth/me/change-password',
                method: 'POST',
                body: {
                    current_password: formData.currentPassword,
                    new_password: formData.newPassword,
                },
            });

            // API call successful
            setMessage({
                type: 'success',
                text: response.message || 'Đổi mật khẩu thành công!',
            });
            // Reset form on success
            setFormData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error: any) {
            console.error('Change password error:', error);
            setMessage({
                type: 'error',
                text: error?.message || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại sau.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 600, width: '100%', color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
                        Đổi mật khẩu
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Thay đổi mật khẩu để bảo vệ tài khoản
                    </Typography>
                </Box>
            </Box>

            {/* Update Message */}
            {message && (
                <Alert
                    severity={message.type}
                    sx={{ mb: 3 }}
                    onClose={() => setMessage(null)}
                >
                    {message.text}
                </Alert>
            )}

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
                <TextField
                    fullWidth
                    label="Mật khẩu hiện tại"
                    placeholder="Nhập mật khẩu hiện tại của bạn"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={formData.currentPassword}
                    onChange={handleInputChange('currentPassword')}
                    error={!!fieldErrors.currentPassword}
                    helperText={fieldErrors.currentPassword}
                    required
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Lock color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle password visibility"
                                    onClick={() => togglePasswordVisibility('current')}
                                    edge="end"
                                >
                                    {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'background.paper',
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main',
                            },
                        },
                    }}
                />

                <TextField
                    fullWidth
                    label="Mật khẩu mới"
                    placeholder="Nhập mật khẩu mới (ít nhất 8 ký tự)"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={handleInputChange('newPassword')}
                    error={!!fieldErrors.newPassword}
                    helperText={fieldErrors.newPassword}
                    required
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <LockReset color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle password visibility"
                                    onClick={() => togglePasswordVisibility('new')}
                                    edge="end"
                                >
                                    {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'background.paper',
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main',
                            },
                        },
                    }}
                />

                <TextField
                    fullWidth
                    label="Xác nhận mật khẩu mới"
                    placeholder="Nhập lại mật khẩu mới để xác nhận"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange('confirmPassword')}
                    error={!!fieldErrors.confirmPassword}
                    helperText={fieldErrors.confirmPassword}
                    required
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Security color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle password visibility"
                                    onClick={() => togglePasswordVisibility('confirm')}
                                    edge="end"
                                >
                                    {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'background.paper',
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main',
                            },
                        },
                    }}
                />

                <Button
                    type="submit"
                    variant="contained"
                    size="medium"
                    disabled={loading}
                    sx={{
                        px: 3,
                        py: 1.5,
                        borderRadius: 2,
                        fontWeight: 'bold',
                        textTransform: 'none',
                        boxShadow: 2,
                        '&:hover': {
                            boxShadow: 4,
                        }
                    }}
                >
                    {loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            Đang xử lý...
                        </Box>
                    ) : (
                        'Đổi mật khẩu'
                    )}
                </Button>
            </Box>
        </Box>
    );
}