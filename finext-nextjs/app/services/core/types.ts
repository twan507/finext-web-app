export interface IRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  queryParams?: Record<string, any>;
  headers?: Record<string, string>;
  nextOption?: RequestInit;
  responseType?: 'json' | 'blob' | 'text';
  isFormData?: boolean;
  isUrlEncoded?: boolean;
  requireAuth?: boolean;
}

export interface StandardApiResponse<DataType = any> {
  status: number;
  message?: string;
  data?: DataType;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  errorDetails?: any;
}

export interface RefreshTokenResponse {
    token_type: string;
    access_token: string;
    refresh_token: string;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

/**
 * Interface để cấu hình việc khởi tạo một kết nối SSE.
 */
export interface ISseRequest {
  url: string; // Đường dẫn API SSE (ví dụ: /api/v1/sse/stream/my_collection)
  queryParams?: Record<string, any>; // Các tham số truy vấn
  requireAuth?: boolean; // Cờ để kiểm tra xác thực (hiện tại chưa dùng cho SSE)
}

/**
 * Đại diện cho một lỗi xảy ra trong quá trình kết nối SSE.
 */
export interface SseError {
  type: 'EventSourceError' | 'ParseError' | 'ServerError' | 'InitializationError';
  message: string;
  originalEvent?: Event | string; // Sự kiện gốc hoặc thông điệp lỗi từ server
}

/**
 * Kiểu dữ liệu cho callback xử lý dữ liệu nhận được từ SSE.
 */
export type SseDataCallback<DataType = any> = (data: DataType) => void;

/**
 * Kiểu dữ liệu cho callback xử lý lỗi.
 */
export type SseErrorCallback = (error: SseError) => void;

/**
 * Kiểu dữ liệu cho callback khi kết nối mở thành công.
 */
export type SseOpenCallback = () => void;

/**
 * Kiểu dữ liệu cho callback khi kết nối bị đóng (dù cố ý hay không).
 */
export type SseCloseCallback = () => void;

/**
 * Interface chứa các callback để xử lý các sự kiện SSE.
 */
export interface ISseCallbacks<DataType = any> {
  onData: SseDataCallback<DataType>;
  onError: SseErrorCallback;
  onOpen: SseOpenCallback;
  onClose: SseCloseCallback;
}

/**
 * Đại diện cho một kết nối SSE đang hoạt động.
 * Cung cấp phương thức để đóng kết nối.
 */
export interface ISseConnection {
  close: () => void;
  getEventSource: () => EventSource | null; // Để truy cập trực tiếp nếu cần
}