// finext-nextjs/lib/sendRequest.ts
import queryString from 'query-string';
import { getAccessToken } from './session'; // Chỉ cần getAccessToken

const BASE_URL = process.env.NEXT_PUBLIC_FASTAPI_BASE_URL;

// Giữ nguyên các interface IRequest, StandardApiResponse, ApiErrorResponse
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

export const sendRequest = async <TResponseData = any>(
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

  const finalUrl = `${BASE_URL}${url}${Object.keys(queryParams).length ? `?${queryString.stringify(queryParams)}` : ''}`;

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