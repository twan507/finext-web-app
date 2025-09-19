'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Alert,
    CircularProgress,
    Card,
    CardContent,
    Button,
    Chip,
    Stack,
    IconButton,
    Divider,
} from '@mui/material';
import {
    DevicesOutlined,
    DeleteOutline,
    Computer,
    Smartphone,
    Tablet,
    MoreHoriz,
    Schedule,
    Today,
    RadioButtonChecked,
} from '@mui/icons-material';
import { apiClient } from '../../../../services/apiClient';
import { useAuth } from '../../../../components/AuthProvider';

interface Session {
    id: string;
    user_id: string;
    jti: string;
    device_info?: string;
    created_at: string;
    last_active_at: string;
}

export default function LoginSessionsPage() {
    const { session: currentSession } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await apiClient<Session[]>({
                url: '/api/v1/sessions/me',
                method: 'GET',
            });

            console.log('Fetched sessions:', response.data);
            setSessions(response.data || []);
        } catch (error: any) {
            console.error('Fetch sessions error:', error);
            setMessage({
                type: 'error',
                text: error?.message || 'Có lỗi xảy ra khi tải danh sách session',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        // Check if this is current session by comparing ID or other available fields
        const sessionToDelete = sessions.find(s => s.id === sessionId);
        
        // Since we can't compare JTI directly, we'll warn for the most recent session
        const sortedSessions = [...sessions].sort((a, b) => 
            new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
        );
        const isLikelyCurrentSession = sortedSessions[0]?.id === sessionId;
        
        const confirmMessage = isLikelyCurrentSession 
            ? 'Đây có thể là session hiện tại của bạn (hoạt động gần nhất). Xóa có thể đăng xuất bạn. Bạn có chắc chắn?' 
            : 'Bạn có chắc chắn muốn đăng xuất khỏi session này?';
            
        if (!confirm(confirmMessage)) {
            return;
        }

        console.log('Deleting session ID:', sessionId);
        console.log('Is likely current session:', isLikelyCurrentSession);
        console.log('Session to delete:', sessionToDelete);
        
        try {
            setDeletingSessionId(sessionId);
            const response = await apiClient({
                url: `/api/v1/sessions/me/${sessionId}`,
                method: 'DELETE',
            });

            console.log('Delete response:', response);

            // Remove session from list immediately
            setSessions(prev => {
                const newSessions = prev.filter(session => session.id !== sessionId);
                console.log('Sessions after delete:', newSessions);
                return newSessions;
            });
            
            setMessage({
                type: 'success',
                text: 'Đã đăng xuất khỏi session thành công',
            });

            // If this might be current session, warn user
            if (isLikelyCurrentSession) {
                setTimeout(() => {
                    setMessage({
                        type: 'success',
                        text: 'Nếu trang bị logout tự động, đó là do bạn đã xóa session hiện tại',
                    });
                }, 2000);
            }
        } catch (error: any) {
            console.error('Delete session error:', error);
            setMessage({
                type: 'error',
                text: error?.message || 'Có lỗi xảy ra khi đăng xuất session',
            });
        } finally {
            setDeletingSessionId(null);
        }
    };

    const getDeviceIcon = (deviceInfo?: string) => {
        if (!deviceInfo) return <MoreHoriz />;

        const info = deviceInfo.toLowerCase();
        if (info.includes('mobile') || info.includes('android') || info.includes('iphone')) {
            return <Smartphone />;
        }
        if (info.includes('tablet') || info.includes('ipad')) {
            return <Tablet />;
        }
        return <Computer />;
    };

    const getDeviceType = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Thiết bị không xác định';

        const info = deviceInfo.toLowerCase();
        if (info.includes('mobile') || info.includes('android') || info.includes('iphone')) {
            return 'Điện thoại';
        }
        if (info.includes('tablet') || info.includes('ipad')) {
            return 'Máy tính bảng';
        }
        if (info.includes('windows')) {
            return 'Windows PC';
        }
        if (info.includes('mac')) {
            return 'Mac';
        }
        if (info.includes('linux')) {
            return 'Linux';
        }
        return 'Máy tính';
    };

    const getBrowserInfo = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Trình duyệt không xác định';

        const info = deviceInfo.toLowerCase();
        if (info.includes('chrome')) return 'Chrome';
        if (info.includes('firefox')) return 'Firefox';
        if (info.includes('safari')) return 'Safari';
        if (info.includes('edge')) return 'Edge';
        if (info.includes('opera')) return 'Opera';
        return 'Trình duyệt khác';
    };

    const formatDate = (dateString: string) => {
        // Parse UTC time từ database
        const utcDate = new Date(dateString);
        // Chuyển sang múi giờ Việt Nam (UTC+7)
        const vietnamTime = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));

        // Thời gian hiện tại ở Việt Nam
        const nowUtc = new Date();
        const nowVietnam = new Date(nowUtc.getTime() + (7 * 60 * 60 * 1000));

        const diffMs = nowVietnam.getTime() - vietnamTime.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) return 'Vừa xong';
        if (diffMinutes < 60) return `${diffMinutes} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;

        // Hiển thị ngày theo múi giờ Việt Nam
        return vietnamTime.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <Box sx={{ maxWidth: 700, color: 'text.primary' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 700, color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Box
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'primary.main',
                        color: 'white',
                        mr: 2
                    }}
                >
                    <DevicesOutlined sx={{ fontSize: '1.8rem' }} />
                </Box>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                        Session đăng nhập
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Quản lý các thiết bị đang đăng nhập vào tài khoản của bạn
                    </Typography>
                </Box>
            </Box>

            {/* Message */}
            {message && (
                <Alert
                    severity={message.type}
                    sx={{ mb: 3 }}
                    onClose={() => setMessage(null)}
                >
                    {message.text}
                </Alert>
            )}

            {/* Sessions List */}
            {sessions.length === 0 ? (
                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <DevicesOutlined sx={{ fontSize: '3rem', color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            Không có session nào đang hoạt động
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Stack spacing={2}>
                    {sessions
                        .sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())
                        .map((session, index) => {
                            const isLikelyCurrentSession = index === 0; // Most recently active
                            return (
                        <Card key={session.id} sx={{ 
                            position: 'relative',
                            border: isLikelyCurrentSession ? '2px solid' : '1px solid',
                            borderColor: isLikelyCurrentSession ? 'primary.main' : 'divider',
                        }}>
                            {isLikelyCurrentSession && (
                                <Chip
                                    icon={<RadioButtonChecked />}
                                    label="Session hiện tại"
                                    size="small"
                                    color="primary"
                                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                                />
                            )}
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', flex: 1 }}>
                                        <Box sx={{ mr: 2, mt: 0.5 }}>
                                            {getDeviceIcon(session.device_info)}
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mr: 2 }}>
                                                    {getDeviceType(session.device_info)}
                                                </Typography>
                                                <Chip
                                                    label={getBrowserInfo(session.device_info)}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </Box>

                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                {session.device_info || 'Không có thông tin thiết bị'}
                                            </Typography>

                                            {/* Debug info */}
                                            <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: 'block' }}>
                                                ID: {session.id} | JTI: {session.jti}
                                            </Typography>

                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Today sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Đăng nhập: {formatDate(session.created_at)}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Schedule sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Hoạt động: {formatDate(session.last_active_at)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>

                                    <IconButton
                                        onClick={() => handleDeleteSession(session.id)}
                                        disabled={deletingSessionId === session.id}
                                        sx={{
                                            color: 'error.main',
                                            '&:hover': {
                                                backgroundColor: 'error.main',
                                                color: 'white',
                                            },
                                        }}
                                    >
                                        {deletingSessionId === session.id ? (
                                            <CircularProgress size={20} />
                                        ) : (
                                            <DeleteOutline />
                                        )}
                                    </IconButton>
                                </Box>
                            </CardContent>
                        </Card>
                    );
                })}
                </Stack>
            )}

            {sessions.length > 0 && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                        💡 Mẹo: Nếu bạn thấy session không quen thuộc, hãy đăng xuất ngay để bảo vệ tài khoản
                    </Typography>
                </Box>
            )}
        </Box>
    );
}