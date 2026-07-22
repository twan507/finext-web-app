// finext-nextjs/services/core/apiCache.ts
// Cache in-memory cho REST API. Tách khỏi apiClient.ts để tự chứa (chỉ phụ thuộc
// query-string) → unit test được bằng `node --test`; apiClient dùng path alias
// `services/...` nên không nạp được trong test runner.
import queryString from 'query-string';

export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    url: string;
}

const apiCache = new Map<string, CacheEntry>();

export const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Tạo cache key từ URL và query params
 */
function getCacheKey(url: string, queryParams?: Record<string, any>): string {
    const paramStr = queryParams && Object.keys(queryParams).length > 0
        ? `_${queryString.stringify(queryParams)}`
        : '';
    return `api_${url}${paramStr}`;
}

/**
 * Lấy dữ liệu từ cache (nếu có và chưa hết hạn). Entry hết hạn bị xoá luôn.
 */
export function getFromCache<T = any>(
    url: string,
    queryParams?: Record<string, any>,
    ttl: number = DEFAULT_CACHE_TTL
): T | null {
    const cacheKey = getCacheKey(url, queryParams);
    const entry = apiCache.get(cacheKey);

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > ttl) {
        // Cache đã hết hạn
        apiCache.delete(cacheKey);
        return null;
    }

    return entry.data as T;
}

/**
 * Peek: URL này có cache CÒN HẠN không — KHÔNG đọc dữ liệu, KHÔNG xoá gì.
 *
 * Dùng cho stale-while-revalidate: caller cần biết lần gọi sắp tới sẽ được phục vụ
 * từ cache (→ nên làm mới nền) hay sẽ đi mạng (→ đã tươi, khỏi gọi lại). Nhờ không
 * mutate nên gọi để thăm dò là vô hại.
 */
export function hasFreshCache(
    url: string,
    queryParams?: Record<string, any>,
    ttl: number = DEFAULT_CACHE_TTL
): boolean {
    const entry = apiCache.get(getCacheKey(url, queryParams));
    if (!entry) return false;
    return Date.now() - entry.timestamp <= ttl;
}

/**
 * Lưu dữ liệu vào cache
 */
export function setToCache<T = any>(
    url: string,
    data: T,
    queryParams?: Record<string, any>
): void {
    const cacheKey = getCacheKey(url, queryParams);
    apiCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        url
    });
}

/**
 * Xóa cache cho một URL cụ thể hoặc toàn bộ
 */
export function clearApiCache(url?: string): void {
    if (url) {
        // Xóa tất cả cache entries có URL này
        const entries = Array.from(apiCache.entries());
        entries.forEach(([key, entry]) => {
            if (entry.url === url || key.startsWith(`api_${url}`)) {
                apiCache.delete(key);
            }
        });
    } else {
        // Xóa toàn bộ cache
        apiCache.clear();
    }
}

/**
 * Xoá mọi entry có cache key thoả điều kiện. Dùng khi invalidate theo nhóm
 * (vd mutation trên /admin/ phải bust toàn bộ cache admin).
 */
export function clearApiCacheWhere(predicate: (key: string) => boolean): void {
    Array.from(apiCache.keys()).forEach((key) => {
        if (predicate(key)) apiCache.delete(key);
    });
}

/**
 * Lấy thông tin debug về cache
 */
export function getApiCacheDebugInfo(): {
    cacheEntries: number;
    keys: string[];
} {
    return {
        cacheEntries: apiCache.size,
        keys: Array.from(apiCache.keys())
    };
}

// ========== Cache Eviction ==========
// Tự động dọn cache entries hết TTL mỗi 5 phút, tránh memory leak khi để trang mở lâu
if (typeof window !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        apiCache.forEach((entry, key) => {
            if (now - entry.timestamp > DEFAULT_CACHE_TTL) {
                apiCache.delete(key);
            }
        });
    }, DEFAULT_CACHE_TTL);
}
