'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from 'components/AuthProvider';
import { apiClient } from 'services/apiClient';
import { useRouter } from 'next/navigation';
import { useSignInModal } from 'hooks/useSignInModal';

import {
    Avatar, Typography, Box, Skeleton, useTheme
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import SignInModal from 'app/(auth)/components/LoginModal';

interface ISubscription {
    _id: string;
    license_key: string;
    license_id: string;
}

interface ILicense {
    _id: string;
    key: string;
    name: string;
    color: string;
}

// ======================================================================
// COMPONENT: AVATAR VỚI HUY HIỆU (Sẽ được sửa ở file dưới)
// ======================================================================
interface UserAvatarWithSubscriptionProps {
    badgeText: string;
    badgeColor: string;
    avatarSrc?: string | null;
    size?: number;
    children?: React.ReactNode;
    userId?: string; // Thêm userId prop
}

// Function để generate màu dựa trên user ID cho cả light và dark mode
function generateAvatarColors(userId: string): { light: string; dark: string } {
    // Tạo hash đơn giản từ userId
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Tạo màu HSL với saturation và lightness khác nhau cho light/dark
    const hue = Math.abs(hash) % 360;

    return {
        // Light mode: màu đậm vừa phải, saturation cao để nổi bật trên nền sáng
        light: `hsla(${hue}, 60%, 50%, 1)`, // Saturation 60%, Lightness 50%
        // Dark mode: màu sáng hơn một chút để nổi trên nền tối
        dark: `hsla(${hue}, 55%, 35%, 1)`   // Saturation 55%, Lightness 35%
    };
}

function UserAvatarWithSubscription({
    badgeText,
    badgeColor,
    avatarSrc,
    size = 32,
    children,
    userId
}: UserAvatarWithSubscriptionProps) {

    const theme = useTheme(); // Thêm useTheme hook
    const ringSize = size + 4;

    // Generate màu avatar dựa trên userId và theme mode
    let avatarBgColor = 'rgba(158, 158, 158, 0.5)'; // Fallback color với opacity
    if (userId) {
        const colors = generateAvatarColors(userId);
        avatarBgColor = theme.palette.mode === 'dark' ? colors.dark : colors.light;
    }

    return (
        <Box
            sx={{
                position: 'relative',
                width: size, // Thay đổi từ ringSize thành size để ẩn ring
                height: size, // Thay đổi từ ringSize thành size để ẩn ring
            }}
        >
            <Avatar
                alt="User Avatar"
                src={avatarSrc || undefined}
                sx={{
                    width: size,
                    height: size,
                    border: '2px solid',
                    borderColor: 'background.paper',
                    bgcolor: avatarBgColor, // Màu nền với opacity thấp
                    color: 'rgba(255, 255, 255, 0.95)', // Chữ màu trắng cho cả light và dark mode
                    fontWeight: 'bold', // Chữ đậm
                }}
            >
                {children}
            </Avatar>
            {/* </Box> */}

            {badgeText && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: -4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: badgeColor,
                        color: 'white',
                        px: 0.45, // Giảm từ 0.6 xuống 0.4
                        py: 0.15, // Giảm từ 0.1 xuống 0.05
                        fontSize: '0.45rem', // Giảm từ 0.6rem xuống 0.5rem
                        fontWeight: 'bold',
                        lineHeight: '1.4',
                        textTransform: 'uppercase',
                        borderRadius: '4px', // Giảm từ 6px xuống 4px
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {badgeText}
                </Box>
            )}
        </Box>
    );
}


// ======================================================================
// COMPONENT CHÍNH: USER MENU
// ======================================================================
interface UserMenuProps {
    variant?: 'full' | 'icon';
}

const UserAvatar: React.FC<UserMenuProps> = ({ variant = 'icon' }) => {
    const { session, logout } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const { isOpen: isSignInOpen, openModal: openSignInModal, closeModal: closeSignInModal } = useSignInModal();
    const [mounted, setMounted] = useState(false);
    const [licenseKey, setLicenseKey] = useState<string | null>(null);
    const [licenseColor, setLicenseColor] = useState<string>("#1565c0");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const handleOpenSignInModal = () => {
        openSignInModal();
    };

    const handleSignInSuccess = () => {
        console.log('Đăng nhập thành công từ modal!');
        closeSignInModal();
    };

    useEffect(() => {
        setMounted(true);

        const fetchSubscriptionDetails = async () => {
            if (session?.user?.subscription_id) {
                try {
                    const response = await apiClient<ISubscription>({
                        url: `/api/v1/subscriptions/${session.user.subscription_id}`,
                        method: 'GET',
                    });

                    if (response.data?.license_key) {
                        setLicenseKey(response.data.license_key);
                        if (response.data.license_id) {
                            try {
                                const licenseResponse = await apiClient<ILicense>({
                                    url: `/api/v1/licenses/${response.data.license_id}`,
                                    method: 'GET',
                                });
                                if (licenseResponse.data?.color) {
                                    setLicenseColor(licenseResponse.data.color);
                                }
                            } catch {
                                // Silently handle license fetch errors - fallback to default color
                            }
                        }
                    } else {
                        setLicenseKey('BASIC');
                        setLicenseColor('#1565c0');
                    }
                } catch {
                    // Silently handle subscription fetch errors (e.g., on page refresh race conditions)
                    // Fallback to default values
                    setLicenseKey('BASIC');
                    setLicenseColor('#1565c0');
                } finally {
                    setIsLoading(false);
                }
            } else {
                setLicenseKey('BASIC');
                setLicenseColor('#1565c0');
                setIsLoading(false);
            }
        };

        if (session) {
            fetchSubscriptionDetails();
        } else {
            setIsLoading(false);
        }

    }, [session]);

    const handleClick = () => {
        router.push('/profile');
    };

    if (!mounted || isLoading) {
        // Loading với avatar placeholder và badge mờ
        if (variant === 'icon') {
            return (
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1,
                }}>
                    <Box sx={{ position: 'relative', width: 32, height: 32 }}>
                        <Skeleton
                            variant="circular"
                            width={32}
                            height={32}
                            sx={{
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.08)',
                                '&::after': {
                                    animationDuration: '1.5s',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)'
                                        : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
                                },
                            }}
                        />
                        {/* Loading badge với contrast tốt hơn */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: -6,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.2)'
                                    : 'rgba(0, 0, 0, 0.15)',
                                px: 0.45,
                                py: 0.15,
                                fontSize: '0.45rem',
                                borderRadius: '4px',
                                border: theme.palette.mode === 'dark'
                                    ? '1px solid rgba(255, 255, 255, 0.1)'
                                    : '1px solid rgba(0, 0, 0, 0.05)',
                                animation: 'pulse 1.5s ease-in-out infinite',
                                '@keyframes pulse': {
                                    '0%, 100%': { opacity: 0.4 },
                                    '50%': { opacity: 0.8 },
                                },
                            }}
                        >
                            <Skeleton
                                width={20}
                                height={8}
                                sx={{
                                    bgcolor: theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.3)'
                                        : 'rgba(255, 255, 255, 0.7)',
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            );
        } else {
            // Loading cho full variant
            return (
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    p: 2,
                    px: 2.5,
                }}>
                    <Box sx={{ position: 'relative', mr: 1.5 }}>
                        <Skeleton
                            variant="circular"
                            width={38}
                            height={38}
                            sx={{
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.08)',
                                '&::after': {
                                    animationDuration: '1.5s',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)'
                                        : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
                                },
                            }}
                        />
                        {/* Loading badge với contrast tốt hơn */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: -6,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.2)'
                                    : 'rgba(0, 0, 0, 0.15)',
                                px: 0.45,
                                py: 0.15,
                                fontSize: '0.45rem',
                                borderRadius: '4px',
                                border: theme.palette.mode === 'dark'
                                    ? '1px solid rgba(255, 255, 255, 0.1)'
                                    : '1px solid rgba(0, 0, 0, 0.05)',
                                animation: 'pulse 1.5s ease-in-out infinite',
                                '@keyframes pulse': {
                                    '0%, 100%': { opacity: 0.4 },
                                    '50%': { opacity: 0.8 },
                                },
                            }}
                        >
                            <Skeleton
                                width={20}
                                height={8}
                                sx={{
                                    bgcolor: theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.3)'
                                        : 'rgba(255, 255, 255, 0.7)',
                                }}
                            />
                        </Box>
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Skeleton
                            variant="text"
                            width="60%"
                            height={20}
                            sx={{
                                mb: 0.5,
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.06)',
                                '&::after': {
                                    animationDuration: '1.5s',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent)'
                                        : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
                                },
                            }}
                        />
                        <Skeleton
                            variant="text"
                            width="80%"
                            height={16}
                            sx={{
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.06)'
                                    : 'rgba(0, 0, 0, 0.04)',
                                '&::after': {
                                    animationDuration: '1.5s',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)'
                                        : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
                                },
                            }}
                        />
                    </Box>
                </Box>
            );
        }
    }

    // Dummy avatar cho trường hợp không có session
    if (!session) {
        if (variant === 'icon') {
            return (
                <>
                    <SignInModal
                        open={isSignInOpen}
                        onClose={closeSignInModal}
                        onSuccess={handleSignInSuccess}
                    />
                    <Box
                        onClick={handleOpenSignInModal}
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 1,
                            cursor: 'pointer',
                            '&:hover': {
                                opacity: 0.8,
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.12)'
                                    : 'rgba(0, 0, 0, 0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mt: 0.5,
                            }}
                        >
                            <PersonIcon
                                sx={{
                                    color: theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.35)'
                                        : 'rgba(0, 0, 0, 0.45)',
                                    fontSize: 20
                                }}
                            />
                        </Box>
                    </Box>
                </>
            );
        } else {
            return (
                <>
                    <SignInModal
                        open={isSignInOpen}
                        onClose={closeSignInModal}
                        onSuccess={handleSignInSuccess}
                    />
                    <Box
                        onClick={handleOpenSignInModal}
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            p: 2,
                            px: 2.5,
                            cursor: 'pointer',
                            '&:hover': {
                                opacity: 0.8,
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.12)'
                                    : 'rgba(0, 0, 0, 0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mr: 1.5,
                                mt: 0.5,
                            }}
                        >
                            <PersonIcon
                                sx={{
                                    color: theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.35)'
                                        : 'rgba(0, 0, 0, 0.45)',
                                    fontSize: 22
                                }}
                            />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ color: 'text.secondary' }}>
                                Chưa đăng nhập
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                                Nhấn để đăng nhập
                            </Typography>
                        </Box>
                    </Box>
                </>
            );
        }
    }

    const userInitial = session.user?.full_name
        ? session.user.full_name.charAt(0).toUpperCase()
        : (session.user?.email ? session.user.email.charAt(0).toUpperCase() : 'U');

    const avatarUrl = session.user?.avatar_url;

    // Icon variant: chỉ hiển thị avatar
    if (variant === 'icon') {
        return (
            <>
                <SignInModal
                    open={isSignInOpen}
                    onClose={closeSignInModal}
                    onSuccess={handleSignInSuccess}
                />
                <Box
                    onClick={handleClick}
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 1,
                        cursor: 'pointer',
                        '&:hover': {
                            opacity: 0.8,
                        },
                    }}
                    title={`${session.user.full_name || 'User'} (${session.user.email})`} // Tooltip hiển thị thông tin user
                >
                    <UserAvatarWithSubscription
                        size={32}
                        badgeText={licenseKey || '...'}
                        badgeColor={licenseColor}
                        avatarSrc={avatarUrl}
                        userId={session.user.id}
                    >
                        {userInitial}
                    </UserAvatarWithSubscription>
                </Box>
            </>
        );
    }

    // Full variant: hiển thị đầy đủ thông tin
    return (
        <>
            <SignInModal
                open={isSignInOpen}
                onClose={closeSignInModal}
                onSuccess={handleSignInSuccess}
            />
            <Box
                onClick={handleClick}
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    p: 2,
                    px: 2.5,
                    cursor: 'pointer',
                    '&:hover': {
                        opacity: 0.8,
                    },
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    mt: -1,
                    mr: 1.5
                }}>
                    <UserAvatarWithSubscription
                        size={38}
                        badgeText={licenseKey || '...'}
                        badgeColor={licenseColor}
                        avatarSrc={avatarUrl}
                        userId={session.user.id}
                    >
                        {userInitial}
                    </UserAvatarWithSubscription>
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                        {session.user.full_name || 'User'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {session.user.email}
                    </Typography>
                </Box>
            </Box>
        </>

    );
};

export default UserAvatar;