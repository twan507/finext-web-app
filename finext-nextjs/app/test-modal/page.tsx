'use client';

import React from 'react';
import { Container, Typography, Box, Button } from '@mui/material';
import { useSignInModal } from 'hooks/useSignInModal';
import { useRegisterModal } from 'hooks/useRegisterModal';
import { useAuth } from '@/components/auth/AuthProvider';
import SignInModal from '../(auth)/components/LoginModal';
import RegisterModal from '../(auth)/components/RegisterModal';

export default function TestModalPage() {
    const { isOpen: isSignInOpen, openModal: openSignInModal, closeModal: closeSignInModal } = useSignInModal();
    const { isOpen: isRegisterOpen, openModal: openRegisterModal, closeModal: closeRegisterModal } = useRegisterModal();
    const { session, logout } = useAuth();

    const handleOpenSignInModal = () => {
        openSignInModal();
    };

    const handleOpenRegisterModal = () => {
        openRegisterModal();
    };

    const handleSignInSuccess = () => {
        console.log('Đăng nhập thành công từ modal!');
        closeSignInModal();
    };

    const handleRegisterSuccess = () => {
        console.log('Đăng ký thành công từ modal!');
        closeRegisterModal();
    };

    const handleLogout = async () => {
        await logout();
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" component="h1" sx={{ mb: 4, textAlign: 'center' }}>
                Test Modal Đăng nhập & Đăng ký
            </Typography>

            <Box sx={{
                border: '1px solid #ddd',
                borderRadius: 2,
                p: 3,
                backgroundColor: (theme) => theme.palette.background.paper,
                textAlign: 'center'
            }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    Demo Modal Auth
                </Typography>

                {session ? (
                    <Box>
                        <Typography sx={{ mb: 2 }}>
                            Xin chào, {session.user.email}!
                        </Typography>
                        <Button
                            variant="outlined"
                            onClick={handleLogout}
                        >
                            Đăng xuất
                        </Button>
                    </Box>
                ) : (
                    <Box>
                        <Typography sx={{ mb: 2 }}>
                            Bạn chưa đăng nhập. Thử mở modal:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                onClick={handleOpenSignInModal}
                            >
                                Mở Modal Đăng nhập
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={handleOpenRegisterModal}
                            >
                                Mở Modal Đăng ký
                            </Button>
                        </Box>
                    </Box>
                )}
            </Box>

            <Typography variant="body1" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
                Trang này được tạo để test modal đăng nhập và đăng ký.
                <br />
                Modal được sử dụng như component bình thường với hooks tương ứng.
            </Typography>

            {/* Render modals */}
            <SignInModal
                open={isSignInOpen}
                onClose={closeSignInModal}
                onSuccess={handleSignInSuccess}
            />

            <RegisterModal
                open={isRegisterOpen}
                onClose={closeRegisterModal}
                onSuccess={handleRegisterSuccess}
            />
        </Container>
    );
}