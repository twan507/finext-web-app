# finext-fastapi/app/crud/sse/news_count.py
import logging
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB

logger = logging.getLogger(__name__)


async def news_count(
    type: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Đếm số lượng tin tức theo type.
    - Tin tức (news_daily): đếm ngày hôm nay
    - Báo cáo (news_report): đếm ngày hôm qua
    Chỉ lấy các field cần thiết để đếm, không lấy nội dung.
    Database: temp_stock.

    Args:
        type: Loại tin tức để filter (VD: thong_cao, trong_nuoc, doanh_nghiep, quoc_te)
              Nếu không truyền sẽ trả về tất cả types

    Returns:
        Dict chứa count theo từng type và tổng
    """
    from datetime import datetime, timezone, timedelta

    stock_db = get_database(STOCK_DB)

    # Lấy thời gian theo timezone Vietnam (UTC+7)
    vietnam_offset = timedelta(hours=7)
    vietnam_tz = timezone(vietnam_offset)
    now = datetime.now(vietnam_tz)

    # Ngày hôm nay (cho tin tức)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_str = today_start.isoformat()

    # Ngày hôm qua (cho bản tin)
    yesterday = now - timedelta(days=1)
    yesterday_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start_str = yesterday_start.isoformat()

    logger.info(f"[news_count] Current time (VN): {now.isoformat()}")
    logger.info(f"[news_count] Today start (VN): {today_start_str}")
    logger.info(f"[news_count] Yesterday start (VN): {yesterday_start_str}")

    result = {
        "date": now.strftime("%Y-%m-%d"),
        "today_start": today_start_str,
        "sources": {},
        "total": 0,
        "debug": {},
    }

    # Đếm tin từ news_daily
    news_collection = stock_db.get_collection("news_daily")

    # Các loại tin cần đếm
    news_types = ["thong_cao", "trong_nuoc", "doanh_nghiep", "quoc_te"]

    if type:
        news_types = [type]

    for news_type in news_types:
        # Query đếm tin trong ngày hôm nay theo news_type (tin tức từ news_daily)
        count_query = {"news_type": news_type, "created_at": {"$gte": today_start_str}}
        count = await news_collection.count_documents(count_query)
        result["sources"][news_type] = count
        result["total"] += count
        logger.info(f"[news_count] Type '{news_type}': {count} articles (query: created_at >= {today_start_str})")

        # Debug: lấy tin mới nhất để xem
        newest_doc = await news_collection.find_one({"news_type": news_type}, {"created_at": 1, "_id": 0}, sort=[("created_at", -1)])
        if newest_doc:
            newest_created_at = newest_doc.get("created_at")
            result["debug"][f"{news_type}_newest"] = newest_created_at
            logger.info(f"[news_count] Newest article for '{news_type}': {newest_created_at}")

            # Test: đếm tất cả tin có created_at >= newest - 1 ngày
            if count == 0:
                # Thử parse và so sánh
                try:
                    from datetime import datetime

                    # Parse newest_created_at
                    if isinstance(newest_created_at, str):
                        # Thử lấy tổng số tin của news_type này
                        total_type = await news_collection.count_documents({"news_type": news_type})
                        logger.info(f"[news_count] Total articles for '{news_type}': {total_type}")
                except Exception as e:
                    logger.error(f"[news_count] Error parsing date: {e}")

    # Đếm báo cáo từ news_report - LÙI 1 NGÀY (nếu không filter theo type cụ thể của news_daily)
    if not type or type == "news_report":
        report_collection = stock_db.get_collection("news_report")
        report_count_query = {
            "created_at": {"$gte": yesterday_start_str}  # Dùng yesterday cho bản tin
        }
        report_count = await report_collection.count_documents(report_count_query)
        result["sources"]["news_report"] = report_count
        result["total"] += report_count
        logger.info(f"[news_count] news_report: {report_count} reports (query: created_at >= {yesterday_start_str})")

        # Debug sample
        if report_count == 0:
            sample_report = await report_collection.find_one({}, {"created_at": 1, "_id": 0})
            if sample_report:
                logger.info(f"[news_count] Sample created_at for 'news_report': {sample_report.get('created_at')}")

    return result
