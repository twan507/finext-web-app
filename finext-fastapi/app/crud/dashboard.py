# finext-fastapi/app/crud/dashboard.py
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.dashboard import (
    DashboardStatsResponse, PeriodRange, KpiStats, KpiMetric,
    RevenueTrendItem, UserGrowthItem, RevenueByLicenseItem,
    SubscriptionDistributionItem, TransactionStatusStats,
    TopPromotionItem, TopBrokerItem, RecentTransactionItem,
)

logger = logging.getLogger(__name__)


def _get_granularity(start: datetime, end: datetime) -> str:
    delta_days = (end - start).days
    if delta_days <= 31:
        return "day"
    elif delta_days <= 180:
        return "week"
    return "month"


def _get_date_group_expr(granularity: str) -> Dict[str, Any]:
    if granularity == "day":
        return {
            "year": {"$year": "$created_at"},
            "month": {"$month": "$created_at"},
            "day": {"$dayOfMonth": "$created_at"},
        }
    elif granularity == "week":
        return {
            "year": {"$isoWeekYear": "$created_at"},
            "week": {"$isoWeek": "$created_at"},
        }
    return {
        "year": {"$year": "$created_at"},
        "month": {"$month": "$created_at"},
    }


def _format_date_key(group_id: Dict, granularity: str) -> str:
    if granularity == "day":
        return f"{group_id['year']}-{group_id['month']:02d}-{group_id['day']:02d}"
    elif granularity == "week":
        return f"{group_id['year']}-W{group_id['week']:02d}"
    return f"{group_id['year']}-{group_id['month']:02d}"


async def _get_revenue_kpi(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> float:
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {"_id": None, "total": {"$sum": "$transaction_amount"}}},
    ]
    result = await db.transactions.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


async def _get_order_count(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, status: str
) -> int:
    return await db.transactions.count_documents({
        "payment_status": status,
        "created_at": {"$gte": start, "$lt": end},
    })


async def _get_new_users_count(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> int:
    return await db.users.count_documents({
        "created_at": {"$gte": start, "$lt": end},
    })


async def _get_active_subscriptions_count(db: AsyncIOMotorDatabase) -> int:
    return await db.subscriptions.count_documents({"is_active": True})


async def _get_churn_rate(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> float:
    expired_count = await db.subscriptions.count_documents({
        "expiry_date": {"$gte": start, "$lt": end},
        "is_active": False,
    })
    active_at_start = await db.subscriptions.count_documents({
        "start_date": {"$lt": start},
        "$or": [
            {"expiry_date": {"$gte": start}},
            {"is_active": True},
        ],
    })
    if active_at_start == 0:
        return 0
    return round((expired_count / active_at_start) * 100, 1)


async def _get_revenue_trend(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, granularity: str
) -> List[RevenueTrendItem]:
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {
            "_id": _get_date_group_expr(granularity),
            "revenue": {"$sum": "$transaction_amount"},
        }},
        {"$sort": {"_id": 1}},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(366)
    return [
        RevenueTrendItem(
            date=_format_date_key(r["_id"], granularity),
            revenue=round(r["revenue"], 0),
        )
        for r in results
    ]


async def _get_user_growth(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, granularity: str
) -> List[UserGrowthItem]:
    baseline = await db.users.count_documents({"created_at": {"$lt": start}})

    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {
            "_id": _get_date_group_expr(granularity),
            "new_users": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    results = await db.users.aggregate(pipeline).to_list(366)

    items = []
    running_total = baseline
    for r in results:
        running_total += r["new_users"]
        items.append(UserGrowthItem(
            date=_format_date_key(r["_id"], granularity),
            total_users=running_total,
            new_users=r["new_users"],
        ))
    return items


async def _get_revenue_by_license(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> List[RevenueByLicenseItem]:
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {
            "_id": "$license_key",
            "revenue": {"$sum": "$transaction_amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"revenue": -1}},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(20)

    items = []
    for r in results:
        license_doc = await db.licenses.find_one({"key": r["_id"]})
        items.append(RevenueByLicenseItem(
            license_key=r["_id"] or "Unknown",
            license_name=license_doc["name"] if license_doc else r["_id"] or "Unknown",
            revenue=round(r["revenue"], 0),
            count=r["count"],
        ))
    return items


async def _get_subscription_distribution(
    db: AsyncIOMotorDatabase,
) -> List[SubscriptionDistributionItem]:
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$license_key", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await db.subscriptions.aggregate(pipeline).to_list(20)

    items = []
    for r in results:
        license_doc = await db.licenses.find_one({"key": r["_id"]})
        items.append(SubscriptionDistributionItem(
            license_key=r["_id"] or "Unknown",
            license_name=license_doc["name"] if license_doc else r["_id"] or "Unknown",
            count=r["count"],
        ))
    return items


async def _get_transaction_status(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> TransactionStatusStats:
    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$payment_status", "count": {"$sum": 1}}},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(10)
    stats = TransactionStatusStats()
    for r in results:
        status = r["_id"]
        if status == "succeeded":
            stats.succeeded = r["count"]
        elif status == "pending":
            stats.pending = r["count"]
        elif status == "canceled":
            stats.canceled = r["count"]
    return stats


async def _get_top_promotions(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, limit: int = 5
) -> List[TopPromotionItem]:
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
            "promotion_code_applied": {"$ne": None, "$exists": True},
        }},
        {"$group": {
            "_id": "$promotion_code_applied",
            "usage_count": {"$sum": 1},
            "total_discount": {"$sum": {"$ifNull": ["$promotion_discount_amount", 0]}},
        }},
        {"$sort": {"usage_count": -1}},
        {"$limit": limit},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(limit)
    return [
        TopPromotionItem(
            code=r["_id"],
            usage_count=r["usage_count"],
            total_discount=round(r["total_discount"], 0),
        )
        for r in results
    ]


async def _get_top_brokers(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, limit: int = 5
) -> List[TopBrokerItem]:
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
            "broker_code_applied": {"$ne": None, "$exists": True},
        }},
        {"$group": {
            "_id": "$broker_code_applied",
            "total_revenue": {"$sum": "$transaction_amount"},
            "order_count": {"$sum": 1},
        }},
        {"$sort": {"total_revenue": -1}},
        {"$limit": limit},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(limit)

    items = []
    for r in results:
        broker_doc = await db.brokers.find_one({"broker_code": r["_id"]})
        broker_name = r["_id"]
        if broker_doc:
            user_doc = await db.users.find_one({"_id": broker_doc.get("user_id")})
            if user_doc:
                broker_name = user_doc.get("full_name", r["_id"])
        items.append(TopBrokerItem(
            broker_code=r["_id"],
            broker_name=broker_name,
            total_revenue=round(r["total_revenue"], 0),
            order_count=r["order_count"],
        ))
    return items


async def _get_recent_transactions(
    db: AsyncIOMotorDatabase, limit: int = 10
) -> List[RecentTransactionItem]:
    cursor = db.transactions.find().sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        buyer_email = ""
        if doc.get("buyer_user_id"):
            user_doc = await db.users.find_one({"_id": doc["buyer_user_id"]})
            if user_doc:
                buyer_email = user_doc.get("email", "")
        items.append(RecentTransactionItem(
            id=str(doc["_id"]),
            buyer_email=buyer_email,
            license_key=doc.get("license_key", ""),
            transaction_amount=doc.get("transaction_amount", 0),
            payment_status=doc.get("payment_status", ""),
            transaction_type=doc.get("transaction_type", ""),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
        ))
    return items


async def get_dashboard_stats(
    db: AsyncIOMotorDatabase,
    start_date: datetime,
    end_date: datetime,
) -> DashboardStatsResponse:
    period_delta = end_date - start_date
    prev_start = start_date - period_delta
    prev_end = start_date

    granularity = _get_granularity(start_date, end_date)

    # KPIs — current period
    current_revenue = await _get_revenue_kpi(db, start_date, end_date)
    current_orders = await _get_order_count(db, start_date, end_date, "succeeded")
    current_new_users = await _get_new_users_count(db, start_date, end_date)
    current_active_subs = await _get_active_subscriptions_count(db)
    current_churn = await _get_churn_rate(db, start_date, end_date)
    current_pending = await _get_order_count(db, start_date, end_date, "pending")

    # KPIs — previous period
    prev_revenue = await _get_revenue_kpi(db, prev_start, prev_end)
    prev_orders = await _get_order_count(db, prev_start, prev_end, "succeeded")
    prev_new_users = await _get_new_users_count(db, prev_start, prev_end)
    prev_churn = await _get_churn_rate(db, prev_start, prev_end)
    prev_pending = await _get_order_count(db, prev_start, prev_end, "pending")

    # Charts & tables
    revenue_trend = await _get_revenue_trend(db, start_date, end_date, granularity)
    user_growth = await _get_user_growth(db, start_date, end_date, granularity)
    revenue_by_license = await _get_revenue_by_license(db, start_date, end_date)
    subscription_distribution = await _get_subscription_distribution(db)
    transaction_status = await _get_transaction_status(db, start_date, end_date)
    top_promotions = await _get_top_promotions(db, start_date, end_date)
    top_brokers = await _get_top_brokers(db, start_date, end_date)
    recent_transactions = await _get_recent_transactions(db)

    return DashboardStatsResponse(
        period=PeriodRange(start_date=start_date, end_date=end_date),
        previous_period=PeriodRange(start_date=prev_start, end_date=prev_end),
        granularity=granularity,
        kpis=KpiStats(
            total_revenue=KpiMetric(current=current_revenue, previous=prev_revenue),
            successful_orders=KpiMetric(current=current_orders, previous=prev_orders),
            new_users=KpiMetric(current=current_new_users, previous=prev_new_users),
            active_subscriptions=KpiMetric(current=current_active_subs, previous=current_active_subs),
            churn_rate=KpiMetric(current=current_churn, previous=prev_churn),
            pending_orders=KpiMetric(current=current_pending, previous=prev_pending),
        ),
        revenue_trend=revenue_trend,
        user_growth=user_growth,
        revenue_by_license=revenue_by_license,
        subscription_distribution=subscription_distribution,
        transaction_status=transaction_status,
        top_promotions=top_promotions,
        top_brokers=top_brokers,
        recent_transactions=recent_transactions,
    )
