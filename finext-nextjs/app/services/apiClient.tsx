// finext-nextjs/lib/apiClient.ts
// import { ApiErrorResponse, IRequest, sendRequest, StandardApiResponse } from './sendRequest';
import { handleRefreshToken } from './authService';
import queryString from 'query-string';
import { ApiErrorResponse, IRequest, StandardApiResponse } from 'app/services/core/types';
import { getAccessToken } from './core/session';
import { API_BASE_URL } from './core/config';


const _sendRequest = async <TResponseData = any>(
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
  let {
    url,
    method,
    body,
    queryParams = {},
    headers = {},
    nextOption = {},
    responseType = 'json',
    isFormData = false,
    isUrlEncoded = false,
    requireAuth = true,
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

  // Chỉ thêm token, không xử lý 401 ở đây
  if (requireAuth && !requestHeaders.has('Authorization')) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    } else {
      // Nếu yêu cầu auth mà không có token, ném lỗi 401 để interceptor bắt
      throw {
        statusCode: 401,
        message: "Authorization required, but no token found.",
      } as ApiErrorResponse;
    }
  }

  const options: RequestInit = {
    method: method,
    headers: requestHeaders,
    body: processedBody,
    ...nextOption,
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
      try {
        errorJson = await res.json();
      } catch (e) {
        errorJson.message = await res.text().catch(() => res.statusText);
      }

      const errorToThrow: ApiErrorResponse = {
        statusCode: res.status,
        message: errorJson?.message || res.statusText || "Lỗi không xác định từ server",
        errorDetails: errorJson?.data || errorJson?.detail || errorJson,
      };
      throw errorToThrow; // Ném lỗi để interceptor bắt
    }
  } catch (error: any) {
    if (error && typeof error.statusCode === 'number') {
      throw error;
    }
    throw {
      statusCode: error.status || 503,
      message: error.message || "Lỗi mạng hoặc không thể kết nối đến máy chủ.",
      errorDetails: error,
    } as ApiErrorResponse;
  }
};

let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; props: IRequest }> = [];
let isRefreshing = false;

const processQueue = (error: any | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      // Thử lại request với token mới
      prom.props.headers = { ...prom.props.headers, Authorization: `Bearer ${token}` };
      // Gọi lại sendRequest trực tiếp vì token đã mới và không muốn lặp lại logic refresh
      // của apiClient cho các item trong queue.
      _sendRequest(prom.props).then(prom.resolve).catch(prom.reject);
    }
  });
  failedQueue = [];
};

export const apiClient = async <TResponseData = any>(
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
  try {
    // Luôn thử gọi bằng sendRequest trước
    return await _sendRequest<TResponseData>(props);
  } catch (error) {
    const apiError = error as ApiErrorResponse;
    const originalRequest = props;

    const noRefreshPaths = [
      '/api/v1/auth/refresh-token', // Tránh vòng lặp vô hạn khi chính refresh token thất bại
      '/api/v1/auth/login',         // Lỗi 401 khi login nghĩa là sai credentials, không phải token hết hạn
      // Thêm các endpoint khác mà cũng không cần access token (các endpiont public nhưng lại có tiềm năng bị 401):
      // '/api/v1/auth/register',      // Đăng ký không dùng access token hiện tại
      // '/api/v1/auth/forgot-password', // Luồng quên mật khẩu không dựa vào access token
      // '/api/v1/auth/verify-email', // Xác thực email không cần access token
    ];

    if (apiError.statusCode === 401 &&
      (originalRequest.requireAuth !== false) &&
      !noRefreshPaths.some(path => originalRequest.url.includes(path))) {

      if (isRefreshing) {
        // Nếu đang có một tiến trình refresh token khác chạy,
        // đưa request này vào hàng đợi và trả về một Promise mới.
        console.warn("Another refresh is in progress. Queuing request for:", originalRequest.url);
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, props: originalRequest });
        });
      }

      isRefreshing = true;
      console.warn("Received 401. Attempting to refresh token for:", originalRequest.url);

      // Trả về một Promise mới cho request gốc này,
      // nó sẽ được resolve/reject sau khi refresh xong.
      return new Promise<StandardApiResponse<TResponseData>>(async (resolve, reject) => {
        try {
          const newAccessToken = await handleRefreshToken();

          if (newAccessToken) {
            console.log("Refresh successful. Processing queue and retrying original request...");
            // Xử lý các request trong hàng đợi trước
            processQueue(null, newAccessToken);

            // Thử lại request gốc với token mới
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${newAccessToken}`,
            };
            // Gọi lại bằng sendRequest vì token đã mới
            resolve(await _sendRequest<TResponseData>(originalRequest));
          } else {
            console.error("Refresh failed (no new token). Processing queue with error and rejecting original request.");
            // Refresh thất bại, báo lỗi cho queue và reject request gốc
            processQueue(apiError, null);
            reject(apiError); // Ném lại lỗi 401 ban đầu
          }
        } catch (refreshError: any) {
          console.error("Error during refresh handling. Processing queue with error and rejecting original request:", refreshError);
          // Lỗi trong quá trình refresh, báo lỗi cho queue và reject request gốc
          processQueue(refreshError, null);
          reject(refreshError); // Ném lỗi từ quá trình refresh
        } finally {
          isRefreshing = false; // Đảm bảo reset cờ isRefreshing
        }
      });
    }

    // Nếu không phải 401 cần refresh hoặc lỗi khác, ném lại lỗi gốc
    throw error;
  }
};