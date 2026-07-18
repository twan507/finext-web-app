// finext-nextjs/services/chatQuota.ts
import { apiClient } from './apiClient';

export interface QuotaWindow {
    used: number;
    limit: number;
    reset_at: string | null; // ISO datetime; null = chưa dùng gì trong cửa sổ này
}

export interface QuotaStatus {
    tier: 'standard' | 'advanced' | 'unlimited';
    unlimited: boolean;
    session: QuotaWindow | null; // null khi unlimited
    weekly: QuotaWindow | null; // null khi unlimited
}

export async function fetchQuota(): Promise<QuotaStatus | null> {
    const res = await apiClient<QuotaStatus>({ url: '/api/v1/chat/quota', method: 'GET', skipCache: true });
    return res.status === 200 && res.data ? res.data : null;
}
