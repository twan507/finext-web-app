// finext-nextjs/hooks/useSseCache.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import {
    sseClient,
    getFromCache,
    clearCache,
    getDebugInfo
} from 'services/sseClient';
import { SseError } from 'services/core/types';

/**
 * Options cho useSseCache hook
 */
export interface UseSseCacheOptions<T> {
    /** Keyword của SSE stream (required) */
    keyword: string;
    /** URL của SSE endpoint (default: '/api/v1/sse/stream') */
    url?: string;
    /** Query params bổ sung */
    queryParams?: Record<string, any>;
    /** Có enable hook không (default: true) */
    enabled?: boolean;
    /** Cache TTL in ms (default: 5 minutes) */
    cacheTtl?: number;
    /** Có sử dụng cache không (default: true) */
    useCache?: boolean;
    /** Transform function để xử lý data trước khi lưu vào state */
    transform?: (data: T) => T;
    /** Callback khi có data mới */
    onData?: (data: T) => void;
    /** Callback khi có lỗi */
    onError?: (error: SseError) => void;
    /** Callback khi connection mở */
    onOpen?: () => void;
    /** Callback khi connection đóng */
    onClose?: () => void;
}

/**
 * Return type của useSseCache hook
 */
export interface UseSseCacheResult<T> {
    /** Dữ liệu hiện tại */
    data: T | null;
    /** Có đang loading không */
    isLoading: boolean;
    /** Lỗi gần nhất (nếu có) */
    error: SseError | null;
    /** Có đang connected không */
    isConnected: boolean;
    /** Xóa cache cho keyword này */
    clearCache: () => void;
    /** Thông tin debug */
    debugInfo: ReturnType<typeof getDebugInfo>;
}

/**
 * Custom hook để sử dụng SSE với cache trong React components
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data, isLoading, error } = useSseCache<RawMarketData[]>({
 *     keyword: 'home_today_index',
 *     transform: (data) => groupByTicker(data),
 *   });
 * 
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <Error message={error.message} />;
 *   return <DataDisplay data={data} />;
 * }
 * ```
 */
export function useSseCache<T = any>(
    options: UseSseCacheOptions<T>
): UseSseCacheResult<T> {
    const {
        keyword,
        url = '/api/v1/sse/stream',
        queryParams = {},
        enabled = true,
        cacheTtl = 5 * 60 * 1000,
        useCache: useCacheOption = true,
        transform,
        onData,
        onError,
        onOpen,
        onClose
    } = options;

    // Refs
    const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
    const isMountedRef = useRef(true);

    // State - khởi tạo từ cache nếu có
    const [data, setData] = useState<T | null>(() => {
        if (!useCacheOption) return null;
        const cached = getFromCache<T>(keyword, queryParams, cacheTtl);
        return cached ? (transform ? transform(cached) : cached) : null;
    });

    const [isLoading, setIsLoading] = useState<boolean>(() => {
        if (!useCacheOption) return true;
        return getFromCache<T>(keyword, queryParams, cacheTtl) === null;
    });

    const [error, setError] = useState<SseError | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Effect để quản lý SSE subscription
    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled) {
            return;
        }

        // Cleanup previous subscription
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
            },
            { cacheTtl, useCache: useCacheOption }
        );

        return () => {
            isMountedRef.current = false;
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
            }
        };
    }, [keyword, enabled]); // Dependencies tối thiểu để tránh re-subscribe không cần thiết

    // Clear cache function
    const clearKeywordCache = useCallback(() => {
        clearCache(keyword);
        setData(null);
        setIsLoading(true);
    }, [keyword]);

    return {
        data,
        isLoading,
        error,
        isConnected,
        clearCache: clearKeywordCache,
        debugInfo: getDebugInfo()
    };
}

/**
 * Hook đơn giản hơn để lấy dữ liệu SSE với grouping theo key
 * 
 * @example
 * ```tsx
 * const { groupedData, isLoading } = useSseCacheGrouped<RawMarketData>({
 *   keyword: 'home_today_index',
 *   groupByKey: 'ticker'
 * });
 * // groupedData = { 'VNINDEX': [...], 'VN30': [...], ... }
 * ```
 */
export interface UseSseCacheGroupedOptions<T> extends Omit<UseSseCacheOptions<T[]>, 'transform'> {
    /** Key để group data theo */
    groupByKey: keyof T;
}

export interface UseSseCacheGroupedResult<T> extends Omit<UseSseCacheResult<T[]>, 'data'> {
    /** Dữ liệu đã được group */
    groupedData: Record<string, T[]>;
    /** Dữ liệu raw chưa group */
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

export default useSseCache;
