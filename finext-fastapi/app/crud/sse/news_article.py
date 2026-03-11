# finext-fastapi/app/crud/sse/news_article.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB


async def news_article(
    article_slug: Optional[str] = None,
    projection: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy thông tin 1 bài viết theo article_slug.
    Query trực tiếp từ DB theo field article_slug.
    Database: temp_stock.

    Args:
        article_slug: Slug của bài viết (URL-friendly title, đã lưu trong DB)
        projection: MongoDB projection để chỉ lấy các field cần thiết

    Returns:
        Dict chứa thông tin bài viết hoặc None nếu không tìm thấy
    """
    if not article_slug:
        return {"article": None, "error": "article_slug is required"}

    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_daily")

    # Sử dụng projection truyền vào hoặc mặc định
    if projection is None:
        projection = {"_id": 0}

    # Query trực tiếp theo article_slug
    doc = await collection.find_one({"article_slug": article_slug}, projection)

    if doc:
        return {"article": doc}

    return {"article": None, "error": "Article not found"}
