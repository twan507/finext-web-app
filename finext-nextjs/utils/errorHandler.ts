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
        errorMessage.includes('ChunkLoadError')) {
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
 * Logs error with appropriate level
 */
export function logError(error: any, context?: string) {
    const errorInfo = formatErrorForUser(error);
    const prefix = context ? `[${context}]` : '';

    // Handle empty error objects
    if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
        if (process.env.NODE_ENV === 'development') {
            console.warn(`${prefix} Empty error object encountered - this may indicate an issue with error handling in the calling code`);
            console.trace('Stack trace for empty error object:');
        }
        return;
    }

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

/**
 * Safe error handler that prevents empty error objects from causing issues
 */
export function safeHandleError(error: any, context?: string, fallbackMessage?: string): ErrorInfo {
    // Handle empty error objects
    if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
        const meaningfulError = new Error(fallbackMessage || 'Unknown error occurred');

        if (process.env.NODE_ENV === 'development') {
            console.warn(`[${context || 'SafeErrorHandler'}] Empty error object replaced with meaningful error`);
        }

        return {
            userMessage: fallbackMessage || 'An unexpected error occurred',
            severity: 'warning' as const,
            shouldShowToUser: true,
            logLevel: 'warn' as const
        };
    }

    return formatErrorForUser(error);
}

/**
 * Check if an error should be logged (not empty or meaningless)
 */
export function shouldLogError(error: any): boolean {
    // Don't log if error is null, undefined
    if (!error) return false;

    // Don't log if error is empty object
    if (typeof error === 'object' && Object.keys(error).length === 0) return false;

    // Don't log if error is empty string
    if (typeof error === 'string' && error.trim() === '') return false;

    return true;
}

/**
 * Safe log error function that checks if error should be logged
 */
export function safeLogError(error: any, context: string = 'Unknown context'): void {
    if (shouldLogError(error)) {
        logError(error, context);
    } else if (process.env.NODE_ENV === 'development') {
        console.warn(`[${context}] Empty or invalid error object detected:`, error);
    }
}