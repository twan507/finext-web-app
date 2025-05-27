# finext-fastapi/app/routers/sse.py
import asyncio
import logging
import json
from datetime import datetime
from typing import Optional, Any, Dict

from fastapi import APIRouter, Depends, Request, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Định nghĩa sẵn các bộ lọc (Named Filters) ---
# Bạn có thể mở rộng đối tượng này với nhiều collection và filter hơn
PREDEFINED_FILTERS: Dict[str, Dict[str, Any]] = {
    "eod_index": {
        "all": {},
        "only_spot": {"type": "spot"},
        "only_future": {"type": "future"},
    },
    "eod_stock": {
        "all": {},
        "vin_group": {"symbol": {"$in": ["VIC", "VHM", "VRE"]}},
        "blue_chips_high_volume": {"group": "bluechip", "volume": {"$gt": 1000000}}
    }
}

# --- Helper để chuyển đổi BSON sang JSON ---
def bson_to_json_str(data: Any) -> str:
    def default_serializer(o):
        if isinstance(o, (ObjectId, datetime)):
            return str(o)
        try:
            return str(o)
        except Exception:
            raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable and failed str conversion")
    return json.dumps(data, default=default_serializer)

# --- Generator mới ---
async def named_filter_event_generator(
    request: Request,
    db: AsyncIOMotorDatabase,
    collection_name: str,
    filter_name: Optional[str] = None
):
    last_data_hash = None
    query_filter: Dict[str, Any] = {}

    try:
        # 1. Kiểm tra collection tồn tại
        existing_collections = await db.list_collection_names()
        if collection_name not in existing_collections:
            logger.warning(f"Client yêu cầu collection không tồn tại trong stock_db: {collection_name}")
            yield f"data: {json.dumps({'error': f'Collection {collection_name} không tồn tại.'})}\n\n"
            return

        collection = db.get_collection(collection_name)

        # 2. Lấy query_filter từ PREDEFINED_FILTERS
        if filter_name:
            if collection_name in PREDEFINED_FILTERS and \
               filter_name in PREDEFINED_FILTERS[collection_name]:
                query_filter = PREDEFINED_FILTERS[collection_name][filter_name]
                logger.info(f"Áp dụng bộ lọc đặt tên '{filter_name}' cho collection '{collection_name}': {query_filter}")
            else:
                logger.warning(f"Bộ lọc đặt tên '{filter_name}' không hợp lệ hoặc không tìm thấy cho collection '{collection_name}'. Sẽ lấy tất cả (nếu có filter 'all').")
                # Mặc định lấy 'all' nếu filter_name không hợp lệ nhưng collection có 'all'
                if collection_name in PREDEFINED_FILTERS and "all" in PREDEFINED_FILTERS[collection_name]:
                     query_filter = PREDEFINED_FILTERS[collection_name]["all"]
                     logger.info(f"Sử dụng bộ lọc 'all' mặc định cho collection '{collection_name}'.")
                # else: để query_filter là {} (lấy tất cả)
        elif collection_name == "eod_index" and "only_spot" in PREDEFINED_FILTERS.get("eod_index", {}):
            # Mặc định cho eod_index nếu không có filter_name
            query_filter = PREDEFINED_FILTERS["eod_index"]["only_spot"]
            logger.info(f"Không có filter_name, sử dụng bộ lọc mặc định 'only_spot' cho collection 'eod_index': {query_filter}")
        else:
            logger.info(f"Không có filter_name, sẽ lấy tất cả bản ghi (hoặc theo filter 'all' nếu có) cho collection '{collection_name}'.")
            if collection_name in PREDEFINED_FILTERS and "all" in PREDEFINED_FILTERS[collection_name]:
                query_filter = PREDEFINED_FILTERS[collection_name]["all"]


        logger.info(f"Bắt đầu polling collection '{collection_name}' với query: {query_filter}")

        while True:
            if await request.is_disconnected():
                logger.info(f"Client đã ngắt kết nối khỏi polling stream ({collection_name}).")
                break

            try:
                data_cursor = collection.find(query_filter).sort([("_id", -1)]).limit(20)
                current_data = await data_cursor.to_list(length=20)
            except Exception as db_error:
                logger.error(f"Lỗi khi truy vấn MongoDB collection '{collection_name}' với query '{query_filter}': {db_error}", exc_info=True)
                yield f"data: {json.dumps({'error': f'Lỗi truy vấn CSDL: {str(db_error)}'})}\n\n"
                await asyncio.sleep(5)
                continue

            current_data_str = bson_to_json_str(current_data)
            current_hash = hash(current_data_str)

            if current_data and current_hash != last_data_hash:
                yield f"data: {current_data_str}\n\n"
                logger.debug(f"Đã gửi SSE (polling {collection_name}, filter: {filter_name or 'default'}): {len(current_data)} bản ghi.")
                last_data_hash = current_hash
            elif not current_data and current_hash != last_data_hash:
                yield f"data: {json.dumps([])}\n\n"
                logger.debug(f"Đã gửi mảng rỗng cho {collection_name} (filter: {filter_name or 'default'}) vì không có dữ liệu.")
                last_data_hash = current_hash

            await asyncio.sleep(3)

    except asyncio.CancelledError:
        logger.info(f"Polling stream ({collection_name}, filter: {filter_name or 'default'}) đã bị hủy.")
    except Exception as e:
        logger.error(f"Lỗi trong quá trình polling SSE ({collection_name}, filter: {filter_name or 'default'}): {e}", exc_info=True)
        try:
            yield f"data: {json.dumps({'error': f'Lỗi server khi xử lý: {str(e)}'})}\n\n"
        except Exception:
            pass
    finally:
        logger.info(f"Đã đóng polling generator ({collection_name}, filter: {filter_name or 'default'}).")

@router.get(
    "/stream/{collection_name_param:path}",
    summary="Mở một kết nối SSE công khai, với bộ lọc đặt tên",
    description="""Lấy dữ liệu từ `collection_name_param` trong `stock_db`.
    Sử dụng tham số `filter_name` để chọn một bộ lọc đã định nghĩa sẵn ở server.
    Ví dụ: `?filter_name=only_spot` cho collection `eod_index`.
    """,
    tags=["sse"],
)
async def named_filter_sse_endpoint(
    request: Request,
    collection_name_param: str,
    filter_name: Optional[str] = Query(None, description="Tên của bộ lọc đã định nghĩa sẵn. Ví dụ: 'only_spot', 'vn30_spot'"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("stock_db"))
):
    if db is None:
        logger.error("Không thể kết nối tới stock_db cho SSE.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không thể kết nối tới cơ sở dữ liệu stock."
        )

    if not collection_name_param:
        logger.warning("Yêu cầu SSE không có tên collection cụ thể.")
        raise HTTPException(status_code=404, detail="Tên collection là bắt buộc.")

    logger.info(f"Client đang kết nối tới NAMED FILTER SSE stream (collection: {collection_name_param}, filter_name: {filter_name}) trên stock_db...")
    return StreamingResponse(
        named_filter_event_generator(request, db, collection_name_param, filter_name),
        media_type="text/event-stream"
    )