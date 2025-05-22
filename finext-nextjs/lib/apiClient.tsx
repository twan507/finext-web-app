// filepath: finext-nextjs/lib/apiClient.ts
import queryString from 'query-string';
import { auth } from './auth'; // Để lấy access token từ NextAuth session

const BASE_URL = process.env.NEXT_PUBLIC_FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

export interface IRequest {
  url: string; // Endpoint, không bao gồm base URL
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  queryParams?: Record<string, any>;
  useCredentials?: boolean; // Sẽ không dùng trực tiếp, NextAuth xử lý credentials
  headers?: Record<string, string>;
  nextOption?: RequestInit; // Cho các tùy chọn Next.js fetch như cache, revalidate
  responseType?: 'json' | 'blob' | 'text'; // Mở rộng responseType
  isFormData?: boolean; // Cờ cho biết body là FormData object
  isUrlEncoded?: boolean; // Cờ cho biết body là URLSearchParams và cần Content-Type x-www-form-urlencoded
}

// Cấu trúc response chuẩn mà FastAPI của bạn trả về
export interface StandardApiResponse<DataType = any> {
  status: number; // HTTP status code từ payload của FastAPI
  message?: string;
  data?: DataType;
  // Thêm các trường khác nếu có trong StandardApiResponse của FastAPI
}

// Cấu trúc lỗi được ném ra bởi apiClient
export interface ApiErrorResponse {
  statusCode: number; // HTTP status code thực tế của response
  message: string;
  errorDetails?: any; // Chi tiết lỗi từ body của FastAPI response (ví dụ: exc.errors())
}

export const apiClient = async <TResponseData = any>( // TResponseData là kiểu của trường 'data' trong StandardApiResponse
  props: IRequest
): Promise<StandardApiResponse<TResponseData>> => { // Luôn trả về StandardApiResponse nếu thành công
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
  } = props;

  const finalUrl = `${BASE_URL}${url}${Object.keys(queryParams).length ? `?${queryString.stringify(queryParams)}` : ''}`;

  const requestHeaders = new Headers(headers); // Khởi tạo Headers object

  // Xử lý Content-Type và body
  let processedBody: BodyInit | null = null;

  if (body) {
    if (isFormData && body instanceof FormData) {
      // Nếu là FormData, không set Content-Type, trình duyệt sẽ tự làm
      processedBody = body;
      requestHeaders.delete('Content-Type'); // Xóa nếu có ai đó vô tình đặt
    } else if (isUrlEncoded && body instanceof URLSearchParams) {
      requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
      processedBody = body.toString();
    } else if (typeof body === 'object' && !requestHeaders.has('Content-Type')) {
      // Mặc định cho object là JSON nếu Content-Type chưa được đặt
      requestHeaders.set('Content-Type', 'application/json');
      processedBody = JSON.stringify(body);
    } else {
      // Nếu body là string hoặc Content-Type đã được đặt khác, giữ nguyên
      processedBody = body as BodyInit;
    }
  }


  // Lấy token từ NextAuth session và thêm vào header
  // Ưu tiên token trong props.headers nếu có (dùng cho trường hợp đặc biệt như khi đang authorize)
  if (!requestHeaders.has('Authorization')) {
    const session = await auth();
    const tokenFromSession = session?.accessToken;
    if (tokenFromSession) {
      requestHeaders.set('Authorization', `Bearer ${tokenFromSession}`);
    }
  }

  const options: RequestInit = {
    method: method,
    headers: requestHeaders,
    body: processedBody,
    ...nextOption, // Các tùy chọn của Next.js fetch (cache, revalidate,...)
  };

  try {
    const res = await fetch(finalUrl, options);

    if (res.ok) {
      // Đối với ứng dụng này, FastAPI luôn trả về StandardApiResponse (có status, message, data)
      // ngay cả khi thành công. Nên chúng ta luôn mong đợi cấu trúc đó.
      if (responseType === 'json') {
        const jsonResponse = await res.json();
        // Giả sử jsonResponse từ FastAPI luôn có dạng { status, message, data }
        // Nếu jsonResponse.status không phải là 2xx (ví dụ FastAPI wrapper trả về lỗi dù HTTP status là 200),
        // bạn có thể muốn xử lý thêm ở đây hoặc ném lỗi.
        // Hiện tại, giả định jsonResponse là StandardApiResponse thành công.
        return jsonResponse as StandardApiResponse<TResponseData>;
      } else if (responseType === 'blob') {
         // Trường hợp này cần suy nghĩ lại cách trả về StandardApiResponse
         // Vì res.blob() không có cấu trúc { status, message, data }
         // Có thể bạn sẽ không dùng 'blob' với cấu trúc StandardApiResponse này.
        const blobData = await res.blob();
        return { status: res.status, data: blobData as any } as StandardApiResponse<TResponseData>;
      } else if (responseType === 'text') {
        const textData = await res.text();
        return { status: res.status, data: textData as any } as StandardApiResponse<TResponseData>;
      }
      // Mặc định nếu responseType không rõ
      return await res.json() as StandardApiResponse<TResponseData>;
    } else {
      // Xử lý lỗi từ server
      let errorJson: any = {};
      try {
        errorJson = await res.json(); // Lỗi từ FastAPI (StandardApiResponse với status lỗi)
      } catch (e) {
        // Nếu không parse được JSON (ví dụ lỗi mạng server trả về text)
        errorJson.message = await res.text().catch(() => res.statusText);
      }

      const errorToThrow: ApiErrorResponse = {
        statusCode: res.status, // HTTP status code thực tế
        message: errorJson?.message || res.statusText || "Lỗi không xác định từ server",
        errorDetails: errorJson?.data || errorJson?.detail || errorJson, // Chi tiết lỗi từ FastAPI (thường trong data.detail hoặc detail)
      };
      console.error(`[apiClient] Error ${errorToThrow.statusCode} for ${method} ${finalUrl}:`, JSON.stringify(errorToThrow, null, 2));
      throw errorToThrow;
    }
  } catch (error: any) {
    // Xử lý lỗi mạng hoặc lỗi từ throw ở trên
    console.error(`[apiClient] Network/Internal Error for ${method} ${finalUrl}:`, error);
    if (error && typeof error.statusCode === 'number') { // Nếu là ApiErrorResponse đã được ném
      throw error;
    }
    // Lỗi mạng hoặc lỗi không mong muốn khác
    throw {
      statusCode: error.status || 503, // Service Unavailable hoặc lỗi chung
      message: error.message || "Lỗi mạng hoặc không thể kết nối đến máy chủ.",
      errorDetails: error,
    } as ApiErrorResponse;
  }
};