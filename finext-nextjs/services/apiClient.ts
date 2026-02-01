// finext-nextjs/services/apiClient.ts
import queryString from 'query-string';
import { ApiErrorResponse, IRequest, StandardApiResponse, LoginResponse } from 'services/core/types';
import { getAccessToken, updateAccessToken, clearSession } from './core/session';
import { API_BASE_URL } from './core/config';

// ========== Cache Types & Storage ==========
interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    url: string;
}

// Cache storage cho REST API
const apiCache = new Map<string, CacheEntry>();

// Cache constants
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ========== Cache Helper Functions ==========

/**
 * Tạo cache key từ URL và query params
 */
function getCacheKey(url: string, queryParams?: Record<string, any>): string {
    const paramStr = queryParams && Object.keys(queryParams).length > 0
        ? `_${queryString.stringify(queryParams)}`
        : '';
    return `api_${url}${paramStr}`;
}

/**
 * Lấy dữ liệu từ cache (nếu có và chưa hết hạn)
 */
export function getFromCache<T = any>(
    url: string,
    queryParams?: Record<string, any>,
    ttl: number = DEFAULT_CACHE_TTL
): T | null {
    const cacheKey = getCacheKey(url, queryParams);
    const entry = apiCache.get(cacheKey);

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > ttl) {
        // Cache đã hết hạn
        apiCache.delete(cacheKey);
        return null;
    }

    return entry.data as T;
}

/**
 * Lưu dữ liệu vào cache
 */
export function setToCache<T = any>(
    url: string,
    data: T,
    queryParams?: Record<string, any>
): void {
    const cacheKey = getCacheKey(url, queryParams);
    apiCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        url
    });
}

/**
 * Xóa cache cho một URL cụ thể hoặc toàn bộ
 */
export function clearApiCache(url?: string): void {
    if (url) {
        // Xóa tất cả cache entries có URL này
        const entries = Array.from(apiCache.entries());
        entries.forEach(([key, entry]) => {
            if (entry.url === url || key.startsWith(`api_${url}`)) {
                apiCache.delete(key);
            }
        });
    } else {
        // Xóa toàn bộ cache
        apiCache.clear();
    }
}

/**
 * Lấy thông tin debug về cache
 */
export function getApiCacheDebugInfo(): {
    cacheEntries: number;
    keys: string[];
} {
    return {
        cacheEntries: apiCache.size,
        keys: Array.from(apiCache.keys())
    };
}

// ========== Token Refresh Logic ==========
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; props: IRequest }> = [];

const processQueue = (error: any | null, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            const newHeaders = { ...prom.props.headers };
            if (token) {
                newHeaders['Authorization'] = `Bearer ${token}`;
            }
            _sendRequest({ ...prom.props, headers: newHeaders }).then(prom.resolve).catch(prom.reject);
        }
    });
    failedQueue = [];
};

// ========== Core Request Function ==========
const _sendRequest = async <TResponseData = any>(
    props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
    let {
        url, method, body, queryParams = {}, headers = {}, nextOption = {},
        responseType = 'json', isFormData = false, isUrlEncoded = false,
        requireAuth = true, withCredentials = false,
    } = props;

    const finalUrl = `${API_BASE_URL}${url}${Object.keys(queryParams).length ? `?${queryString.stringify(queryParams)}` : ''}`;
    const requestHeaders = new Headers(headers);
    let processedBody: BodyInit | null = null;

    if (body) {
        if (isFormData && body instanceof FormData) {
            processedBody = body;
            requestHeaders.delete('Content-Type');
        } else if (isUrlEncoded && body instanceof URLSearchParams) {
            requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
            processedBody = body.toString();
        } else if (typeof body === 'object' && !isFormData && !isUrlEncoded && !requestHeaders.has('Content-Type')) {
            requestHeaders.set('Content-Type', 'application/json');
            processedBody = JSON.stringify(body);
        } else if (typeof body === 'object' && !isFormData && !isUrlEncoded && requestHeaders.get('Content-Type') === 'application/json') {
            processedBody = JSON.stringify(body);
        } else {
            processedBody = body as BodyInit;
        }
    }

    if (requireAuth && !requestHeaders.has('Authorization')) {
        const token = getAccessToken();
        const noAuthRequiredPaths = ['/api/v1/auth/login', '/api/v1/auth/refresh-token', '/api/v1/auth/google/callback'];
        if (token) {
            requestHeaders.set('Authorization', `Bearer ${token}`);
        } else if (!noAuthRequiredPaths.some(path => url.includes(path))) {
            throw { statusCode: 401, message: "Authorization required, but no token found." } as ApiErrorResponse;
        }
    }

    const options: RequestInit = {
        method: method,
        headers: requestHeaders,
        body: processedBody,
        ...nextOption,
        credentials: withCredentials ? 'include' : (requireAuth ? 'same-origin' : 'omit'),
    };

    try {
        const res = await fetch(finalUrl, options);
        if (res.ok) {
            if (responseType === 'json') {
                const jsonData = await res.json();
                if (url.includes('/api/v1/auth/login') || url.includes('/api/v1/auth/refresh-token') || url.includes('/api/v1/auth/google/callback')) {
                    let message = "Thao tác thành công.";
                    if (url.includes('/api/v1/auth/login')) message = "Đăng nhập thành công.";
                    else if (url.includes('/api/v1/auth/refresh-token')) message = "Làm mới token thành công.";
                    else if (url.includes('/api/v1/auth/google/callback')) message = "Đăng nhập Google thành công, token được trả về.";

                    return {
                        status: res.status,
                        message: message,
                        data: jsonData as TResponseData,
                    } as StandardApiResponse<TResponseData>;
                }
                return jsonData as StandardApiResponse<TResponseData>;
            }
            if (responseType === 'blob') {
                return { status: res.status, data: await res.blob() as any, message: "Blob received successfully." } as StandardApiResponse<TResponseData>;
            }
            if (responseType === 'text') {
                return { status: res.status, data: await res.text() as any, message: "Text received successfully." } as StandardApiResponse<TResponseData>;
            }
            return await res.json() as StandardApiResponse<TResponseData>;
        } else {
            let errorJson: any = {};
            try {
                errorJson = await res.json();
            } catch (e) {
                errorJson.message = await res.text().catch(() => res.statusText);
            }
            throw {
                statusCode: res.status,
                message: errorJson?.message || errorJson?.detail || res.statusText,
                errorDetails: errorJson?.data || errorJson
            } as ApiErrorResponse;
        }
    } catch (error: any) {
        if (error.statusCode) {
            throw error;
        }
        throw {
            statusCode: error.statusCode || 503,
            message: error.message || "Network or server connection error.",
            errorDetails: error
        } as ApiErrorResponse;
    }
};

// ========== Extended Request Options ==========
export interface IRequestWithCache extends IRequest {
    /** Có sử dụng cache không (default: true cho GET, false cho các method khác) */
    useCache?: boolean;
    /** Cache TTL in ms (default: 5 minutes) */
    cacheTtl?: number;
    /** Bỏ qua cache và fetch mới (default: false) */
    skipCache?: boolean;
}

// ========== Main API Client with Cache ==========
export const apiClient = async <TResponseData = any>(
    props: IRequestWithCache
): Promise<StandardApiResponse<TResponseData>> => {
    const {
        useCache = props.method === 'GET',
        cacheTtl = DEFAULT_CACHE_TTL,
        skipCache = false,
        ...requestProps
    } = props;

    const { url, queryParams, method } = requestProps;

    // ===== 1. Check cache trước nếu là GET request và useCache = true =====
    if (method === 'GET' && useCache && !skipCache) {
        const cachedData = getFromCache<StandardApiResponse<TResponseData>>(url, queryParams, cacheTtl);
        if (cachedData !== null) {
            return cachedData;
        }
    }

    // ===== 2. Thực hiện request =====
    try {
        const response = await _sendRequestWithRefresh<TResponseData>(requestProps);

        // ===== 3. Cache response nếu là GET request thành công =====
        if (method === 'GET' && useCache && response.data !== undefined) {
            setToCache(url, response, queryParams);
        }

        // ===== 4. Invalidate cache khi có mutation (POST, PUT, DELETE, PATCH) =====
        if (method !== 'GET') {
            // Xóa cache liên quan đến URL này
            clearApiCache(url);
        }

        return response;
    } catch (error) {
        throw error;
    }
};

// ========== Request with Token Refresh ==========
const _sendRequestWithRefresh = async <TResponseData = any>(
    props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
    try {
        return await _sendRequest<TResponseData>(props);
    } catch (error) {
        const apiError = error as ApiErrorResponse;
        const originalRequestProps = { ...props };

        const noRefreshPaths = ['/api/v1/auth/login', '/api/v1/auth/refresh-token', '/api/v1/auth/google/callback'];
        const is401 = apiError?.statusCode === 401;
        const needsAuth = originalRequestProps.requireAuth !== false;
        const isRefreshablePath = !noRefreshPaths.some(path => originalRequestProps.url.includes(path));

        if (is401 && needsAuth && isRefreshablePath) {
            if (!isRefreshing) {
                isRefreshing = true;
                refreshPromise = (async () => {
                    try {
                        const refreshResponseStandard = await _sendRequest<LoginResponse>({
                            url: '/api/v1/auth/refresh-token',
                            method: 'POST',
                            requireAuth: false,
                            withCredentials: true,
                        });

                        if (refreshResponseStandard.data?.access_token) {
                            updateAccessToken(refreshResponseStandard.data.access_token);
                            processQueue(null, refreshResponseStandard.data.access_token);
                            return refreshResponseStandard.data.access_token;
                        } else {
                            throw new Error(refreshResponseStandard.message || "Refresh token response did not contain access_token.");
                        }
                    } catch (e: any) {
                        processQueue(e, null);
                        clearSession();
                        throw e instanceof Error ? e : new Error(e.message || 'Refresh token failed');
                    } finally {
                        isRefreshing = false;
                    }
                })();
            }

            try {
                const newAccessToken = await refreshPromise;
                if (newAccessToken) {
                    const newHeaders = { ...originalRequestProps.headers, Authorization: `Bearer ${newAccessToken}` };
                    return await _sendRequest<TResponseData>({ ...originalRequestProps, headers: newHeaders });
                } else {
                    throw apiError;
                }
            } catch (refreshProcessError) {
                throw refreshProcessError;
            }
        }
        throw error;
    }
};
