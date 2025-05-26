// finext-nextjs/app/services/core/types.ts

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
  withCredentials?: boolean; // THÊM FLAG NÀY
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

// Chỉ chứa access_token
export interface LoginResponse {
    access_token: string;
    token_type: string;
}

// Bỏ RefreshTokenResponse vì không còn dùng

// --- Giữ nguyên các type SSE ---
export interface ISseRequest {
  url: string;
  queryParams?: Record<string, any>;
  requireAuth?: boolean;
}
export interface SseError {
  type: 'EventSourceError' | 'ParseError' | 'ServerError' | 'InitializationError';
  message: string;
  originalEvent?: Event | string;
}
export type SseDataCallback<DataType = any> = (data: DataType) => void;
export type SseErrorCallback = (error: SseError) => void;
export type SseOpenCallback = () => void;
export type SseCloseCallback = () => void;
export interface ISseCallbacks<DataType = any> {
  onData: SseDataCallback<DataType>;
  onError: SseErrorCallback;
  onOpen: SseOpenCallback;
  onClose: SseCloseCallback;
}
export interface ISseConnection {
  close: () => void;
  getEventSource: () => EventSource | null;
}