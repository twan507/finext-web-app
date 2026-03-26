// finext-nextjs/app/admin/dashboard/types.ts

export interface PeriodRange {
    start_date: string;
    end_date: string;
}

export interface KpiMetric {
    current: number;
    previous: number;
}

export interface KpiStats {
    total_revenue: KpiMetric;
    successful_orders: KpiMetric;
    new_users: KpiMetric;
    active_subscriptions: KpiMetric;
    churn_rate: KpiMetric;
    pending_orders: KpiMetric;
}

export interface RevenueTrendItem {
    date: string;
    revenue: number;
}

export interface UserGrowthItem {
    date: string;
    total_users: number;
    new_users: number;
}

export interface RevenueByLicenseItem {
    license_key: string;
    license_name: string;
    revenue: number;
    count: number;
}

export interface SubscriptionDistributionItem {
    license_key: string;
    license_name: string;
    count: number;
}

export interface TransactionStatusStats {
    succeeded: number;
    pending: number;
    canceled: number;
}

export interface TopPromotionItem {
    code: string;
    usage_count: number;
    total_discount: number;
}

export interface TopBrokerItem {
    broker_code: string;
    broker_name: string;
    total_revenue: number;
    order_count: number;
}

export interface RecentTransactionItem {
    id: string;
    buyer_email: string;
    license_key: string;
    transaction_amount: number;
    payment_status: string;
    transaction_type: string;
    created_at: string;
}

export interface DashboardStatsResponse {
    period: PeriodRange;
    previous_period: PeriodRange;
    granularity: string;
    kpis: KpiStats;
    revenue_trend: RevenueTrendItem[];
    user_growth: UserGrowthItem[];
    revenue_by_license: RevenueByLicenseItem[];
    subscription_distribution: SubscriptionDistributionItem[];
    transaction_status: TransactionStatusStats;
    top_promotions: TopPromotionItem[];
    top_brokers: TopBrokerItem[];
    recent_transactions: RecentTransactionItem[];
}

// Time filter presets
export type TimePreset = '7d' | '30d' | '3m' | '6m' | '1y' | 'custom';

// Currency formatter: auto VND/triệu/tỷ
export function formatCurrency(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}K₫`;
    return `${Math.round(value)}₫`;
}

// Percentage change calculator
export function calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}
