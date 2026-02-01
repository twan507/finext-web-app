// finext-nextjs/services/sseClient.ts
import queryString from 'query-string';
import { API_BASE_URL } from './core/config';
import {
  ISseRequest,
  ISseCallbacks,
  ISseConnection,
  SseError,
} from './core/types';

/**
 * SSE Client với Cache và Connection Sharing
 * 
 * Các tính năng:
 * 1. Cache dữ liệu SSE theo keyword/URL
 * 2. Stale-while-revalidate: Trả về cache ngay lập tức, đồng thời subscribe updates
 * 3. Connection sharing: Nhiều subscribers dùng chung 1 connection
 * 4. Auto-reconnect khi connection bị đóng
 * 5. TTL (Time-To-Live) cho cache
 */

// ========== Types ==========
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  keyword: string;
}

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
}

// ========== Constants ==========
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

// ========== Cache Storage ==========
const cache = new Map<string, CacheEntry>();
const connections = new Map<string, ConnectionEntry>();

// ========== Helper Functions ==========
function generateSubscriberId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCacheKey(keyword: string, queryParams?: Record<string, any>): string {
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

// ========== Core Functions ==========

/**
 * Lấy dữ liệu từ cache (nếu có và chưa hết hạn)
 */
export function getFromCache<T = any>(
  keyword: string,
  queryParams?: Record<string, any>,
  ttl: number = DEFAULT_CACHE_TTL
): T | null {
  const cacheKey = getCacheKey(keyword, queryParams);
  const entry = cache.get(cacheKey);

  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    // Cache đã hết hạn
    cache.delete(cacheKey);
    return null;
  }

  return entry.data as T;
}

/**
 * Lưu dữ liệu vào cache
 */
export function setToCache<T = any>(
  keyword: string,
  data: T,
  queryParams?: Record<string, any>
): void {
  const cacheKey = getCacheKey(keyword, queryParams);
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    keyword
  });
}

/**
 * Xóa cache cho một keyword cụ thể
 */
export function clearCache(keyword?: string): void {
  if (keyword) {
    // Xóa tất cả cache entries có keyword này
    const entries = Array.from(cache.entries());
    entries.forEach(([key, entry]) => {
      if (entry.keyword === keyword) {
        cache.delete(key);
      }
    });
  } else {
    // Xóa toàn bộ cache
    cache.clear();
  }
}

/**
 * Tạo hoặc tái sử dụng SSE connection với caching
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
    /** Cache TTL in ms (default: 5 minutes) */
    cacheTtl?: number;
    /** Có sử dụng cache không (default: true) */
    useCache?: boolean;
    /** Có tự động reconnect không (default: true) */
    autoReconnect?: boolean;
  } = {}
): { unsubscribe: () => void; subscriberId: string } {
  const { url, queryParams = {}, requireAuth = false } = props;
  const { onData, onError, onOpen, onClose } = callbacks;
  const {
    cacheTtl = DEFAULT_CACHE_TTL,
    useCache = true,
    autoReconnect = true
  } = options;

  const keyword = queryParams.keyword as string || url;
  const connectionKey = getCacheKey(keyword, queryParams);
  const subscriberId = generateSubscriberId();

  // ========== 1. Trả về cached data ngay lập tức nếu có ==========
  if (useCache) {
    const cachedData = getFromCache<DataType>(keyword, queryParams, cacheTtl);
    if (cachedData !== null) {
      // Schedule callback để đảm bảo nó chạy sau khi function return
      setTimeout(() => {
        onData(cachedData);
      }, 0);
    }
  }

  // ========== 2. Kiểm tra và tái sử dụng connection ==========
  let connectionEntry = connections.get(connectionKey);

  if (!connectionEntry) {
    // Tạo mới connection entry
    connectionEntry = {
      connection: null,
      subscribers: new Map(),
      isConnecting: false,
      lastError: null,
      reconnectAttempts: 0,
      reconnectTimeout: null
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

  // ========== 3. Tạo connection mới ==========
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

          // ===== Cache dữ liệu =====
          if (useCache) {
            setToCache(keyword, parsedData, queryParams);
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
          }
        } else {
          // EventSource sẽ tự động thử kết nối lại
          entry.subscribers.forEach(sub => sub.onError?.({
            type: 'EventSourceError',
            message: 'SSE connection error (may retry)',
            originalEvent: errorEvent
          }));
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

  createConnection();

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
 * Lấy thông tin debug về cache và connections
 */
export function getDebugInfo(): {
  cacheEntries: number;
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
    cacheEntries: cache.size,
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
    cacheTtl?: number;
    useCache?: boolean;
  } = {}
): { unsubscribe: () => void } {
  const {
    url = '/api/v1/sse/stream',
    queryParams = {},
    onError,
    onOpen = () => { },
    onClose = () => { },
    cacheTtl,
    useCache = true
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
    },
    { cacheTtl, useCache }
  );
}
