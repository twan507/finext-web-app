'use client';

import { useEffect, useState } from 'react';
import { apiClient } from 'services/apiClient';

type LicenseColorMap = Map<string, string>;

interface LicenseItem {
    key: string;
    color?: string | null;
}

let cachedMap: LicenseColorMap | null = null;
let fetchPromise: Promise<LicenseColorMap> | null = null;
const subscribers = new Set<(m: LicenseColorMap) => void>();

async function loadLicenses(): Promise<LicenseColorMap> {
    if (cachedMap) return cachedMap;
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
        const map: LicenseColorMap = new Map();
        try {
            const res = await apiClient<{ items: LicenseItem[]; total: number }>({
                url: '/api/v1/licenses/?skip=0&limit=200&include_inactive=true',
                method: 'GET',
            });
            if (res.status === 200 && res.data?.items) {
                for (const lic of res.data.items) {
                    if (lic.color) map.set(lic.key, lic.color);
                }
            }
        } catch {
            // silent — pages will fall back to default chip appearance
        }
        cachedMap = map;
        fetchPromise = null;
        subscribers.forEach(cb => cb(map));
        return map;
    })();

    return fetchPromise;
}

export function useLicenseColors(): LicenseColorMap {
    const [map, setMap] = useState<LicenseColorMap>(() => cachedMap ?? new Map());

    useEffect(() => {
        if (cachedMap) {
            if (map !== cachedMap) setMap(cachedMap);
            return;
        }
        subscribers.add(setMap);
        loadLicenses();
        return () => {
            subscribers.delete(setMap);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return map;
}
