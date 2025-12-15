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
    MoreHoriz,
    Schedule,
    Today,
    RadioButtonChecked,
    Android,
    Apple,
    Window,
    Laptop,
    Computer,
} from '@mui/icons-material';
import { apiClient } from '../../../../services/apiClient';
import { useAuth } from '../../../../components/AuthProvider';
import { fontSize, iconSize } from 'theme/tokens';

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

        // Hệ điều hành Android (bao gồm cả mobile và tablet)
        if (info.includes('android')) {
            return <Android />;
        }

        // Hệ điều hành iOS (iPhone và iPad)
        if (info.includes('iphone') || info.includes('ipad') || info.includes('ios')) {
            return <Apple />;
        }

        // Hệ điều hành macOS
        if (info.includes('mac') || info.includes('macos')) {
            return <Laptop />; // Sử dụng Laptop cho MacOS
        }

        // Hệ điều hành Windows
        if (info.includes('windows')) {
            return <Window />;
        }

        // Hệ điều hành Linux
        if (info.includes('linux')) {
            return <Laptop />;
        }

        // Default cho các hệ điều hành khác
        return <Computer />;
    };

    const getDeviceType = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Thiết bị không xác định';

        const info = deviceInfo.toLowerCase();

        // Kiểm tra iPad trước iPhone vì iPad cũng có thể chứa "iphone" trong user agent
        if (info.includes('ipad')) {
            return 'iPad';
        }
        if (info.includes('iphone')) {
            return 'iPhone';
        }
        if (info.includes('android') && info.includes('tablet')) {
            return 'Android Tablet';
        }
        if (info.includes('android')) {
            return 'Android';
        }
        if (info.includes('mobile')) {
            return 'Điện thoại';
        }
        if (info.includes('tablet')) {
            return 'Máy tính bảng';
        }
        if (info.includes('windows nt 10.0')) {
            return 'Windows 10/11';
        }
        if (info.includes('windows nt 6.3')) {
            return 'Windows 8.1';
        }
        if (info.includes('windows nt 6.1')) {
            return 'Windows 7';
        }
        if (info.includes('windows')) {
            return 'Windows PC';
        }
        if (info.includes('mac')) {
            return 'MacOS';
        }
        if (info.includes('linux')) {
            return 'Linux';
        }
        return 'Máy tính';
    };

    const getBrowserInfo = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Trình duyệt không xác định';

        const info = deviceInfo.toLowerCase();
        // Kiểm tra các trình duyệt dựa trên Chromium trước, Chrome cuối cùng
        if (info.includes('edg/') || info.includes('edge/')) return 'Edge';
        if (info.includes('opera') || info.includes('opr/')) return 'Opera';
        if (info.includes('firefox')) return 'Firefox';
        if (info.includes('safari') && !info.includes('chrome')) return 'Safari';
        if (info.includes('chrome')) return 'Chrome';
        return 'Trình duyệt khác';
    };

    // Function để tách IP từ device_info
    const extractIP = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Không xác định';

        // Tìm IP trong dấu ngoặc đơn cuối cùng
        const ipMatch = deviceInfo.match(/\(([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\)$/);
        return ipMatch ? ipMatch[1] : 'Không xác định';
    };

    // Function để tạo user agent thân thiện
    const getFriendlyUserAgent = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Không có thông tin thiết bị';

        // Loại bỏ IP khỏi cuối string (nếu có)
        const cleanUserAgent = deviceInfo.replace(/\s*\([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\)$/, '');

        // Tạo mô tả ngắn gọn
        const info = cleanUserAgent.toLowerCase();
        let description = '';

        // Xác định browser
        if (info.includes('chrome')) description += 'Chrome ';
        else if (info.includes('firefox')) description += 'Firefox ';
        else if (info.includes('safari') && !info.includes('chrome')) description += 'Safari ';
        else if (info.includes('edge')) description += 'Edge ';
        else if (info.includes('opera')) description += 'Opera ';
        else description += 'Trình duyệt khác ';

        // Xác định OS
        if (info.includes('windows nt 10.0')) description += 'trên Windows 10/11';
        else if (info.includes('windows nt 6.3')) description += 'trên Windows 8.1';
        else if (info.includes('windows nt 6.1')) description += 'trên Windows 7';
        else if (info.includes('windows')) description += 'trên Windows';
        else if (info.includes('mac os x') || info.includes('macos')) description += 'trên macOS';
        else if (info.includes('linux')) description += 'trên Linux';
        else if (info.includes('android')) description += 'trên Android';
        else if (info.includes('iphone') || info.includes('ipad')) description += 'trên iOS';
        else description += 'trên hệ điều hành không xác định';

        return description.trim();
    };

    const formatDate = (dateString: string) => {
        // Nếu dateString không có timezone indicator, coi nó là UTC
        let dbTime;
        if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('T') && dateString.lastIndexOf('-') > 10) {
            // Đã có timezone indicator
            dbTime = new Date(dateString);
        } else {
            // Không có timezone indicator, coi là UTC
            dbTime = new Date(dateString + 'Z');
        }

        const now = new Date();

        // Tính khoảng cách thời gian bằng milliseconds
        const diffMs = now.getTime() - dbTime.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Debug log để kiểm tra
        console.log('formatDate debug:', {
            dateString,
            dbTime: dbTime.toISOString(),
            now: now.toISOString(),
            diffMs,
            diffMinutes,
            diffHours,
            diffDays
        });

        if (diffMinutes < 1) return 'Vừa xong';
        if (diffMinutes < 60) return `${diffMinutes} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;

        // Hiển thị ngày theo múi giờ địa phương
        return dbTime.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <Box sx={{ maxWidth: 600, width: '100%', color: 'text.primary' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 600, width: '100%', color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
                        Session đăng nhập
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Quản lý các thiết bị đang đăng nhập
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
                        <DevicesOutlined sx={{ fontSize: fontSize.display.tablet, color: 'text.secondary', mb: 2 }} />
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
                                    borderRadius: 3,
                                    boxShadow: isLikelyCurrentSession ? '0 8px 32px rgba(0,0,0,0.12)' : '0 2px 16px rgba(0,0,0,0.08)',
                                    background: isLikelyCurrentSession
                                        ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.03) 0%, rgba(25, 118, 210, 0.08) 100%)'
                                        : 'background.paper',
                                }}>
                                    <CardContent sx={{ p: 2, pb: isLikelyCurrentSession ? 4 : 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                            <Box sx={{ display: 'flex', flex: 1 }}>
                                                <Box sx={{
                                                    mr: 2,
                                                    p: 1,
                                                    borderRadius: 1.5,
                                                    bgcolor: isLikelyCurrentSession ? 'primary.main' : 'action.hover',
                                                    color: isLikelyCurrentSession ? 'primary.contrastText' : 'text.primary',
                                                    display: { xs: 'none', sm: 'flex' },
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    {getDeviceIcon(session.device_info)}
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                                                        <Typography variant="subtitle1" sx={{
                                                            fontWeight: 'bold',
                                                            color: isLikelyCurrentSession ? 'primary.main' : 'text.primary'
                                                        }}>
                                                            {getDeviceType(session.device_info)}
                                                        </Typography>
                                                        <Chip
                                                            label={getBrowserInfo(session.device_info)}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{
                                                                borderColor: isLikelyCurrentSession ? 'primary.main' : 'divider',
                                                                color: isLikelyCurrentSession ? 'primary.main' : 'text.secondary',
                                                            }}
                                                        />
                                                    </Box>

                                                    {/* Device info with ID and IP */}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            px: 1,
                                                            py: 0.5,
                                                            borderRadius: 1,
                                                            bgcolor: 'action.hover',
                                                        }}>
                                                            <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5 }}>
                                                                ID:
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ fontWeight: 'medium', fontFamily: 'monospace' }}>
                                                                {session.id.slice(-6).toUpperCase()}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            px: 1,
                                                            py: 0.5,
                                                            borderRadius: 1,
                                                            bgcolor: 'action.hover',
                                                        }}>
                                                            <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5 }}>
                                                                IP:
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ fontWeight: 'medium', fontFamily: 'monospace' }}>
                                                                {extractIP(session.device_info)}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    <Box sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 2,
                                                        flexWrap: 'wrap',
                                                    }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <Today sx={{
                                                                fontSize: fontSize.h6.mobile,
                                                                mr: 1,
                                                                color: isLikelyCurrentSession ? 'primary.main' : 'text.secondary'
                                                            }} />
                                                            <Box>
                                                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                                                    Đăng nhập
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                                    {formatDate(session.created_at)}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <Schedule sx={{
                                                                fontSize: fontSize.h6.mobile,
                                                                mr: 1,
                                                                color: isLikelyCurrentSession ? 'primary.main' : 'text.secondary'
                                                            }} />
                                                            <Box>
                                                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                                                    Hoạt động
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                                                    {formatDate(session.last_active_at)}
                                                                </Typography>
                                                            </Box>
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

                                        {/* Current session chip - moved to bottom right */}
                                        {isLikelyCurrentSession && (
                                            <Chip
                                                icon={<RadioButtonChecked />}
                                                label="Session hiện tại"
                                                size="small"
                                                color="primary"
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: 12,
                                                    right: 12,
                                                    zIndex: 1,
                                                    fontWeight: 'bold',
                                                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
                                                }}
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                </Stack>
            )}
        </Box>
    );
}