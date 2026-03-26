# finext-fastapi/app/routers/dashboard.py
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.auth.access import require_permission
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.schemas.dashboard import DashboardStatsResponse
from app.crud import dashboard as crud_dashboard

logger = logging.getLogger(__name__)
router = APIRouter(tags=["dashboard"])


@router.get(
    "/stats",
    response_model=StandardApiResponse[DashboardStatsResponse],
    summary="[Admin] Get dashboard statistics with date range",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
)
@api_response_wrapper(default_success_message="Dashboard stats retrieved successfully.")
async def get_dashboard_stats(
    start_date: datetime = Query(
        None,
        description="Start date (ISO format). Default: 30 days ago",
    ),
    end_date: datetime = Query(
        None,
        description="End date (ISO format). Default: now",
    ),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    now = datetime.now(timezone.utc)

    if end_date is None:
        end_date = now
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    # Ensure timezone-aware
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)

    if start_date >= end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before end_date",
        )

    return await crud_dashboard.get_dashboard_stats(db, start_date, end_date)
