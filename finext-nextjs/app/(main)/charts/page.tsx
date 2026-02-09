'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadLastTicker } from 'hooks/useChartStore';

export default function ChartsPage() {
    const router = useRouter();

    useEffect(() => {
        const ticker = loadLastTicker();
        router.replace(`/charts/${ticker}`);
    }, [router]);

    return null;
}
