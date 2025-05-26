// finext-nextjs/app/services/sseClient.ts
import queryString from 'query-string';
import { API_BASE_URL } from './core/config';
import {
  ISseRequest,
  ISseCallbacks,
  ISseConnection,
  SseError,
} from './core/types'; // Hoặc sseTypes.ts nếu bạn tạo file riêng

/**
 * Khởi tạo và quản lý một kết nối Server-Sent Events (SSE).
 *
 * @param props - Cấu hình kết nối (url, queryParams).
 * @param callbacks - Các hàm callback để xử lý sự kiện (data, error, open, close).
 * @returns Một đối tượng ISseConnection với phương thức `close` để ngắt kết nối.
 */
export function sseClient<DataType = any>(
  props: ISseRequest,
  callbacks: ISseCallbacks<DataType>
): ISseConnection {
  const { url, queryParams = {}, requireAuth = false } = props;
  const { onData, onError, onOpen, onClose } = callbacks;

  let eventSource: EventSource | null = null;

  // --- Cảnh báo bảo mật (quan trọng nếu bạn dự định thêm xác thực) ---
  if (requireAuth) {
    console.warn(
      "[SSE Client] Cảnh báo Xác thực SSE: EventSource không hỗ trợ trực tiếp header 'Authorization'. " +
      "Nếu yêu cầu xác thực, cần xử lý qua query parameters hoặc phương thức khác (hiện chưa triển khai). " +
      'Hãy đảm bảo endpoint SSE của bạn được bảo vệ phù hợp.'
    );
    // Ví dụ nếu cần xác thực qua query (không khuyến khích nếu không cần thiết):
    // const token = getAccessToken();
    // if (token) {
    //   queryParams['token'] = token;
    // } else {
    //     onError({ type: 'InitializationError', message: 'Yêu cầu xác thực nhưng không tìm thấy token.' });
    //     return { close: () => {}, getEventSource: () => null };
    // }
  }

  // Xây dựng URL cuối cùng
  const finalUrl = `${API_BASE_URL}${url}${Object.keys(queryParams).length
    ? `?${queryString.stringify(queryParams)}`
    : ''
    }`;

  try {
    console.log(`[SSE Client] Đang cố gắng kết nối đến: ${finalUrl}`);
    // Khởi tạo EventSource
    eventSource = new EventSource(finalUrl, { withCredentials: false });

    // Xử lý sự kiện 'open'
    eventSource.onopen = () => {
      console.log(`[SSE Client] Kết nối đã mở đến ${finalUrl}`);
      onOpen();
    };

    // Xử lý sự kiện 'message' (dữ liệu chính)
    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const parsedData = JSON.parse(event.data);

        // Kiểm tra xem server có gửi về lỗi trong data không
        if (parsedData && parsedData.error) {
          console.error(
            `[SSE Client] Nhận được lỗi từ server:`,
            parsedData.error
          );
          onError({
            type: 'ServerError',
            message: `Lỗi Server: ${parsedData.error}`,
            originalEvent: event.data,
          });
          // Tùy chọn: Đóng kết nối khi có lỗi từ server
          // eventSource?.close();
          return;
        }

        // Gửi dữ liệu đã parse đến callback
        onData(parsedData as DataType);
      } catch (e: any) {
        console.error(`[SSE Client] Lỗi parse dữ liệu: "${event.data}"`, e);
        onError({
          type: 'ParseError',
          message: `Không thể parse dữ liệu nhận được: ${e.message}`,
          originalEvent: event.data,
        });
      }
    };

    // Xử lý sự kiện 'error'
    eventSource.onerror = (errorEvent: Event) => {
      console.error(`[SSE Client] Lỗi EventSource:`, errorEvent);
      // Kiểm tra xem kết nối đã đóng hoàn toàn chưa
      if (eventSource?.readyState === EventSource.CLOSED) {
        onError({
          type: 'EventSourceError',
          message: 'Kết nối đã bị đóng bởi server hoặc do lỗi.',
          originalEvent: errorEvent,
        });
        onClose(); // Gọi onClose khi kết nối chắc chắn đã đóng
        eventSource = null; // Xóa tham chiếu
      } else {
        // EventSource có thể tự động thử kết nối lại
        onError({
          type: 'EventSourceError',
          message: 'Lỗi kết nối SSE (có thể sẽ thử lại).',
          originalEvent: errorEvent,
        });
      }
    };
  } catch (e: any) {
    console.error(`[SSE Client] Không thể tạo EventSource:`, e);
    onError({
      type: 'InitializationError',
      message: `Không thể khởi tạo EventSource: ${e.message}`,
    });
    // Trả về một đối tượng "rỗng" nếu không thể tạo EventSource
    return { close: () => { }, getEventSource: () => null };
  }

  // Hàm để đóng kết nối
  const closeConnection = () => {
    if (eventSource) {
      console.log(`[SSE Client] Đóng kết nối thủ công đến ${finalUrl}`);
      eventSource.close();
      onClose(); // Gọi onClose khi đóng thủ công
      eventSource = null; // Xóa tham chiếu
    }
  };

  // Trả về đối tượng chứa hàm close
  return {
    close: closeConnection,
    getEventSource: () => eventSource,
  };
}