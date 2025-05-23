// finext-nextjs/lib/apiClient.ts
import { handleRefreshToken } from './authService';
import { ApiErrorResponse, IRequest, sendRequest, StandardApiResponse } from './sendRequest';

let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; props: IRequest }> = [];

const processQueue = (error: any | null, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            // Thử lại request với token mới
            prom.props.headers = { ...prom.props.headers, Authorization: `Bearer ${token}` };
            // Gọi lại apiClient (chính nó) để có thể retry refresh nếu cần
            apiClient(prom.props).then(prom.resolve).catch(prom.reject);
        }
    });
    failedQueue = [];
};

export const apiClient = async <TResponseData = any>(
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => {
    try {
        // Luôn thử gọi bằng sendRequest trước
        return await sendRequest<TResponseData>(props);
    } catch (error) {
        const apiError = error as ApiErrorResponse;
        const originalRequest = props;

        // Chỉ xử lý 401 và không phải là request refresh-token
        if (apiError.statusCode === 401 && !originalRequest.url.includes('/auth/refresh-token')) {
            console.warn("Received 401, attempting to refresh token...");

            try {
                const newAccessToken = await handleRefreshToken();

                if (newAccessToken) {
                    console.log("Refresh successful, retrying original request...");
                    // Thử lại request gốc với token mới
                    originalRequest.headers = {
                        ...originalRequest.headers,
                        Authorization: `Bearer ${newAccessToken}`,
                    };
                    // Gọi lại bằng sendRequest vì token đã mới
                    return await sendRequest<TResponseData>(originalRequest);
                } else {
                    // Refresh thất bại (handleRefreshToken đã xử lý redirect)
                    console.error("Refresh failed, throwing original 401.");
                    throw apiError; // Ném lại lỗi 401 ban đầu
                }
            } catch (refreshError: any) {
                 console.error("Error during refresh handling:", refreshError);
                 throw refreshError; // Ném lỗi từ quá trình refresh
            }
        }

        // Nếu không phải 401 hoặc lỗi khác, ném lại lỗi gốc
        throw error;
    }
};