# finext-fastapi/app/crud/sse/news_report.py
from typing import Any, Dict, Optional

from app.core.database import get_database
from app.crud.sse._helpers import STOCK_DB, OPERATION_TIMEOUT_MS


async def news_report(
    report_type: Optional[str] = None,
    categories: Optional[str] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    projection: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Lấy dữ liệu bản tin từ collection news_report với hỗ trợ pagination.
    Database: temp_stock.

    Args:
        report_type: Loại bản tin để filter (VD: daily, weekly, monthly)
        categories: Danh mục để filter, có thể 1 hoặc nhiều cách nhau bởi dấu phẩy (VD: trong_nuoc hoặc trong_nuoc,thong_cao)
        page: Số trang (bắt đầu từ 1)
        limit: Số lượng bản ghi mỗi trang
        sort_by: Tên field để sắp xếp (mặc định: created_at)
        sort_order: Thứ tự sắp xếp: asc hoặc desc (mặc định: desc)

    Returns:
        Dict chứa data và pagination info
    """
    stock_db = get_database(STOCK_DB)
    collection = stock_db.get_collection("news_report")

    # Build query
    find_query = {}
    if report_type:
        find_query["report_type"] = report_type

    # Hỗ trợ multiple categories với $in operator
    if categories:
        # Parse comma-separated string to list
        category_list = [c.strip() for c in categories.split(",") if c.strip()]
        if len(category_list) == 1:
            find_query["category"] = category_list[0]
        elif len(category_list) > 1:
            find_query["category"] = {"$in": category_list}

    # Đếm tổng số documents
    total = await collection.count_documents(find_query)

    # Xử lý pagination defaults
    page = page or 1
    limit = limit or 20
    skip = (page - 1) * limit

    # Xử lý sort - mặc định theo created_at giảm dần (tin mới nhất trước)
    sort_field = sort_by or "created_at"
    sort_direction = -1 if (sort_order or "desc") == "desc" else 1

    # Sử dụng projection truyền vào hoặc mặc định
    if projection is None:
        projection = {"_id": 0}
    cursor = collection.find(find_query, projection)
    cursor.sort(sort_field, sort_direction)
    cursor.skip(skip)
    cursor.limit(limit)
    cursor.max_time_ms(OPERATION_TIMEOUT_MS)

    docs = await cursor.to_list(length=limit)

    # Tính pagination info
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return {
        "items": docs,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }
