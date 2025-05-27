// finext-nextjs/app/services/apiClient.ts
import queryString from 'query-string';
// SỬA: Bỏ JWTTokenResponse khỏi import, LoginResponse đã có sẵn và sẽ được dùng
import { ApiErrorResponse, IRequest, StandardApiResponse, LoginResponse } from 'services/core/types';
import { getAccessToken, updateAccessToken, clearSession } from './core/session';
import { API_BASE_URL } from './core/config';

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
      _sendRequest({...prom.props, headers: newHeaders}).then(prom.resolve).catch(prom.reject);
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
    if (isFormData && body instanceof FormData) { 
        processedBody = body; 
        requestHeaders.delete('Content-Type');
    } else if (isUrlEncoded && body instanceof URLSearchParams) { 
        requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8'); 
        processedBody = body.toString(); 
    } else if (typeof body === 'object' && !requestHeaders.has('Content-Type')) { 
        requestHeaders.set('Content-Type', 'application/json'); 
        processedBody = JSON.stringify(body); 
    } else { 
        processedBody = body as BodyInit; 
    }
  }

  if (requireAuth && !requestHeaders.has('Authorization')) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    } else if (url !== '/api/v1/auth/login' && url !== '/api/v1/auth/refresh-token') { 
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
        if (url === '/api/v1/auth/login' || url === '/api/v1/auth/refresh-token') {
          // jsonData ở đây là LoginResponse (hoặc JWTTokenResponse) thuần túy: { access_token: string, token_type: string }
          // Bọc nó lại thành StandardApiResponse
          return {
            status: res.status,
            message: url === '/api/v1/auth/login' ? "Đăng nhập thành công." : "Làm mới token thành công.",
            data: jsonData as TResponseData, // Cast jsonData (LoginResponse) sang TResponseData
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
        message: errorJson?.message || res.statusText, 
        errorDetails: errorJson?.data || errorJson?.detail || errorJson 
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

export const apiClient = async <TResponseData = any>(
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
  try {
    return await _sendRequest<TResponseData>(props);
  } catch (error) {
    const apiError = error as ApiErrorResponse;
    const originalRequestProps = { ...props }; 

    const noRefreshPaths = ['/api/v1/auth/login', '/api/v1/auth/refresh-token'];
    const is401 = apiError?.statusCode === 401;
    const needsAuth = originalRequestProps.requireAuth !== false; 
    const isRefreshablePath = !noRefreshPaths.some(path => originalRequestProps.url.includes(path));

    if (is401 && needsAuth && isRefreshablePath) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            // SỬA: Sử dụng LoginResponse vì _sendRequest sẽ trả về StandardApiResponse<LoginResponse>
            // cho endpoint /refresh-token. data bên trong sẽ có cấu trúc của LoginResponse.
            const refreshResponse = await _sendRequest<LoginResponse>({
              url: '/api/v1/auth/refresh-token',
              method: 'POST',
              requireAuth: false, 
              withCredentials: true, 
            });

            // refreshResponse.data ở đây là LoginResponse { access_token: string, token_type: string }
            if (refreshResponse.data?.access_token) {
              updateAccessToken(refreshResponse.data.access_token);
              processQueue(null, refreshResponse.data.access_token);
              return refreshResponse.data.access_token;
            } else {
              throw new Error(refreshResponse.message || "Refresh token response did not contain access_token.");
            }
          } catch (e: any) {
            processQueue(e, null); 
            clearSession(); 
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
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