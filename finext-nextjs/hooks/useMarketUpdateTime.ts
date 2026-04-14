'use client';

import { useEffect, useRef, useState } from 'react';
import { sseClient } from 'services/sseClient';
import { ISseRequest } from 'services/core/types';

interface MarketUpdateTimeData {
    update_time: string | null;
}

/**
 * Hook lấy thời gian cập nhật mới nhất của dữ liệu thị trường
 * thông qua SSE keyword `market_update_time`.
 *
 * @returns Chuỗi thời gian dạng "HH:mm DD/MM/YYYY" hoặc null nếu chưa có data
 */
export function useMarketUpdateTime(): string | null {
    const isMountedRef = useRef<boolean>(true);
    const sseRef = useRef<{ unsubscribe: () => void } | null>(null);

    const parseUpdateTime = (raw: MarketUpdateTimeData | null): string | null => {
        if (!raw?.update_time) return null;
        try {
            const date = new Date(raw.update_time);
            if (isNaN(date.getTime())) return null;

            // Cộng 7 tiếng (UTC+7) nếu server trả về UTC
            const localDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);

            const hh = localDate.getUTCHours().toString().padStart(2, '0');
            const mm = localDate.getUTCMinutes().toString().padStart(2, '0');
            const dd = localDate.getUTCDate().toString().padStart(2, '0');
            const mo = (localDate.getUTCMonth() + 1).toString().padStart(2, '0');
            const yyyy = localDate.getUTCFullYear();

            return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
        } catch {
            return null;
        }
    };

    const [updateTime, setUpdateTime] = useState<string | null>(null);

    useEffect(() => {
        isMountedRef.current = true;

        if (sseRef.current) {
            sseRef.current.unsubscribe();
            sseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'market_update_time' },
        };

        sseRef.current = sseClient<MarketUpdateTimeData>(
            requestProps,
            {
                onOpen: () => { },
                onData: (data) => {
                    if (isMountedRef.current) {
                        setUpdateTime(parseUpdateTime(data));
                    }
                },
                onError: (err) => {
                    if (isMountedRef.current) {
                        console.warn('[SSE market_update_time] Error:', err.message);
                    }
                },
                onClose: () => { },
            },
            {}
        );

        return () => {
            isMountedRef.current = false;
            if (sseRef.current) sseRef.current.unsubscribe();
        };
    }, []);

    return updateTime;
}
