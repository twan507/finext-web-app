'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

// MUI
import Dialog from '@mui/material/Dialog';

import SignInForm from './LoginForm';

interface SignInModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void; // Callback sau khi đăng nhập thành công
}

export default function SignInModal({ open, onClose, onSuccess }: SignInModalProps) {
    const { session, loading: authLoading } = useAuth();

    // Đóng modal nếu đã đăng nhập
    useEffect(() => {
        if (!authLoading && session && open) {
            onSuccess?.();
            onClose();
        }
    }, [session, authLoading, open, onClose, onSuccess]);

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
            <SignInForm />
        </Dialog>
    );
}