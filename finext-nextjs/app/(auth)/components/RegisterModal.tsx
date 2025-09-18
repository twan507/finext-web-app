'use client';

import React, { useEffect } from 'react';

// MUI
import Dialog from '@mui/material/Dialog';

import RegisterForm from './RegisterForm';

interface RegisterModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void; // Callback sau khi đăng ký thành công
}

export default function RegisterModal({ open, onClose, onSuccess }: RegisterModalProps) {
    // Đóng modal nếu đăng ký thành công (có thể thêm logic sau)
    useEffect(() => {
        // Logic có thể thêm sau nếu cần
    }, [open, onClose, onSuccess]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    m: 0,
                    p: 0,
                    borderRadius: 3,
                }
            }}
        >
            <RegisterForm />
        </Dialog>
    );
}