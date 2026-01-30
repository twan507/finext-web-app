// finext-nextjs/services/pollingClient.ts
/**
 * Custom hook để polling REST API với interval
 * Sử dụng apiClient có sẵn để fetch dữ liệu
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from './apiClient';

interface UsePollingOptions {
    /** Khoảng thời gian giữa các lần fetch (ms), mặc định 5000ms */
    interval?: number;
    /** Có enable polling hay không, mặc định true */
    enabled?: boolean;
    /** Có fetch ngay lập tức khi mount hay không, mặc định true */
    immediate?: boolean;
}

interface UsePollingResult<T> {
    /** Dữ liệu nhận được từ API */
    data: T | null;
    /** Trạng thái đang loading */
    isLoading: boolean;
    /** Lỗi nếu có */
    error: string | null;
    /** Hàm để fetch lại dữ liệu ngay lập tức */
    refetch: () => Promise<void>;
}

/**
 * Hook để polling REST API với interval
 * 
 * @param url - Endpoint path (VD: '/api/v1/sse/rest/home_itd_index')
 * @param queryParams - Query parameters (VD: { ticker: 'VNINDEX' })
 * @param options - Các options cho polling
 * @returns { data, isLoading, error, refetch }
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = usePollingClient<RawMarketData[]>(
 *   '/api/v1/sse/rest/home_itd_index',
 *   { ticker: 'VNINDEX' },
 *   { interval: 5000, enabled: true }
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
        immediate = true
    } = options;

    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(immediate);
    const [error, setError] = useState<string | null>(null);

    // Refs để tránh stale closures và memory leaks
    const isMountedRef = useRef<boolean>(true);
    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

    // Serialize queryParams để dùng trong dependency
    const queryParamsKey = JSON.stringify(queryParams);

    // Hàm fetch dữ liệu sử dụng apiClient
    const fetchData = useCallback(async () => {
        try {
            const response = await apiClient<T>({
                url,
                method: 'GET',
                queryParams,
                requireAuth: false
            });

            if (isMountedRef.current) {
                if (response.data) {
                    setData(response.data);
                    setError(null);
                }
                setIsLoading(false);
            }
        } catch (err: any) {
            if (isMountedRef.current) {
                setError(err.message || 'Lỗi không xác định');
                setIsLoading(false);
                console.warn('[usePollingClient] Fetch error:', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, queryParamsKey]);

    // Hàm refetch để gọi thủ công
    const refetch = useCallback(async () => {
        setIsLoading(true);
        await fetchData();
    }, [fetchData]);

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
            setIsLoading(true);
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
        refetch
    };
}

export default usePollingClient;
