// finext-nextjs/app/services/apiClient.ts
import queryString from 'query-string';
import { ApiErrorResponse, IRequest, StandardApiResponse, LoginResponse } from 'app/services/core/types';
import { getAccessToken, updateAccessToken, clearSession } from './core/session';
import { API_BASE_URL } from './core/config';

// --- Biến toàn cục cho việc refresh ---
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; props: IRequest }> = [];

// --- Hàm xử lý Refresh Token (Nội bộ) ---
const _refreshTokenInternal = async (): Promise<string | null> => {
    console.log("Attempting internal token refresh...");
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Gửi cookie
        });

        if (res.ok) {
            const response = (await res.json()) as StandardApiResponse<LoginResponse>;
            if (response.data?.access_token) {
                updateAccessToken(response.data.access_token);
                console.log("Internal token refresh successful.");
                return response.data.access_token;
            }
        }
        throw new Error(`Failed to refresh token, status: ${res.status}`);
    } catch (error) {
        console.error("Internal refresh token API call failed:", error);
        clearSession();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        return null;
    }
};

const _handleRefreshToken = async (): Promise<string | null> => {
    if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = _refreshTokenInternal().finally(() => {
            isRefreshing = false;
        });
    }
    return refreshPromise;
};

// --- Hàm xử lý Queue ---
const processQueue = (error: any | null, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.props.headers = { ...prom.props.headers, Authorization: `Bearer ${token}` };
            // Gọi lại _sendRequest (bỏ qua interceptor)
            _sendRequest(prom.props).then(prom.resolve).catch(prom.reject);
        }
    });
    failedQueue = [];
};

// --- Hàm _sendRequest (Không thay đổi nhiều, thêm 'credentials') ---
const _sendRequest = async <TResponseData = any>(
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
  let {
    url, method, body, queryParams = {}, headers = {}, nextOption = {},
    responseType = 'json', isFormData = false, isUrlEncoded = false,
    requireAuth = true, withCredentials = false, // Thêm withCredentials
  } = props;

  const finalUrl = `${API_BASE_URL}${url}${Object.keys(queryParams).length ? `?${queryString.stringify(queryParams)}` : ''}`;
  const requestHeaders = new Headers(headers);
  let processedBody: BodyInit | null = null;

  if (body) {
      if (isFormData && body instanceof FormData) { processedBody = body; requestHeaders.delete('Content-Type'); }
      else if (isUrlEncoded && body instanceof URLSearchParams) { requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8'); processedBody = body.toString(); }
      else if (typeof body === 'object' && !requestHeaders.has('Content-Type')) { requestHeaders.set('Content-Type', 'application/json'); processedBody = JSON.stringify(body); }
      else { processedBody = body as BodyInit; }
  }

  if (requireAuth && !requestHeaders.has('Authorization')) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    } else {
      throw { statusCode: 401, message: "Authorization required, but no token found." } as ApiErrorResponse;
    }
  }

  const options: RequestInit = {
    method: method,
    headers: requestHeaders,
    body: processedBody,
    ...nextOption,
    // Thêm credentials nếu flag là true
    credentials: withCredentials ? 'include' : (requireAuth ? 'same-origin' : 'omit'),
  };

  try {
    const res = await fetch(finalUrl, options);
    if (res.ok) {
      if (responseType === 'json') return await res.json() as StandardApiResponse<TResponseData>;
      if (responseType === 'blob') return { status: res.status, data: await res.blob() as any };
      if (responseType === 'text') return { status: res.status, data: await res.text() as any };
      return await res.json() as StandardApiResponse<TResponseData>;
    } else {
      let errorJson: any = {};
      try { errorJson = await res.json(); }
      catch (e) { errorJson.message = await res.text().catch(() => res.statusText); }
      throw { statusCode: res.status, message: errorJson?.message || res.statusText, errorDetails: errorJson?.data || errorJson?.detail || errorJson } as ApiErrorResponse;
    }
  } catch (error: any) {
    throw { statusCode: error.statusCode || 503, message: error.message || "Network or server connection error.", errorDetails: error } as ApiErrorResponse;
  }
};

// --- Hàm apiClient (Logic Interceptor) ---
export const apiClient = async <TResponseData = any>(
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
  try {
    return await _sendRequest<TResponseData>(props);
  } catch (error) {
    const apiError = error as ApiErrorResponse;
    const originalRequest = { ...props }; // Copy request

    const noRefreshPaths = ['/api/v1/auth/refresh-token', '/api/v1/auth/login'];

    if (apiError.statusCode === 401 &&
        (originalRequest.requireAuth !== false) &&
        !noRefreshPaths.some(path => originalRequest.url.includes(path))) {

        if (isRefreshing) {
            console.warn("Queueing request:", originalRequest.url);
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject, props: originalRequest });
            });
        }

        console.warn("Received 401. Starting refresh for:", originalRequest.url);
        isRefreshing = true;

        return new Promise<StandardApiResponse<TResponseData>>(async (resolve, reject) => {
            try {
                const newAccessToken = await _handleRefreshToken(); // Dùng hàm nội bộ

                if (newAccessToken) {
                    processQueue(null, newAccessToken);
                    originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newAccessToken}` };
                    resolve(await _sendRequest<TResponseData>(originalRequest)); // Gọi lại _sendRequest
                } else {
                    processQueue(apiError, null);
                    reject(apiError);
                }
            } catch (refreshError: any) {
                processQueue(refreshError, null);
                reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        });
    }

    throw error; // Ném lại lỗi khác 401 hoặc lỗi 401 không cần refresh
  }
};