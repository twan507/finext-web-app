# finext-fastapi/app/schemas/dashboard.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class PeriodRange(BaseModel):
    start_date: datetime
    end_date: datetime


class KpiMetric(BaseModel):
    current: float = 0
    previous: float = 0


class KpiStats(BaseModel):
    total_revenue: KpiMetric = Field(default_factory=KpiMetric)
    successful_orders: KpiMetric = Field(default_factory=KpiMetric)
    new_users: KpiMetric = Field(default_factory=KpiMetric)
    active_subscriptions: KpiMetric = Field(default_factory=KpiMetric)
    churn_rate: KpiMetric = Field(default_factory=KpiMetric)
    pending_orders: KpiMetric = Field(default_factory=KpiMetric)


class RevenueTrendItem(BaseModel):
    date: str  # "2026-03-01" or "2026-W12" or "2026-03"
    revenue: float = 0


class UserGrowthItem(BaseModel):
    date: str
    total_users: int = 0
    new_users: int = 0


class RevenueByLicenseItem(BaseModel):
    license_key: str
    license_name: str = ""
    revenue: float = 0
    count: int = 0


class SubscriptionDistributionItem(BaseModel):
    license_key: str
    license_name: str = ""
    count: int = 0


class TransactionStatusStats(BaseModel):
    succeeded: int = 0
    pending: int = 0
    canceled: int = 0


class TopPromotionItem(BaseModel):
    code: str
    usage_count: int = 0
    total_discount: float = 0


class TopBrokerItem(BaseModel):
    broker_code: str
    broker_name: str = ""
    total_revenue: float = 0
    order_count: int = 0


class RecentTransactionItem(BaseModel):
    id: str
    buyer_email: str = ""
    license_key: str = ""
    transaction_amount: float = 0
    payment_status: str = ""
    transaction_type: str = ""
    created_at: datetime


class DashboardStatsResponse(BaseModel):
    period: PeriodRange
    previous_period: PeriodRange
    granularity: str  # "day", "week", "month"
    kpis: KpiStats = Field(default_factory=KpiStats)
    revenue_trend: List[RevenueTrendItem] = []
    user_growth: List[UserGrowthItem] = []
    revenue_by_license: List[RevenueByLicenseItem] = []
    subscription_distribution: List[SubscriptionDistributionItem] = []
    transaction_status: TransactionStatusStats = Field(default_factory=TransactionStatusStats)
    top_promotions: List[TopPromotionItem] = []
    top_brokers: List[TopBrokerItem] = []
    recent_transactions: List[RecentTransactionItem] = []
