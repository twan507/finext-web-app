// finext-nextjs/app/services/apiClient.ts
import queryString from 'query-string';
import { ApiErrorResponse, IRequest, StandardApiResponse, LoginResponse } from 'services/core/types';
import { getAccessToken, updateAccessToken, clearSession } from './core/session';
import { API_BASE_URL } from './core/config';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; props: IRequest }> = [];

const _refreshTokenInternal = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (res.ok) {
      const response = (await res.json()) as StandardApiResponse<LoginResponse>;
      if (response.data?.access_token) {
        updateAccessToken(response.data.access_token);
        // console.log("Token refreshed successfully."); // Log này có thể giữ lại nếu muốn theo dõi thành công
        return response.data.access_token;
      }
    }
    // console.error(`_refreshTokenInternal: Fetch response NOT OK or no access_token. Status: ${res.status}`);
    throw new Error(`Failed to refresh token, status: ${res.status}`);
  } catch (error) {
    // console.error("_refreshTokenInternal: CATCH BLOCK. Error during refresh:", error);
    clearSession();
    if (typeof window !== 'undefined') {
      // Cân nhắc việc có nên tự động redirect ở đây không,
      // hoặc để cho AuthProvider xử lý dựa trên việc session bị clear.
      // window.location.href = '/login';
      console.error("Refresh token failed, redirecting to login might be needed or handled by AuthProvider.");
    }
    return null;
  }
  // finally {
  // console.log("### _refreshTokenInternal: FINALLY BLOCK ###");
  // }
};

const _handleRefreshToken = async (): Promise<string | null> => {
  // console.log("--- _handleRefreshToken START ---");
  // console.log("Current isRefreshing state:", isRefreshing);
  // console.log("Current refreshPromise value:", refreshPromise);

  if (!isRefreshing) {
    // console.log("_handleRefreshToken: isRefreshing is false, proceeding to call _refreshTokenInternal.");
    isRefreshing = true;
    try {
      // console.log("_handleRefreshToken: Assigning to refreshPromise...");
      refreshPromise = _refreshTokenInternal();
      // console.log("_handleRefreshToken: refreshPromise assigned.");

      refreshPromise.finally(() => {
        // console.log("_handleRefreshToken (after refreshPromise resolved/rejected): Setting isRefreshing to false.");
        isRefreshing = false;
      });

    } catch (error) {
      // console.error("_handleRefreshToken: Error during _refreshTokenInternal call or promise assignment", error);
      isRefreshing = false;
      refreshPromise = Promise.resolve(null);
    }
  } else {
    // console.log("_handleRefreshToken: isRefreshing is true, returning existing refreshPromise.");
    if (!refreshPromise) {
      // console.error("_handleRefreshToken: isRefreshing is true, BUT refreshPromise is NULL/UNDEFINED!");
      isRefreshing = false; // Reset để thử lại
      return null;
    }
  }
  // console.log("--- _handleRefreshToken END --- Returning refreshPromise");
  return refreshPromise;
};

const processQueue = (error: any | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.props.headers = { ...prom.props.headers, Authorization: `Bearer ${token}` };
      _sendRequest(prom.props).then(prom.resolve).catch(prom.reject);
    }
  });
  failedQueue = [];
};

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

export const apiClient = async <TResponseData = any>(
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
  try {
    return await _sendRequest<TResponseData>(props);
  } catch (error) {
    const apiError = error as ApiErrorResponse;
    const originalRequest = { ...props };

    // console.log("--- apiClient CATCH ---");
    // console.log("Caught Error:", JSON.stringify(apiError, null, 2));
    // console.log("Original Request URL:", originalRequest.url);
    // console.log("Original Request requireAuth:", originalRequest.requireAuth);

    const noRefreshPaths = ['/api/v1/auth/refresh-token', '/api/v1/auth/login'];
    const is401 = apiError?.statusCode === 401;
    const needsAuth = originalRequest.requireAuth !== false;
    const isRefreshablePath = !noRefreshPaths.some(path => originalRequest.url.includes(path));

    // console.log("Check: is401?", is401);
    // console.log("Check: needsAuth?", needsAuth);
    // console.log("Check: isRefreshablePath?", isRefreshablePath);

    if (is401 && needsAuth && isRefreshablePath) {
      // console.warn("apiClient: Condition MET. Attempting refresh for:", originalRequest.url);
      // console.log("apiClient: Calling _handleRefreshToken directly...");

      return new Promise<StandardApiResponse<TResponseData>>(async (resolve, reject) => {
        try {
          const newAccessToken = await _handleRefreshToken();
          // console.log("apiClient: _handleRefreshToken returned:", newAccessToken ? "Token received" : newAccessToken);

          if (newAccessToken) {
            // console.log("apiClient: Refresh SUCCESS. Retrying original request with new token...");
            processQueue(null, newAccessToken);
            originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newAccessToken}` };
            resolve(await _sendRequest<TResponseData>(originalRequest));
          } else {
            // console.error("apiClient: Refresh FAILED (newAccessToken is null/empty). Rejecting original request with original error.");
            processQueue(apiError, null);
            reject(apiError);
          }
        } catch (refreshError: any) {
          // console.error("apiClient: Refresh FAILED (exception caught during/after _handleRefreshToken). Rejecting with refreshError.", refreshError);
          processQueue(refreshError, null);
          reject(refreshError);
        }
      });
    }

    // console.error("apiClient: Condition NOT MET. Re-throwing original error.");
    throw error;
  }
};