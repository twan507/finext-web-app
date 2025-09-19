'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertColor } from '@mui/material/Alert';
import { formatErrorForUser, logError } from 'utils/errorHandler';

interface NotificationContextType {
    showNotification: (message: string, severity?: AlertColor) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notification, setNotification] = useState<{
        open: boolean;
        message: string;
        severity: AlertColor;
    }>({
        open: false,
        message: '',
        severity: 'info',
    });

    const showNotification = useCallback((message: string, severity: AlertColor = 'info') => {
        setNotification({
            open: true,
            message,
            severity,
        });
    }, []);

    const handleClose = useCallback((event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setNotification(prev => ({ ...prev, open: false }));
    }, []);

    // Global error handler
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            const error = event.error || { message: event.message };
            const errorInfo = formatErrorForUser(error);

            logError(error, 'GlobalErrorHandler');

            if (errorInfo.shouldShowToUser) {
                showNotification(errorInfo.userMessage, errorInfo.severity);
            }
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason;
            const errorInfo = formatErrorForUser(error);

            logError(error, 'UnhandledRejection');

            if (errorInfo.shouldShowToUser) {
                showNotification(errorInfo.userMessage, errorInfo.severity);
                event.preventDefault(); // Prevent console error for handled cases
            }
        };

        // Add global error listeners
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [showNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <Snackbar
                open={notification.open}
                autoHideDuration={
                    notification.severity === 'error' || notification.severity === 'warning'
                        ? 6000  // Hiển thị lâu hơn cho lỗi và cảnh báo
                        : 4000  // Hiển thị bình thường cho info và success
                }
                onClose={handleClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleClose}
                    severity={notification.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}