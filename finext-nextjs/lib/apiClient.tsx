// finext-nextjs/lib/apiClient.ts
import { handleRefreshToken } from './authService';
import { ApiErrorResponse, IRequest, sendRequest, StandardApiResponse } from './sendRequest';

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
            sendRequest(prom.props).then(prom.resolve).catch(prom.reject);
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
                        resolve(await sendRequest<TResponseData>(originalRequest));
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