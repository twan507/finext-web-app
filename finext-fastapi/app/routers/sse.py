# finext-fastapi/app/routers/sse.py
"""
Router SSE với giao thức chuẩn hóa.
Chỉ có 1 API duy nhất, sử dụng keyword để xác định loại dữ liệu cần lấy.
"""

import asyncio
import logging
import json
import math
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Request, HTTPException, status, Query
from fastapi.responses import StreamingResponse, JSONResponse
from bson import ObjectId

from app.crud.sse import execute_sse_query, get_available_keywords
from app.utils.response_wrapper import StandardApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Helper để chuyển đổi BSON sang JSON ---
def clean_nan_values(obj: Any) -> Any:
    """Đệ quy thay thế các giá trị nan/inf bằng None."""
    if isinstance(obj, dict):
        return {k: clean_nan_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj


def bson_to_json_str(data: Any) -> str:
    """Chuyển đổi dữ liệu BSON thành JSON string, xử lý nan/inf."""

    def default_serializer(o):
        if isinstance(o, (ObjectId, datetime)):
            return str(o)
        try:
            return str(o)
        except Exception:
            raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

    # Clean nan/inf values trước khi serialize
    cleaned_data = clean_nan_values(data)
    return json.dumps(cleaned_data, default=default_serializer)


# --- SSE Event Generator ---
async def sse_event_generator(request: Request, keyword: str, ticker: Optional[str] = None):
    """
    Generator cho SSE stream dựa trên keyword.
    Database được chọn tự động trong từng hàm query.

    Args:
        request: FastAPI request object
        keyword: Từ khóa xác định loại query
        ticker: Mã ticker (VD: VNINDEX, VN30, ...)
    """
    last_data_hash = None

    logger.info(f"SSE stream started - keyword: {keyword}, ticker: {ticker}")

    try:
        while True:
            if await request.is_disconnected():
                logger.info(f"Client disconnected from SSE stream (keyword: {keyword})")
                break

            try:
                current_data = await execute_sse_query(keyword, ticker)
                current_data_str = bson_to_json_str(current_data)
                current_hash = hash(current_data_str)

                if current_hash != last_data_hash:
                    yield f"data: {current_data_str}\n\n"
                    logger.debug(f"SSE sent (keyword: {keyword}): {len(current_data)} records")
                    last_data_hash = current_hash

            except ValueError as ve:
                error_msg = {"error": str(ve), "type": "invalid_keyword"}
                yield f"data: {json.dumps(error_msg)}\n\n"
                logger.warning(f"Invalid keyword: {ve}")
                return

            except Exception as query_error:
                logger.error(f"Query error (keyword: {keyword}): {query_error}", exc_info=True)
                error_msg = {"error": f"Database query failed: {str(query_error)}", "type": "query_error"}
                yield f"data: {json.dumps(error_msg)}\n\n"
                await asyncio.sleep(5)
                continue

            await asyncio.sleep(3)

    except asyncio.CancelledError:
        logger.info(f"SSE stream cancelled (keyword: {keyword})")
    except Exception as e:
        logger.error(f"SSE stream error (keyword: {keyword}): {e}", exc_info=True)
        try:
            yield f"data: {json.dumps({'error': str(e), 'type': 'stream_error'})}\n\n"
        except Exception:
            pass
    finally:
        logger.info(f"SSE stream closed (keyword: {keyword})")


# ==============================================================================
# API ENDPOINTS
# ==============================================================================


@router.get(
    "/stream",
    summary="SSE Stream - Lấy dữ liệu realtime theo keyword",
    description="Mở kết nối SSE để nhận dữ liệu realtime dựa trên keyword.",
    tags=["sse"],
)
async def sse_stream_endpoint(
    request: Request,
    keyword: str = Query(..., description="Từ khóa xác định loại dữ liệu cần lấy"),
    ticker: Optional[str] = Query(None, description="Mã ticker (VD: VNINDEX, VN30, ...)"),
):
    """Endpoint SSE chính - sử dụng keyword để xác định loại dữ liệu."""
    available_keywords = get_available_keywords()
    if keyword not in available_keywords:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid keyword '{keyword}'. Available: {', '.join(available_keywords)}"
        )

    logger.info(f"Client connecting to SSE stream - keyword: {keyword}, ticker: {ticker}")

    return StreamingResponse(
        sse_event_generator(request, keyword, ticker),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/keywords",
    summary="Lấy danh sách các keyword có sẵn",
    description="Trả về danh sách tất cả các keyword có thể sử dụng với SSE stream.",
    tags=["sse"],
)
async def get_keywords():
    """Lấy danh sách keyword có sẵn."""
    keywords = get_available_keywords()
    response_data = {"keywords": keywords, "total": len(keywords), "usage": "GET /api/v1/sse/stream?keyword=<keyword>&ticker=<ticker>"}
    return JSONResponse(
        content=StandardApiResponse(status=200, message="Lấy danh sách keyword thành công", data=response_data).model_dump()
    )


@router.get(
    "/rest/{keyword}",
    summary="REST Query - Lấy dữ liệu một lần (không stream)",
    description="Query dữ liệu một lần theo keyword, dùng cho REST calls và polling thay vì SSE stream. Hỗ trợ pagination.",
    tags=["sse"],
)
async def rest_query_endpoint(
    keyword: str,
    ticker: Optional[str] = Query(None, description="Mã ticker (VD: VNINDEX, VN30, ...)"),
    source: Optional[str] = Query(None, description="Nguồn tin (VD: chinhphu.vn, cafef.vn, vietstock.vn)"),
    category: Optional[str] = Query(None, description="Danh mục tin tức (VD: thi-truong, doanh-nghiep)"),
    report_type: Optional[str] = Query(None, description="Loại bản tin (VD: doanh_nghiep)"),
    page: Optional[int] = Query(None, ge=1, description="Số trang (bắt đầu từ 1)"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Số lượng bản ghi mỗi trang (tối đa 100)"),
    sort_by: Optional[str] = Query(None, description="Tên field để sắp xếp"),
    sort_order: Optional[str] = Query(None, regex="^(asc|desc)$", description="Thứ tự sắp xếp: asc hoặc desc"),
):
    """
    REST endpoint để query dữ liệu một lần.
    Dùng cho các trường hợp cần polling hoặc fetch đơn lẻ thay vì SSE stream.

    Hỗ trợ tất cả các keyword trong SSE_QUERY_REGISTRY.
    Hỗ trợ pagination với page, limit, sort_by, sort_order.
    """
    # Validate keyword trước
    available_keywords = get_available_keywords()
    if keyword not in available_keywords:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid keyword '{keyword}'. Available: {', '.join(available_keywords)}",
        )

    try:
        # Tạo dict chứa các tham số tuỳ chọn
        query_params = {
            "ticker": ticker,
            "source": source,
            "category": category,
            "report_type": report_type,
            "page": page,
            "limit": limit,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }

        result = await execute_sse_query(keyword, **query_params)
        # Serialize data với custom encoder để xử lý ObjectId, datetime, nan
        serialized_data = json.loads(bson_to_json_str(result))

        return JSONResponse(
            content=StandardApiResponse(status=200, message="Truy vấn dữ liệu thành công", data=serialized_data).model_dump()
        )
    except Exception as e:
        logger.error(f"REST query error (keyword: {keyword}): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Query failed: {str(e)}")
