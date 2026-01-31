'use client';

import React from 'react';
import { Box, Typography, Button, useTheme, alpha, Collapse } from '@mui/material';
import { Icon } from '@iconify/react';
import {
    ErrorOutline as ErrorIcon,
    WarningAmber as WarningIcon,
    WifiOff as OfflineIcon,
    CloudOff as ServerErrorIcon,
    LockOutlined as UnauthorizedIcon,
    Block as ForbiddenIcon,
    SearchOff as NotFoundIcon,
} from '@mui/icons-material';
import {
    spacing,
    borderRadius,
    shadows,
    transitions,
    getResponsiveFontSize,
    fontWeight,
} from 'theme/tokens';

export type ErrorType =
    | 'generic'      // General error
    | 'network'      // Network/connectivity error
    | 'server'       // Server error (500)
    | 'notFound'     // Resource not found (404)
    | 'unauthorized' // Authentication required (401)
    | 'forbidden'    // Permission denied (403)
    | 'validation'   // Validation error
    | 'timeout';     // Request timeout

export interface ErrorStateProps {
    /** Type of error - determines icon and default message */
    type?: ErrorType;
    /** Main title text (overrides default for type) */
    title?: string;
    /** Error message or description */
    message?: string;
    /** Technical error details (shown in collapsible) */
    details?: string;
    /** Retry action */
    onRetry?: () => void;
    /** Custom retry button text */
    retryLabel?: string;
    /** Go back action */
    onGoBack?: () => void;
    /** Contact support action */
    onContactSupport?: () => void;
    /** Size variant */
    size?: 'small' | 'medium' | 'large';
    /** Custom icon (overrides type-based icon) */
    icon?: React.ReactNode;
    /** Whether to show details by default */
    showDetailsDefault?: boolean;
    /** Additional content */
    children?: React.ReactNode;
}

const errorConfig: Record<ErrorType, {
    icon: React.ReactNode;
    title: string;
    message: string;
    color: string;
}> = {
    generic: {
        icon: <ErrorIcon />,
        title: 'Đã xảy ra lỗi',
        message: 'Có lỗi xảy ra khi thực hiện yêu cầu của bạn. Vui lòng thử lại.',
        color: 'error.main',
    },
    network: {
        icon: <OfflineIcon />,
        title: 'Không có kết nối mạng',
        message: 'Vui lòng kiểm tra kết nối internet và thử lại.',
        color: 'warning.main',
    },
    server: {
        icon: <ServerErrorIcon />,
        title: 'Lỗi máy chủ',
        message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
        color: 'error.main',
    },
    notFound: {
        icon: <NotFoundIcon />,
        title: 'Không tìm thấy',
        message: 'Nội dung bạn tìm kiếm không tồn tại hoặc đã bị xóa.',
        color: 'info.main',
    },
    unauthorized: {
        icon: <UnauthorizedIcon />,
        title: 'Yêu cầu đăng nhập',
        message: 'Vui lòng đăng nhập để tiếp tục.',
        color: 'warning.main',
    },
    forbidden: {
        icon: <ForbiddenIcon />,
        title: 'Không có quyền truy cập',
        message: 'Bạn không có quyền truy cập nội dung này.',
        color: 'error.main',
    },
    validation: {
        icon: <WarningIcon />,
        title: 'Dữ liệu không hợp lệ',
        message: 'Vui lòng kiểm tra lại thông tin đã nhập.',
        color: 'warning.main',
    },
    timeout: {
        icon: <OfflineIcon />,
        title: 'Yêu cầu quá thời gian',
        message: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.',
        color: 'warning.main',
    },
};

const sizeConfig = {
    small: {
        iconSize: 40,
        padding: spacing.lg,
    },
    medium: {
        iconSize: 56,
        padding: spacing.xl,
    },
    large: {
        iconSize: 72,
        padding: spacing.xxl,
    },
};

export default function ErrorState({
    type = 'generic',
    title,
    message,
    details,
    onRetry,
    retryLabel = 'Thử lại',
    onGoBack,
    onContactSupport,
    size = 'medium',
    icon,
    showDetailsDefault = false,
    children,
}: ErrorStateProps) {
    const theme = useTheme();
    const [showDetails, setShowDetails] = React.useState(showDetailsDefault);

    const config = errorConfig[type];
    const sizeConf = sizeConfig[size];

    const finalTitle = title || config.title;
    const finalMessage = message || config.message;
    const finalIcon = icon || config.icon;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: sizeConf.padding,
                minHeight: 200,
            }}
        >
            {/* Icon */}
            <Box
                sx={{
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: sizeConf.iconSize + 24,
                    height: sizeConf.iconSize + 24,
                    borderRadius: '50%',
                    backgroundColor: alpha(theme.palette.error.main, 0.1),
                }}
            >
                {React.cloneElement(finalIcon as React.ReactElement<{ sx?: object }>, {
                    sx: {
                        fontSize: sizeConf.iconSize,
                        color: config.color,
                    },
                })}
            </Box>

            {/* Title */}
            <Typography
                variant={size === 'large' ? 'h4' : size === 'small' ? 'h6' : 'h5'}
                sx={{
                    fontWeight: fontWeight.semibold,
                    color: 'text.primary',
                    mb: 1,
                }}
            >
                {finalTitle}
            </Typography>

            {/* Message */}
            <Typography
                variant="body2"
                sx={{
                    color: 'text.secondary',
                    maxWidth: 400,
                    mb: 3,
                    fontSize: getResponsiveFontSize('sm'),
                }}
            >
                {finalMessage}
            </Typography>

            {/* Actions */}
            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    mb: details ? 2 : 0,
                }}
            >
                {onRetry && (
                    <Button
                        variant="contained"
                        onClick={onRetry}
                        startIcon={<Icon icon="mdi:refresh" width={18} />}
                        sx={{ transition: transitions.button }}
                    >
                        {retryLabel}
                    </Button>
                )}
                {onGoBack && (
                    <Button
                        variant="outlined"
                        onClick={onGoBack}
                        startIcon={<Icon icon="mdi:arrow-left" width={18} />}
                        sx={{ transition: transitions.button }}
                    >
                        Quay lại
                    </Button>
                )}
                {onContactSupport && (
                    <Button
                        variant="text"
                        onClick={onContactSupport}
                        sx={{
                            color: 'text.secondary',
                            transition: transitions.button,
                            '&:hover': { color: 'primary.main' },
                        }}
                    >
                        Liên hệ hỗ trợ
                    </Button>
                )}
            </Box>

            {/* Technical Details */}
            {details && (
                <Box sx={{ width: '100%', maxWidth: 500 }}>
                    <Button
                        size="small"
                        onClick={() => setShowDetails(!showDetails)}
                        sx={{
                            color: 'text.disabled',
                            fontSize: getResponsiveFontSize('xs'),
                            '&:hover': { color: 'text.secondary' },
                        }}
                    >
                        {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết lỗi'}
                    </Button>
                    <Collapse in={showDetails}>
                        <Box
                            sx={{
                                mt: 1,
                                p: 2,
                                backgroundColor: alpha(theme.palette.error.main, 0.05),
                                borderRadius: borderRadius.md,
                                border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
                            }}
                        >
                            <Typography
                                variant="caption"
                                component="pre"
                                sx={{
                                    fontFamily: 'monospace',
                                    fontSize: getResponsiveFontSize('xs'),
                                    color: 'text.secondary',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    textAlign: 'left',
                                    m: 0,
                                }}
                            >
                                {details}
                            </Typography>
                        </Box>
                    </Collapse>
                </Box>
            )}

            {/* Additional content */}
            {children}
        </Box>
    );
}
