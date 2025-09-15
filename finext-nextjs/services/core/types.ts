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
  withCredentials?: boolean;
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

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// Định nghĩa User type để dùng chung
// Phản ánh UserPublic từ backend FastAPI (với subscription_id)
export interface UserSchema {
  id: string; // Trước là PyObjectId, ở frontend là string
  role_ids: string[]; // List[PyObjectId] -> List[string]
  full_name: string;
  email: string;
  phone_number?: string | null; // Optional như trong backend
  avatar_url?: string | null; // Thêm avatar_url property
  referral_code?: string | null; // Thêm referral_code property
  google_id?: string | null; // Thêm google_id property
  subscription_id?: string | null; // THAY ĐỔI: từ license_info sang subscription_id
  is_active?: boolean; // Thêm nếu backend trả về
  created_at?: string; // Thêm nếu backend trả về
  updated_at?: string; // Thêm updated_at property
}


// --- SSE Types (Giữ nguyên) ---
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

// THÊM TYPES CHO SUBSCRIPTION (phản ánh SubscriptionPublic từ backend)
export interface SubscriptionSchema {
  id: string; // PyObjectId -> string
  user_id: string; // PyObjectId -> string
  user_email: string;
  license_id: string; // PyObjectId -> string
  license_key: string;
  is_active: boolean;
  start_date: string; // datetime -> string (ISO format)
  expiry_date: string; // datetime -> string (ISO format)
  created_at: string; // datetime -> string (ISO format)
  updated_at: string; // datetime -> string (ISO format)
}