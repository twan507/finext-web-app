// finext-nextjs/services/apiClient.ts
import queryString from 'query-string';
import { ApiErrorResponse, IRequest, StandardApiResponse, LoginResponse } from 'services/core/types';
import { getAccessToken, updateAccessToken, clearSession } from './core/session';
import { API_BASE_URL } from './core/config';

// ========== Cache ==========
// Đã tách sang ./core/apiCache để module cache tự chứa (unit test được).
// Re-export giữ nguyên API cũ cho các import hiện có.
export {
    getFromCache,
    hasFreshCache,
    setToCache,
    clearApiCache,
    clearApiCacheWhere,
    getApiCacheDebugInfo,
    DEFAULT_CACHE_TTL,
} from './core/apiCache';
import { getFromCache, setToCache, clearApiCache, clearApiCacheWhere, DEFAULT_CACHE_TTL } from './core/apiCache';

// ========== Token Refresh Logic ==========
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

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
            if (responseType === 'stream') {
                // Trả Response thô, CHƯA đọc body — chatClient sẽ getReader(). 401 đã throw trước
                // khi tới đây nên _sendRequestWithRefresh vẫn refresh + retry được.
                return { status: res.status, data: res as any, message: 'Stream response' } as StandardApiResponse<TResponseData>;
            }
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
        // Lỗi mạng/parse (KHÔNG phải lỗi từ API): tuyệt đối không để nguyên văn kỹ thuật của
        // trình duyệt ("Failed to fetch"...) lọt ra màn hình người dùng. Chi tiết gốc vẫn giữ
        // nguyên ở errorDetails để debug.
        throw {
            statusCode: error.statusCode || 503,
            message: 'Không kết nối được tới máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.',
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

    // ===== 4. Invalidate cache when mutation (POST, PUT, DELETE, PATCH) =====
        if (method !== 'GET') {
            // Clear cache for the exact URL
            clearApiCache(url);

            // Also clear the parent resource list cache.
            // e.g. mutating /api/v1/users/123 should bust /api/v1/users/ list cache.
            const parts = url.split('/').filter(Boolean); // ['api', 'v1', 'users', '123']
            if (parts.length >= 3) {
                const resourceBase = '/' + parts.slice(0, 3).join('/') + '/'; // '/api/v1/users/'
                clearApiCache(resourceBase);
            }

            // When any admin resource is mutated, clear ALL admin-related caches
            // (dashboard stats, transactions list, subscriptions, etc.)
            if (url.includes('/admin/')) {
                clearApiCacheWhere((key) => key.includes('/admin/'));
            }
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
            // Nếu đã có refresh đang chạy, đợi nó hoàn thành rồi retry
            // Nếu chưa có, bắt đầu refresh mới
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
                            return refreshResponseStandard.data.access_token;
                        } else {
                            throw new Error(refreshResponseStandard.message || "Refresh token response did not contain access_token.");
                        }
                    } catch (e: any) {
                        // Chỉ clear session khi refresh fail vì AUTH thật sự (401)
                        // — token / session đã hết hạn. Với network/5xx (server hiccup,
                        // mạng chập chờn) giữ nguyên session để retry sau, tránh
                        // false-positive logout.
                        const statusCode = e?.statusCode;
                        if (statusCode === 401) {
                            clearSession();
                        }
                        throw e instanceof Error ? e : new Error(e.message || 'Refresh token failed');
                    } finally {
                        isRefreshing = false;
                        // Không set refreshPromise = null ở đây
                        // để các request đang đợi vẫn nhận được kết quả
                        // refreshPromise sẽ tự được GC khi không còn reference
                    }
                })();
            }

            try {
                const newAccessToken = await refreshPromise;
                // Reset refreshPromise sau khi tất cả đã nhận kết quả
                refreshPromise = null;

                if (newAccessToken) {
                    const newHeaders = { ...originalRequestProps.headers, Authorization: `Bearer ${newAccessToken}` };
                    return await _sendRequest<TResponseData>({ ...originalRequestProps, headers: newHeaders });
                } else {
                    throw apiError;
                }
            } catch (refreshProcessError) {
                refreshPromise = null;
                throw refreshProcessError;
            }
        }
        throw error;
    }
};

// ========== Streaming Request (SSE-over-POST) ==========
// Đi qua _sendRequestWithRefresh để hưởng refresh-token flow; trả Response thô cho caller tự đọc stream.
export const sendStreamRequest = async (props: Omit<IRequest, 'responseType'>): Promise<Response> => {
    const res = await _sendRequestWithRefresh<Response>({ ...props, responseType: 'stream' });
    if (!res.data) {
        throw { statusCode: 503, message: 'Không mở được luồng dữ liệu.' } as ApiErrorResponse;
    }
    return res.data;
};

