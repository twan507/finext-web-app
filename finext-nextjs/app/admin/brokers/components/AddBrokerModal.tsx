// finext-nextjs/app/admin/brokers/components/AddBrokerModal.tsx
'use client';

import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Box, Alert, CircularProgress,
    Typography, useTheme, Autocomplete
} from '@mui/material';
import {
    BusinessCenter as BrokerIcon
} from '@mui/icons-material';
import { apiClient } from 'services/apiClient';
interface UserPublic {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string | null;
    is_active?: boolean;
    role_ids: string[];
    referral_code?: string | null;
}

interface AddBrokerModalProps {
    open: boolean;
    onClose: () => void;
    onBrokerAdded: () => void;
    allUsers: UserPublic[];
}

const AddBrokerModal: React.FC<AddBrokerModalProps> = ({
    open,
    onClose,
    onBrokerAdded,
    allUsers
}) => {
    const theme = useTheme();
    

    const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter users that are not already brokers (don't have broker role)
    const availableUsers = React.useMemo(() => {
        return allUsers.filter(user => {
            // Check if user is active and doesn't already have a referral_code (indicating they're not a broker)
            return user.is_active && !user.referral_code;
        });
    }, [allUsers]);

    const validateForm = (): string | null => {
        if (!selectedUser) {
            return 'Vui lòng chọn một người dùng';
        }

        if (!selectedUser.is_active) {
            return 'Không thể cấp quyền broker cho tài khoản đã bị vô hiệu hóa';
        }

        if (selectedUser.referral_code) {
            return 'Người dùng này đã là broker';
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
            const response = await apiClient({
                url: '/api/v1/brokers/',
                method: 'POST',
                body: { user_id: selectedUser!.id }
            });

            if (response.status >= 200 && response.status < 300) {
                // Reset form
                setSelectedUser(null);
                onBrokerAdded(); // Refresh the brokers list
                onClose(); // Close modal
            } else {
                setError(response.message || 'Đã xảy ra lỗi khi cấp quyền broker');
            }
        } catch (err: any) {
            console.error('Error creating broker:', err);
            setError(err.message || 'Đã xảy ra lỗi khi cấp quyền broker');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            // Reset form when closing
            setSelectedUser(null);
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BrokerIcon color="primary" />
                    <Typography variant="h5" component="div" fontWeight="bold">
                        Cấp Quyền Broker
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Box
                    component="form"
                    autoComplete="off"
                    sx={{ mt: 2 }}
                >
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {/* User Selection */}
                    <Autocomplete
                        fullWidth
                        options={availableUsers}
                        getOptionLabel={(user) => `${user.full_name} (${user.email})`}
                        value={selectedUser}
                        onChange={(event, newValue) => {
                            setSelectedUser(newValue);
                            setError(null); // Clear error when selection changes
                        }}
                        disabled={loading}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Chọn người dùng *"
                                placeholder="Tìm kiếm theo tên hoặc email..."
                                variant="outlined"
                                helperText="Chỉ hiển thị những người dùng đang hoạt động và chưa có quyền broker"
                            />
                        )} renderOption={(props, user) => {
                            const { key, ...otherProps } = props;
                            return (
                                <Box component="li" key={key} {...otherProps}>
                                    <Box>
                                        <Typography variant="body1" fontWeight="medium">
                                            {user.full_name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {user.email}
                                            {user.phone_number && ` • ${user.phone_number}`}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        }}
                        noOptionsText="Không có người dùng phù hợp"
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                    />

                    {/* Selected User Details */}
                    {selectedUser && (
                        <Box sx={{
                            mt: 3,
                            p: 2,
                            bgcolor: theme.palette.mode === 'light' ? 'grey.50' : 'grey.900',
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.divider}`,
                        }}>
                            <Typography variant="subtitle2" fontWeight="bold" color="primary">
                                Thông tin người dùng được chọn:
                            </Typography>
                            <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
                                <Typography variant="body2">
                                    <strong>Tên:</strong> {selectedUser.full_name}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Email:</strong> {selectedUser.email}
                                </Typography>
                                {selectedUser.phone_number && (
                                    <Typography variant="body2">
                                        <strong>Số điện thoại:</strong> {selectedUser.phone_number}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}

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
                            fontWeight="bold"
                            sx={{
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
                            • Người dùng sẽ được cấp vai trò "broker" và mã broker duy nhất
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Subscription sẽ được tự động nâng cấp lên "PARTNER"
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Mã broker sẽ được gán làm referral_code cho người dùng
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.component.modal.noteText
                            }}
                        >
                            • Hành động này không thể hoàn tác tự động
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 1 }}>
                <Button
                    onClick={handleClose}
                    disabled={loading}
                    variant="outlined"
                >
                    Hủy
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={loading || !selectedUser}
                    variant="contained"
                    color="warning"
                    startIcon={loading ? <CircularProgress size={20} /> : <BrokerIcon />}
                >
                    {loading ? 'Đang cấp quyền...' : 'Cấp Quyền Broker'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AddBrokerModal;
