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
