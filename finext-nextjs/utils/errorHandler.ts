/**
 * Utility functions for handling and formatting errors in a user-friendly way
 */

export interface ErrorInfo {
    userMessage: string;
    severity: 'error' | 'warning' | 'info';
    shouldShowToUser: boolean;
    logLevel: 'error' | 'warn' | 'info';
}

/**
 * Formats error messages in a user-friendly way
 */
export function formatErrorForUser(error: any): ErrorInfo {
    // Handle empty error objects or null/undefined
    if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
        return {
            userMessage: 'Đã có lỗi không xác định xảy ra. Vui lòng thử lại sau.',
            severity: 'error',
            shouldShowToUser: true,
            logLevel: 'error'
        };
    }

    const errorMessage = error?.message || error?.detail || String(error);
    const statusCode = error?.statusCode || error?.status;

    // Handle empty or meaningless error messages
    if (!errorMessage || errorMessage === '[object Object]' || errorMessage === 'undefined' || errorMessage === 'null') {
        return {
            userMessage: 'Đã có lỗi không xác định xảy ra. Vui lòng thử lại sau.',
            severity: 'error',
            shouldShowToUser: true,
            logLevel: 'error'
        };
    }

    // Authentication/Authorization errors
    if (statusCode === 401 ||
        errorMessage.includes('Invalid refresh token session') ||
        errorMessage.includes('Session not found') ||
        errorMessage.includes('Session không tồn tại') ||
        errorMessage.includes('session not found') ||
        errorMessage.includes('Authorization required') ||
        errorMessage.includes('Unauthorized')) {
        return {
            userMessage: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
            severity: 'warning',
            shouldShowToUser: true,
            logLevel: 'info'
        };
    }

    // Network/Connection errors
    if (statusCode >= 500 ||
        errorMessage.includes('Network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('ERR_NETWORK') ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED')) {
        return {
            userMessage: 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.',
            severity: 'error',
            shouldShowToUser: true,
            logLevel: 'error'
        };
    }

    // Bad request errors
    if (statusCode >= 400 && statusCode < 500) {
        return {
            userMessage: errorMessage.includes('validate') || errorMessage.includes('required')
                ? 'Thông tin không hợp lệ. Vui lòng kiểm tra lại.'
                : 'Yêu cầu không hợp lệ. Vui lòng thử lại.',
            severity: 'warning',
            shouldShowToUser: true,
            logLevel: 'warn'
        };
    }

    // Silent errors that shouldn't be shown to user
    if (errorMessage.includes('Non-Error promise rejection captured') ||
        errorMessage.includes('ResizeObserver') ||
        errorMessage.includes('Script error') ||
        errorMessage.includes('ChunkLoadError') ||
        errorMessage.includes('empty') ||
        errorMessage === '' ||
        errorMessage === 'undefined' ||
        errorMessage === 'null') {
        return {
            userMessage: '',
            severity: 'info',
            shouldShowToUser: false,
            logLevel: 'info'
        };
    }

    // Generic error fallback
    return {
        userMessage: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
        severity: 'error',
        shouldShowToUser: true,
        logLevel: 'error'
    };
}

/**
 * Checks if an error is meaningful (not empty or null)
 */
export function isValidError(error: any): boolean {
    if (!error) return false;
    if (typeof error === 'object' && Object.keys(error).length === 0) return false;
    if (error === 'undefined' || error === 'null' || error === '') return false;
    return true;
}

/**
 * Logs error with appropriate level, with better handling for empty errors
 */
export function logError(error: any, context?: string) {
    const prefix = context ? `[${context}]` : '';

    // Handle empty error objects more gracefully
    if (!isValidError(error)) {
        // Only log in development and with lower severity
        if (process.env.NODE_ENV === 'development') {
            console.warn(`${prefix} Empty or invalid error object encountered - this might indicate a promise rejection with no actual error`);
        }
        return;
    }

    const errorInfo = formatErrorForUser(error);

    switch (errorInfo.logLevel) {
        case 'error':
            console.error(`${prefix} Error:`, {
                message: error?.message || 'No message',
                status: error?.status || error?.statusCode || 'No status',
                stack: error?.stack || 'No stack',
                fullError: error
            });
            break;
        case 'warn':
            console.warn(`${prefix} Warning:`, {
                message: error?.message || 'No message',
                status: error?.status || error?.statusCode || 'No status',
                fullError: error
            });
            break;
        case 'info':
            console.info(`${prefix} Info:`, {
                message: error?.message || 'No message',
                status: error?.status || error?.statusCode || 'No status',
                fullError: error
            });
            break;
    }
}

/**
 * Safely logs error only if it's meaningful and should be logged
 */
export function safeLogError(error: any, context?: string): boolean {
    if (!isValidError(error)) {
        return false;
    }

    const errorInfo = formatErrorForUser(error);

    // Don't log silent errors that shouldn't be shown to user
    if (!errorInfo.shouldShowToUser && errorInfo.logLevel === 'info') {
        return false;
    }

    logError(error, context);
    return true;
}

/**
 * Checks if an error is related to authentication
 */
export function isAuthError(error: any): boolean {
    const errorMessage = error?.message || error?.detail || String(error);
    const statusCode = error?.statusCode || error?.status;

    return statusCode === 401 ||
        errorMessage.includes('Invalid refresh token session') ||
        errorMessage.includes('Session not found') ||
        errorMessage.includes('Authorization required') ||
        errorMessage.includes('Unauthorized');
}

/**
 * Checks if an error is a network/connection error
 */
export function isNetworkError(error: any): boolean {
    const errorMessage = error?.message || error?.detail || String(error);
    const statusCode = error?.statusCode || error?.status;

    return statusCode >= 500 ||
        errorMessage.includes('Network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('ERR_NETWORK') ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED');
}