// finext-nextjs/app/services/apiClient.ts
import queryString from 'query-string';
// SỬA: Bỏ JWTTokenResponse khỏi import, LoginResponse đã có sẵn và sẽ được dùng
import { ApiErrorResponse, IRequest, StandardApiResponse, LoginResponse } from 'services/core/types'; //
import { getAccessToken, updateAccessToken, clearSession } from './core/session'; //
import { API_BASE_URL } from './core/config'; //

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
        requestHeaders.delete('Content-Type'); // Để browser tự set với boundary
    } else if (isUrlEncoded && body instanceof URLSearchParams) {
        requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        processedBody = body.toString();
    } else if (typeof body === 'object' && !isFormData && !isUrlEncoded && !requestHeaders.has('Content-Type')) { // Thêm điều kiện !isFormData và !isUrlEncoded
        requestHeaders.set('Content-Type', 'application/json');
        processedBody = JSON.stringify(body);
    } else if (typeof body === 'object' && !isFormData && !isUrlEncoded && requestHeaders.get('Content-Type') === 'application/json'){ // Đã có header application/json
        processedBody = JSON.stringify(body);
    }
     else {
        processedBody = body as BodyInit; // Cho các trường hợp khác (text, blob, etc.)
    }
  }

  if (requireAuth && !requestHeaders.has('Authorization')) {
    const token = getAccessToken();
    // THAY ĐỔI: Thêm /api/v1/auth/google/callback vào danh sách các URL không yêu cầu token ban đầu
    const noAuthRequiredPaths = ['/api/v1/auth/login', '/api/v1/auth/refresh-token', '/api/v1/auth/google/callback'];
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    } else if (!noAuthRequiredPaths.some(path => url.includes(path))) {
      // Ném lỗi nếu yêu cầu auth, không có token, và không phải là một trong các path không yêu cầu auth
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
        // THAY ĐỔI: Thêm /api/v1/auth/google/callback vào điều kiện này
        if (url.includes('/api/v1/auth/login') || url.includes('/api/v1/auth/refresh-token') || url.includes('/api/v1/auth/google/callback')) {
          // jsonData ở đây là LoginResponse (hoặc JWTTokenResponse) thuần túy
          // Bọc nó lại thành StandardApiResponse
          let message = "Thao tác thành công.";
          if (url.includes('/api/v1/auth/login')) message = "Đăng nhập thành công.";
          else if (url.includes('/api/v1/auth/refresh-token')) message = "Làm mới token thành công.";
          else if (url.includes('/api/v1/auth/google/callback')) message = "Đăng nhập Google thành công, token được trả về.";

          return {
            status: res.status, // HTTP status code (e.g., 200)
            message: message,
            data: jsonData as TResponseData, // Cast jsonData (LoginResponse) sang TResponseData
          } as StandardApiResponse<TResponseData>;
        }
        // Các endpoint khác được giả định là đã trả về StandardApiResponse từ backend
        return jsonData as StandardApiResponse<TResponseData>;
      }
      if (responseType === 'blob') {
        return { status: res.status, data: await res.blob() as any, message: "Blob received successfully." } as StandardApiResponse<TResponseData>;
      }
      if (responseType === 'text') {
        return { status: res.status, data: await res.text() as any, message: "Text received successfully." } as StandardApiResponse<TResponseData>;
      }
      // Mặc định cho các responseType khác (nếu có) hoặc nếu responseType không phải json, blob, text
      // Tuy nhiên, với responseType='json' là phổ biến nhất, các trường hợp khác ít xảy ra
      // Fallback này có thể không cần thiết nếu bạn chỉ dùng json, blob, text
      return await res.json() as StandardApiResponse<TResponseData>;
    } else {
      // Xử lý lỗi
      let errorJson: any = {};
      try {
        errorJson = await res.json();
      } catch (e) {
        // Nếu body không phải JSON hoặc rỗng
        errorJson.message = await res.text().catch(() => res.statusText);
      }
      throw {
        statusCode: res.status,
        message: errorJson?.message || errorJson?.detail || res.statusText, // Ưu tiên message từ StandardApiResponse backend
        errorDetails: errorJson?.data || errorJson // Giữ lại data lỗi nếu có từ StandardApiResponse
      } as ApiErrorResponse;
    }
  } catch (error: any) {
    // Xử lý lỗi mạng hoặc lỗi từ logic throw ở trên
    if (error.statusCode) { // Nếu là ApiErrorResponse đã được throw từ logic trên
        throw error;
    }
    // Nếu là lỗi mạng hoặc lỗi không xác định khác
    throw {
        statusCode: error.statusCode || 503, // 503 Service Unavailable
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

    const noRefreshPaths = ['/api/v1/auth/login', '/api/v1/auth/refresh-token', '/api/v1/auth/google/callback'];
    const is401 = apiError?.statusCode === 401;
    const needsAuth = originalRequestProps.requireAuth !== false;
    const isRefreshablePath = !noRefreshPaths.some(path => originalRequestProps.url.includes(path));

    if (is401 && needsAuth && isRefreshablePath) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            const refreshResponseStandard = await _sendRequest<LoginResponse>({ // _sendRequest sẽ trả về StandardApiResponse<LoginResponse>
              url: '/api/v1/auth/refresh-token',
              method: 'POST',
              requireAuth: false, // Không yêu cầu access token cho việc refresh
              withCredentials: true, // Gửi HttpOnly refresh token cookie
            });

            // refreshResponseStandard.data ở đây là LoginResponse { access_token: string, token_type: string }
            if (refreshResponseStandard.data?.access_token) {
              updateAccessToken(refreshResponseStandard.data.access_token);
              processQueue(null, refreshResponseStandard.data.access_token);
              return refreshResponseStandard.data.access_token;
            } else {
              // Trường hợp refresh thành công (status 200) nhưng không có access_token trong data (ít xảy ra)
              throw new Error(refreshResponseStandard.message || "Refresh token response did not contain access_token.");
            }
          } catch (e: any) { // Bắt lỗi từ _sendRequest (ví dụ refresh token hết hạn -> 401)
            processQueue(e, null);
            clearSession(); // Xóa session nếu refresh thất bại
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                // Chuyển hướng về login nếu refresh thất bại và không phải đang ở trang login
                // window.location.href = '/login'; // Middleware sẽ xử lý việc này
            }
            // Ném lại lỗi để request gốc cũng thất bại
            throw e instanceof Error ? e : new Error(e.message || 'Refresh token failed');
          } finally {
            isRefreshing = false;
            // Không reset refreshPromise ở đây để các request đang chờ có thể dùng kết quả
          }
        })();
      }

      // Đợi promise refresh hoàn tất và thử lại request gốc
      try {
        const newAccessToken = await refreshPromise; // Đợi refreshPromise
        if (newAccessToken) {
          const newHeaders = { ...originalRequestProps.headers, Authorization: `Bearer ${newAccessToken}` };
          return await _sendRequest<TResponseData>({ ...originalRequestProps, headers: newHeaders });
        } else {
           // Nếu newAccessToken là null (ví dụ refresh thất bại và clearSession được gọi)
           // Lúc này không nên thử lại request gốc, mà nên throw lỗi đã bắt được (apiError)
           // Hoặc lỗi từ quá trình refresh nếu nó khác
           throw apiError; // Ném lại lỗi 401 ban đầu
        }
      } catch (refreshProcessError) {
         // Bắt lỗi từ chính quá trình refresh (ví dụ network error khi gọi refresh)
         // hoặc lỗi được ném lại từ block try của refreshPromise
         throw refreshProcessError; // Ném lỗi này để request gốc nhận được
      }
    }
    // Nếu không phải lỗi 401 cần refresh, hoặc refresh thất bại, ném lỗi gốc
    throw error;
  }
};