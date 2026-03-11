# finext-fastapi/app/crud/sse/report_article.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB


async def report_article(
    report_slug: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy thông tin 1 báo cáo theo report_slug.
    Query trực tiếp từ DB theo field report_slug.
    Database: temp_stock.

    Args:
        report_slug: Slug của báo cáo (URL-friendly title, đã lưu trong DB)

    Returns:
        Dict chứa thông tin báo cáo hoặc None nếu không tìm thấy
    """
    if not report_slug:
        return {"report": None, "error": "report_slug is required"}

    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_report")

    # Lấy đầy đủ thông tin cho hiển thị
    projection = {"_id": 0}

    # Query trực tiếp theo report_slug
    doc = await collection.find_one({"report_slug": report_slug}, projection)

    if doc:
        return {"report": doc}

    return {"report": None, "error": "Report not found"}
