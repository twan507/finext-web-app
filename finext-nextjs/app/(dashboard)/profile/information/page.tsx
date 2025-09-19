'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, Skeleton, useTheme, Alert, InputAdornment } from '@mui/material';
import { Person, Email, Phone, AdminPanelSettings } from '@mui/icons-material';
import { useAuth } from 'components/AuthProvider';
import { apiClient } from 'services/apiClient';
import Link from 'next/link';

// Function để generate màu dựa trên user ID cho avatar
function generateAvatarColors(userId: string): { light: string; dark: string } {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return {
        light: `hsla(${hue}, 45%, 75%, 1)`,
        dark: `hsla(${hue}, 55%, 35%, 0.8)`
    };
}

interface ISubscription {
    _id: string;
    license_key: string;
    license_id: string;
    expiry_date: string;
}

interface ILicense {
    _id: string;
    key: string;
    name: string;
    color: string;
}

export default function InformationPage() {
    const { session } = useAuth();
    const theme = useTheme();
    const [displayName, setDisplayName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Subscription related states
    const [licenseKey, setLicenseKey] = useState<string | null>(null);
    const [licenseColor, setLicenseColor] = useState<string>("#1565c0");
    const [expiryDate, setExpiryDate] = useState<string | null>(null);
    const [userRoles, setUserRoles] = useState<any[]>([]); useEffect(() => {
        if (session?.user) {
            setDisplayName(session.user.full_name || '');
            setPhoneNumber(session.user.phone_number || '');
            fetchSubscriptionDetails();
            fetchUserRoles();
        }
    }, [session]);

    const fetchUserRoles = async () => {
        if (session?.user?.role_ids && session.user.role_ids.length > 0) {
            try {
                console.log('Fetching roles for role_ids:', session.user.role_ids);
                const rolePromises = session.user.role_ids.map(roleId =>
                    apiClient({ url: `/api/v1/roles/${roleId}`, method: 'GET' })
                );
                const roleResponses = await Promise.all(rolePromises);
                const roles = roleResponses
                    .map(response => response.data)
                    .filter(Boolean);
                console.log('Fetched roles:', roles);
                setUserRoles(roles);
            } catch (error) {
                console.error("Error fetching user roles:", error);
                // Fallback: check role_ids directly if API fails
                if (session?.user?.role_ids) {
                    console.log('Using fallback role check with role_ids:', session.user.role_ids);
                }
            }
        } else {
            console.log('No role_ids found for user');
        }
    };

    const fetchSubscriptionDetails = async () => {
        if (session?.user?.subscription_id) {
            try {
                const response = await apiClient<ISubscription>({
                    url: `/api/v1/subscriptions/${session.user.subscription_id}`,
                    method: 'GET',
                });

                if (response.data?.license_key) {
                    setLicenseKey(response.data.license_key);
                    setExpiryDate(response.data.expiry_date);

                    if (response.data.license_id) {
                        try {
                            const licenseResponse = await apiClient<ILicense>({
                                url: `/api/v1/licenses/${response.data.license_id}`,
                                method: 'GET',
                            });
                            if (licenseResponse.data?.color) {
                                setLicenseColor(licenseResponse.data.color);
                            }
                        } catch (licenseError) {
                            console.error("Error fetching license details:", licenseError);
                        }
                    }
                } else {
                    setLicenseKey('BASIC');
                    setLicenseColor('#1565c0');
                }
            } catch (error) {
                console.error("Error fetching subscription:", error);
                setLicenseKey('BASIC');
                setLicenseColor('#1565c0');
            }
        } else {
            setLicenseKey('BASIC');
            setLicenseColor('#1565c0');
        }
        setIsLoading(false);
    };

    const handleUpdateInfo = async () => {
        if (!session?.user?.id) return;

        setIsUpdating(true);
        setUpdateMessage(null);

        try {
            const response = await apiClient({
                url: `/api/v1/users/${session.user.id}`,
                method: 'PUT',
                body: {
                    full_name: displayName,
                    phone_number: phoneNumber
                }
            });

            if (response.status === 200) {
                setUpdateMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
            } else {
                throw new Error(response.message || 'Cập nhật thất bại');
            }
        } catch (error: any) {
            setUpdateMessage({
                type: 'error',
                text: error.message || 'Có lỗi xảy ra khi cập nhật thông tin'
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const formatExpiryDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (isLoading) {
        return (
            <Box sx={{ maxWidth: 700, color: 'text.primary' }}>
                <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 4, borderRadius: 2 }} />
                <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 2 }} />
            </Box>
        );
    }

    if (!session?.user) {
        return null;
    }

    const userInitial = session.user.full_name
        ? session.user.full_name.charAt(0).toUpperCase()
        : (session.user.email ? session.user.email.charAt(0).toUpperCase() : 'U');

    // Generate avatar background color
    let avatarBgColor = 'rgba(158, 158, 158, 0.5)';
    if (session.user.id) {
        const colors = generateAvatarColors(session.user.id);
        avatarBgColor = theme.palette.mode === 'dark' ? colors.dark : colors.light;
    }

    // Check if user is admin, manager, partner, or broker
    const isAdmin = userRoles.some(role =>
        role?.name?.toLowerCase().includes('admin')
    );

    const isSpecialRole = userRoles.some(role => {
        const roleName = role?.name?.toLowerCase() || '';
        return roleName.includes('admin') ||
            roleName.includes('manager') ||
            roleName.includes('partner') ||
            roleName.includes('broker');
    });

    // Fallback check: if userRoles is empty but we have role_ids, check directly from known role names
    const fallbackIsAdmin = !userRoles.length && session?.user?.role_ids?.some(roleId => {
        // Common admin role patterns
        return roleId.includes('admin') || roleId.toLowerCase().includes('admin');
    });

    const fallbackIsSpecialRole = !userRoles.length && session?.user?.role_ids?.some(roleId => {
        const lowerRoleId = roleId.toLowerCase();
        return lowerRoleId.includes('admin') ||
            lowerRoleId.includes('manager') ||
            lowerRoleId.includes('partner') ||
            lowerRoleId.includes('broker');
    });

    const finalIsAdmin = isAdmin || fallbackIsAdmin;
    const finalIsSpecialRole = isSpecialRole || fallbackIsSpecialRole;

    // Debug log
    console.log('User roles:', userRoles);
    console.log('Session role_ids:', session?.user?.role_ids);
    console.log('Is admin:', finalIsAdmin);
    console.log('Is special role:', finalIsSpecialRole);

    return (
        <Box sx={{ maxWidth: 700, color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Box
                    component="div"
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid',
                        borderColor: 'background.paper',
                        bgcolor: avatarBgColor,
                        color: 'rgba(255, 255, 255, 0.95)',
                        fontWeight: 'bold',
                        fontSize: '1.5rem',
                        backgroundImage: session.user.avatar_url ? `url(${session.user.avatar_url})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        mr: 2
                    }}
                >
                    {!session.user.avatar_url && userInitial}
                </Box>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                        {session.user.full_name || 'User'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                        <Box
                            sx={{
                                backgroundColor: licenseColor,
                                color: 'white',
                                px: 0.8,
                                py: 0.2,
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                lineHeight: '1.4',
                                textTransform: 'uppercase',
                                borderRadius: '4px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {licenseKey || '...'}
                        </Box>
                        {licenseKey === 'BASIC' ? (
                            <Typography variant="body2" sx={{
                                color: theme.palette.mode === 'dark' ? '#A0A0A0' : '#6B7280',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <Box component="span" sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.mode === 'dark' ? '#A0A0A0' : '#6B7280',
                                    mr: 1
                                }} />
                                Chưa kích hoạt
                            </Typography>
                        ) : finalIsSpecialRole ? (
                            <Typography variant="body2" sx={{
                                color: theme.palette.mode === 'dark' ? '#C084FC' : '#7C3AED',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <Box component="span" sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.mode === 'dark' ? '#C084FC' : '#7C3AED',
                                    mr: 1
                                }} />
                                Hiệu lực vĩnh viễn
                            </Typography>
                        ) : expiryDate && (
                            <Typography variant="body2" sx={{
                                color: theme.palette.mode === 'dark' ? '#F87171' : '#DC2626',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <Box component="span" sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: theme.palette.mode === 'dark' ? '#F87171' : '#DC2626',
                                    mr: 1
                                }} />
                                Hết hạn: {formatExpiryDate(expiryDate)}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Update Message */}
            {updateMessage && (
                <Alert severity={updateMessage.type} sx={{ mb: 3 }} onClose={() => setUpdateMessage(null)}>
                    {updateMessage.text}
                </Alert>
            )}

            {/* Form */}
            <Box component="form" noValidate sx={{ mt: 2 }}>
                <TextField
                    fullWidth
                    label="Email"
                    variant="outlined"
                    value={session.user.email}
                    disabled
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Email color="action" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'action.hover',
                        },
                    }}
                />

                <TextField
                    fullWidth
                    label="Tên hiển thị"
                    variant="outlined"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Person color="action" />
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
                    label="Số điện thoại"
                    variant="outlined"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Nhập số điện thoại"
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Phone color="action" />
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

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        size="medium"
                        sx={{
                            px: 3,
                            py: 1,
                            borderRadius: 2,
                            fontWeight: 'bold',
                            textTransform: 'none',
                            boxShadow: 2,
                            '&:hover': {
                                boxShadow: 4,
                            }
                        }}
                        onClick={handleUpdateInfo}
                        disabled={isUpdating}
                    >
                        {isUpdating ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
                    </Button>

                    {finalIsAdmin && (
                        <Button
                            component={Link}
                            href="/admin"
                            variant="outlined"
                            size="medium"
                            startIcon={<AdminPanelSettings />}
                            sx={{
                                px: 3,
                                py: 1,
                                borderRadius: 2,
                                fontWeight: 'bold',
                                textTransform: 'none',
                                borderColor: theme.palette.mode === 'light' ? '#d32f2f' : '#f44336',
                                color: theme.palette.mode === 'light' ? '#d32f2f' : '#f44336',
                                '&:hover': {
                                    borderColor: theme.palette.mode === 'light' ? '#b71c1c' : '#d32f2f',
                                    backgroundColor: theme.palette.mode === 'light' ? '#ffebee' : 'rgba(244, 67, 54, 0.04)',
                                    color: theme.palette.mode === 'light' ? '#b71c1c' : '#f44336',
                                }
                            }}
                        >
                            Truy cập Admin
                        </Button>
                    )}
                </Box>
            </Box>
        </Box>
    );
}