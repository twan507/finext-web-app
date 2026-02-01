// finext-nextjs/services/pollingClient.ts
/**
 * Custom hook để polling REST API với interval và cache tích hợp
 * Sử dụng apiClient có sẵn để fetch dữ liệu
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient, getFromCache, setToCache } from './apiClient';

// ========== Cache Constants ==========
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ========== Types ==========
interface UsePollingOptions {
    /** Khoảng thời gian giữa các lần fetch (ms), mặc định 5000ms */
    interval?: number;
    /** Có enable polling hay không, mặc định true */
    enabled?: boolean;
    /** Có fetch ngay lập tức khi mount hay không, mặc định true */
    immediate?: boolean;
    /** Có sử dụng cache không (default: true) */
    useCache?: boolean;
    /** Cache TTL in ms (default: 5 minutes) */
    cacheTtl?: number;
}

interface UsePollingResult<T> {
    /** Dữ liệu nhận được từ API */
    data: T | null;
    /** Trạng thái đang loading (chỉ true khi không có data và đang fetch) */
    isLoading: boolean;
    /** Lỗi nếu có */
    error: string | null;
    /** Hàm để fetch lại dữ liệu ngay lập tức */
    refetch: () => Promise<void>;
    /** Có đang fetching không (kể cả khi đã có data) */
    isFetching: boolean;
}

/**
 * Hook để polling REST API với interval và cache tích hợp
 * 
 * Cache behavior:
 * - Khi mount, trả về cached data ngay lập tức nếu có (stale-while-revalidate)
 * - Vẫn fetch data mới và cập nhật cache
 * - Polling sẽ cập nhật cả state và cache
 * 
 * @param url - Endpoint path (VD: '/api/v1/sse/rest/home_itd_index')
 * @param queryParams - Query parameters (VD: { ticker: 'VNINDEX' })
 * @param options - Các options cho polling
 * @returns { data, isLoading, error, refetch, isFetching }
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = usePollingClient<RawMarketData[]>(
 *   '/api/v1/sse/rest/home_itd_index',
 *   { ticker: 'VNINDEX' },
 *   { interval: 5000, enabled: true, useCache: true }
 * );
 * ```
 */
export function usePollingClient<T = any>(
    url: string,
    queryParams: Record<string, any> = {},
    options: UsePollingOptions = {}
): UsePollingResult<T> {
    const {
        interval = 5000,
        enabled = true,
        immediate = true,
        useCache = true,
        cacheTtl = DEFAULT_CACHE_TTL
    } = options;

    // Khởi tạo state từ cache nếu có (stale-while-revalidate)
    const [data, setData] = useState<T | null>(() => {
        if (useCache) {
            const cached = getFromCache<{ data: T }>(url, queryParams, cacheTtl);
            return cached?.data || null;
        }
        return null;
    });

    // isLoading chỉ true khi không có data và đang fetch lần đầu
    const [isLoading, setIsLoading] = useState<boolean>(() => {
        if (useCache) {
            const cached = getFromCache<{ data: T }>(url, queryParams, cacheTtl);
            return cached?.data === undefined || cached?.data === null;
        }
        return immediate;
    });

    const [isFetching, setIsFetching] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Refs để tránh stale closures và memory leaks
    const isMountedRef = useRef<boolean>(true);
    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

    // Serialize queryParams để dùng trong dependency
    const queryParamsKey = JSON.stringify(queryParams);

    // Hàm fetch dữ liệu sử dụng apiClient (đã có cache tích hợp)
    const fetchData = useCallback(async () => {
        setIsFetching(true);

        try {
            const response = await apiClient<T>({
                url,
                method: 'GET',
                queryParams,
                requireAuth: false,
                useCache: useCache,
                cacheTtl: cacheTtl,
                skipCache: false // Cho phép đọc từ cache
            });

            if (isMountedRef.current) {
                if (response.data !== undefined) {
                    setData(response.data);
                    setError(null);
                }
                setIsLoading(false);
                setIsFetching(false);
            }
        } catch (err: any) {
            if (isMountedRef.current) {
                setError(err.message || 'Lỗi không xác định');
                setIsLoading(false);
                setIsFetching(false);
                console.warn('[usePollingClient] Fetch error:', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, queryParamsKey, useCache, cacheTtl]);

    // Hàm refetch để gọi thủ công (bỏ qua cache)
    const refetch = useCallback(async () => {
        setIsFetching(true);

        try {
            const response = await apiClient<T>({
                url,
                method: 'GET',
                queryParams,
                requireAuth: false,
                useCache: useCache,
                cacheTtl: cacheTtl,
                skipCache: true // Bỏ qua cache khi refetch thủ công
            });

            if (isMountedRef.current) {
                if (response.data !== undefined) {
                    setData(response.data);
                    setError(null);
                }
                setIsFetching(false);
            }
        } catch (err: any) {
            if (isMountedRef.current) {
                setError(err.message || 'Lỗi không xác định');
                setIsFetching(false);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, queryParamsKey, useCache, cacheTtl]);

    // Effect để setup polling
    useEffect(() => {
        isMountedRef.current = true;

        // Clear interval cũ nếu có
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        if (!enabled) {
            return;
        }

        // Fetch ngay lập tức nếu immediate = true
        if (immediate) {
            fetchData();
        }

        // Setup interval polling
        intervalIdRef.current = setInterval(() => {
            if (isMountedRef.current && enabled) {
                fetchData();
            }
        }, interval);

        // Cleanup
        return () => {
            isMountedRef.current = false;
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
    }, [enabled, interval, immediate, fetchData]);

    return {
        data,
        isLoading,
        error,
        refetch,
        isFetching
    };
}

export default usePollingClient;
