// finext-nextjs/services/sseClient.ts
import queryString from 'query-string';
import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './core/config';
import {
  ISseRequest,
  ISseCallbacks,
  ISseConnection,
  SseError,
} from './core/types';

/**
 * SSE Client với Connection Sharing
 *
 * Các tính năng:
 * 1. Connection sharing: Nhiều subscribers dùng chung 1 connection
 * 2. Auto-reconnect khi connection bị đóng
 * 3. Visibility management: Ngắt khi tab ẩn, kết nối lại khi tab hiện
 */

// ========== Types ==========
interface Subscriber<T = any> {
  id: string;
  onData: (data: T) => void;
  onError?: (error: SseError) => void;
}

interface ConnectionEntry<T = any> {
  connection: ISseConnection | null;
  subscribers: Map<string, Subscriber<T>>;
  isConnecting: boolean;
  lastError: SseError | null;
  reconnectAttempts: number;
  reconnectTimeout: NodeJS.Timeout | null;
  /** Factory function để tái tạo connection khi tab visible lại */
  reconnector: (() => void) | null;
}

// ========== Constants ==========
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

// ========== Connection Storage ==========
const connections = new Map<string, ConnectionEntry>();

// ========== Visibility Management ==========
// Ngắt tất cả SSE khi tab ẩn, kết nối lại khi tab hiện.
// Tránh vượt giới hạn 6 connections/domain của browser khi mở nhiều tab.
function pauseAllConnections(): void {
  connections.forEach((entry) => {
    // Clear pending reconnect
    if (entry.reconnectTimeout) {
      clearTimeout(entry.reconnectTimeout);
      entry.reconnectTimeout = null;
    }
    // Close EventSource nhưng GIỮ NGUYÊN subscribers + reconnector
    if (entry.connection) {
      const es = entry.connection.getEventSource();
      if (es) es.close();
      entry.connection = null;
    }
    entry.isConnecting = false;
    entry.reconnectAttempts = 0;
  });
}

function resumeAllConnections(): void {
  connections.forEach((entry) => {
    // Chỉ reconnect nếu còn subscribers và chưa có connection
    if (entry.subscribers.size > 0 && !entry.connection && !entry.isConnecting && entry.reconnector) {
      entry.reconnector();
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseAllConnections();
    } else {
      resumeAllConnections();
    }
  });
}

// ========== Helper Functions ==========
function generateSubscriberId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getConnectionKey(keyword: string, queryParams?: Record<string, any>): string {
  const params = queryParams ? { ...queryParams } : {};
  // Loại bỏ keyword khỏi params vì đã dùng làm key chính
  delete params.keyword;
  const paramStr = Object.keys(params).length > 0 ? `_${queryString.stringify(params)}` : '';
  return `sse_${keyword}${paramStr}`;
}

function getReconnectDelay(attempts: number): number {
  // Exponential backoff with jitter
  const delay = Math.min(
    RECONNECT_BASE_DELAY * Math.pow(2, attempts) + Math.random() * 1000,
    MAX_RECONNECT_DELAY
  );
  return delay;
}

/**
 * Kiểm tra dữ liệu nhận được có phải "trống" không.
 * Khi DB đang ghi đè collection, server trả về [] hoặc {}.
 * Trong trường hợp này, bỏ qua dữ liệu trống.
 */
function isEmptyData(data: any): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data) && data.length === 0) return true;
  if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) return true;
  return false;
}

// ========== Core Functions ==========

/**
 * Tạo hoặc tái sử dụng SSE connection
 *
 * @param props - Cấu hình SSE request
 * @param callbacks - Callbacks xử lý events
 * @param options - Tùy chọn bổ sung
 * @returns Subscription object với method unsubscribe
 */
export function sseClient<DataType = any>(
  props: ISseRequest,
  callbacks: ISseCallbacks<DataType>,
  options: {
    /** Có tự động reconnect không (default: true) */
    autoReconnect?: boolean;
  } = {}
): { unsubscribe: () => void; subscriberId: string } {
  const { url, queryParams = {} } = props;
  const { onData, onError, onOpen, onClose } = callbacks;
  const { autoReconnect = true } = options;

  const keyword = queryParams.keyword as string || url;
  const connectionKey = getConnectionKey(keyword, queryParams);
  const subscriberId = generateSubscriberId();

  // ========== 1. Kiểm tra và tái sử dụng connection ==========
  let connectionEntry = connections.get(connectionKey);

  if (!connectionEntry) {
    // Tạo mới connection entry
    connectionEntry = {
      connection: null,
      subscribers: new Map(),
      isConnecting: false,
      lastError: null,
      reconnectAttempts: 0,
      reconnectTimeout: null,
      reconnector: null
    };
    connections.set(connectionKey, connectionEntry);
  }

  // Thêm subscriber
  connectionEntry.subscribers.set(subscriberId, {
    id: subscriberId,
    onData,
    onError
  });

  // Nếu đã có connection active, không cần tạo mới
  if (connectionEntry.connection || connectionEntry.isConnecting) {
    // Notify subscriber đã được thêm
    if (connectionEntry.subscribers.size === 1) {
      onOpen();
    }

    return {
      subscriberId,
      unsubscribe: () => unsubscribeFromConnection(connectionKey, subscriberId)
    };
  }

  // ========== 2. Tạo connection mới ==========
  function createConnection() {
    const entry = connections.get(connectionKey);
    if (!entry) return;

    entry.isConnecting = true;

    // Build final URL
    const finalUrl = `${API_BASE_URL}${url}${Object.keys(queryParams).length
      ? `?${queryString.stringify(queryParams)}`
      : ''
      }`;

    try {
      const eventSource = new EventSource(finalUrl, { withCredentials: false });

      eventSource.onopen = () => {
        entry.isConnecting = false;
        entry.reconnectAttempts = 0;
        entry.lastError = null;

        // Notify tất cả subscribers
        entry.subscribers.forEach(sub => {
          // Gọi onOpen nếu subscriber có
        });
        onOpen();
      };

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const parsedData = JSON.parse(event.data);

          // ===== Skip empty data (DB overwrite protection) =====
          if (isEmptyData(parsedData)) {
            return;
          }

          // Check for server error in data
          if (parsedData && parsedData.error) {
            const error: SseError = {
              type: 'ServerError',
              message: `Server Error: ${parsedData.error}`,
              originalEvent: event.data
            };
            entry.lastError = error;
            entry.subscribers.forEach(sub => sub.onError?.(error));
            return;
          }

          // ===== Broadcast to all subscribers =====
          entry.subscribers.forEach(sub => {
            sub.onData(parsedData as DataType);
          });
        } catch (e: any) {
          const error: SseError = {
            type: 'ParseError',
            message: `Parse error: ${e.message}`,
            originalEvent: event.data
          };
          entry.subscribers.forEach(sub => sub.onError?.(error));
        }
      };

      eventSource.onerror = (errorEvent: Event) => {
        console.warn(`[SSE Client] EventSource error:`, errorEvent);

        const error: SseError = {
          type: 'EventSourceError',
          message: 'SSE connection error',
          originalEvent: errorEvent
        };
        entry.lastError = error;

        if (eventSource.readyState === EventSource.CLOSED) {
          entry.isConnecting = false;
          entry.connection = null;

          // Notify subscribers
          entry.subscribers.forEach(sub => sub.onError?.(error));
          onClose();

          // Auto reconnect nếu còn subscribers
          if (autoReconnect && entry.subscribers.size > 0 && entry.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = getReconnectDelay(entry.reconnectAttempts);
            entry.reconnectAttempts++;

            console.log(`[SSE Client] Reconnecting in ${delay}ms (attempt ${entry.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

            entry.reconnectTimeout = setTimeout(() => {
              if (entry.subscribers.size > 0) {
                createConnection();
              }
            }, delay);
          } else if (entry.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            // Hết retry — notify subscribers và cleanup zombie entry
            console.warn(`[SSE Client] Max reconnect attempts reached for ${connectionKey}. Giving up.`);
            const maxRetryError: SseError = {
              type: 'EventSourceError',
              message: `SSE connection failed after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts`,
            };
            entry.subscribers.forEach(sub => sub.onError?.(maxRetryError));
            // Xóa connection entry khỏi Map để tránh zombie
            connections.delete(connectionKey);
          }
        } else {
          // EventSource readyState chưa CLOSED — browser đang tự auto-reconnect.
          // Đóng EventSource cũ để tránh conflict với custom reconnect logic,
          // rồi để custom reconnect xử lý.
          eventSource.close();
          entry.isConnecting = false;
          entry.connection = null;

          entry.subscribers.forEach(sub => sub.onError?.({
            type: 'EventSourceError',
            message: 'SSE connection error (will retry)',
            originalEvent: errorEvent
          }));

          // Custom reconnect thay vì để browser auto-reconnect
          if (autoReconnect && entry.subscribers.size > 0 && entry.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = getReconnectDelay(entry.reconnectAttempts);
            entry.reconnectAttempts++;
            entry.reconnectTimeout = setTimeout(() => {
              if (entry.subscribers.size > 0) {
                createConnection();
              }
            }, delay);
          }
        }
      };

      // Lưu connection
      entry.connection = {
        close: () => {
          eventSource.close();
          onClose();
        },
        getEventSource: () => eventSource
      };
    } catch (e: any) {
      console.error(`[SSE Client] Failed to create EventSource:`, e);
      entry.isConnecting = false;
      const error: SseError = {
        type: 'InitializationError',
        message: `Failed to initialize: ${e.message}`
      };
      entry.lastError = error;
      onError(error);
    }
  }

  // Lưu reconnector để visibility handler có thể tái tạo connection
  connectionEntry.reconnector = createConnection;

  // Chỉ tạo connection nếu tab đang visible (hoặc không phải browser)
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    createConnection();
  }

  return {
    subscriberId,
    unsubscribe: () => unsubscribeFromConnection(connectionKey, subscriberId)
  };
}

/**
 * Hủy đăng ký subscriber khỏi connection
 */
function unsubscribeFromConnection(connectionKey: string, subscriberId: string): void {
  const entry = connections.get(connectionKey);
  if (!entry) return;

  // Xóa subscriber
  entry.subscribers.delete(subscriberId);

  // Nếu không còn subscriber nào, đóng connection
  if (entry.subscribers.size === 0) {
    // Clear reconnect timeout nếu có
    if (entry.reconnectTimeout) {
      clearTimeout(entry.reconnectTimeout);
      entry.reconnectTimeout = null;
    }

    // Close connection
    if (entry.connection) {
      entry.connection.close();
    }

    // Remove connection entry
    connections.delete(connectionKey);
  }
}

/**
 * Đóng tất cả SSE connections
 */
export function closeAllConnections(): void {
  const entries = Array.from(connections.entries());
  entries.forEach(([key, entry]) => {
    if (entry.reconnectTimeout) {
      clearTimeout(entry.reconnectTimeout);
    }
    if (entry.connection) {
      entry.connection.close();
    }
  });
  connections.clear();
}

/**
 * Lấy thông tin debug về connections
 */
export function getDebugInfo(): {
  activeConnections: number;
  connectionDetails: Array<{
    key: string;
    subscribers: number;
    isConnecting: boolean;
    hasError: boolean;
  }>;
} {
  const connectionDetails = Array.from(connections.entries()).map(([key, entry]) => ({
    key,
    subscribers: entry.subscribers.size,
    isConnecting: entry.isConnecting,
    hasError: entry.lastError !== null
  }));

  return {
    activeConnections: connections.size,
    connectionDetails
  };
}

/**
 * Helper function để tạo SSE subscription với cú pháp ngắn gọn hơn
 */
export function createSseSubscription<T>(
  keyword: string,
  onData: (data: T) => void,
  options: {
    url?: string;
    queryParams?: Record<string, any>;
    onError?: (error: SseError) => void;
    onOpen?: () => void;
    onClose?: () => void;
  } = {}
): { unsubscribe: () => void } {
  const {
    url = '/api/v1/sse/stream',
    queryParams = {},
    onError,
    onOpen = () => { },
    onClose = () => { }
  } = options;

  return sseClient<T>(
    {
      url,
      queryParams: { ...queryParams, keyword }
    },
    {
      onData,
      onError: onError || ((err) => console.warn(`[SSE ${keyword}]`, err.message)),
      onOpen,
      onClose
    }
  );
}

// ========== React Hooks ==========

/**
 * Options cho useSseData hook
 */
export interface UseSseCacheOptions<T> {
  keyword: string;
  url?: string;
  queryParams?: Record<string, any>;
  enabled?: boolean;
  transform?: (data: T) => T;
  onData?: (data: T) => void;
  onError?: (error: SseError) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseSseCacheResult<T> {
  data: T | null;
  isLoading: boolean;
  error: SseError | null;
  isConnected: boolean;
  debugInfo: ReturnType<typeof getDebugInfo>;
}

/**
 * Hook để sử dụng SSE trong React components.
 * Dữ liệu realtime, không cache.
 */
export function useSseCache<T = any>(
  options: UseSseCacheOptions<T>
): UseSseCacheResult<T> {
  const {
    keyword,
    url = '/api/v1/sse/stream',
    queryParams = {},
    enabled = true,
    transform,
    onData,
    onError,
    onOpen,
    onClose
  } = options;

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isMountedRef = useRef(true);

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<SseError | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      return;
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    subscriptionRef.current = sseClient<T>(
      {
        url,
        queryParams: { ...queryParams, keyword }
      },
      {
        onOpen: () => {
          if (isMountedRef.current) {
            setIsConnected(true);
            setError(null);
            onOpen?.();
          }
        },
        onData: (receivedData) => {
          if (isMountedRef.current) {
            if (
              receivedData === null || receivedData === undefined ||
              (Array.isArray(receivedData) && receivedData.length === 0) ||
              (typeof receivedData === 'object' && !Array.isArray(receivedData) && Object.keys(receivedData).length === 0)
            ) {
              return;
            }
            const processedData = transform ? transform(receivedData) : receivedData;
            setData(processedData);
            setIsLoading(false);
            setError(null);
            onData?.(processedData);
          }
        },
        onError: (sseError) => {
          if (isMountedRef.current) {
            setError(sseError);
            onError?.(sseError);
          }
        },
        onClose: () => {
          if (isMountedRef.current) {
            setIsConnected(false);
            onClose?.();
          }
        }
      }
    );

    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [keyword, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    isLoading,
    error,
    isConnected,
    debugInfo: getDebugInfo()
  };
}

/**
 * Hook SSE với grouping theo key.
 * Tương tự useSseCache nhưng tự động group data theo một field.
 */
export interface UseSseCacheGroupedOptions<T> extends Omit<UseSseCacheOptions<T[]>, 'transform'> {
  groupByKey: keyof T;
}

export interface UseSseCacheGroupedResult<T> extends Omit<UseSseCacheResult<T[]>, 'data'> {
  groupedData: Record<string, T[]>;
  rawData: T[] | null;
}

export function useSseCacheGrouped<T extends Record<string, any>>(
  options: UseSseCacheGroupedOptions<T>
): UseSseCacheGroupedResult<T> {
  const { groupByKey, ...restOptions } = options;

  const [groupedData, setGroupedData] = useState<Record<string, T[]>>({});

  const result = useSseCache<T[]>({
    ...restOptions,
    onData: (data) => {
      if (data && Array.isArray(data)) {
        const grouped: Record<string, T[]> = {};
        data.forEach((item) => {
          const key = String(item[groupByKey]);
          if (key) {
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
          }
        });
        setGroupedData(grouped);
      }
      restOptions.onData?.(data);
    }
  });

  return {
    ...result,
    groupedData,
    rawData: result.data
  };
}
