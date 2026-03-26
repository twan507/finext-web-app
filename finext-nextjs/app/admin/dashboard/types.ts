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
    total_users: number;
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

// Currency formatter: auto K/M/B + đ
// B/M → 2 decimal places (e.g. 9.00Mđ, 1.23Bđ)
// K and below → integer only (e.g. 500Kđ, 800đ)
export function formatCurrency(value: number): string {
    if (!isFinite(value) || isNaN(value)) return '0đ';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}Bđ`;
    if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(2)}Mđ`;
    if (abs >= 1_000)         return `${sign}${Math.round(abs / 1_000)}Kđ`;
    return `${sign}${Math.round(abs)}đ`;
}

// Percentage change calculator
export function calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}
