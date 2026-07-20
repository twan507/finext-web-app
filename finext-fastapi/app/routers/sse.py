# finext-fastapi/app/routers/sse.py
"""
Router SSE với giao thức chuẩn hóa.
Chỉ có 1 API duy nhất, sử dụng keyword để xác định loại dữ liệu cần lấy.

Kiến trúc shared in-process cache:
    - Mỗi cặp (keyword, ticker) chỉ có 1 background poller chạy trong worker.
    - Mọi subscriber chia sẻ cùng 1 nguồn dữ liệu → tránh N query DB / 3s khi có N user.
    - Khi không còn subscriber nào, poller tự dừng và cache entry bị xoá.
"""

import asyncio
import logging
import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional, Set

from fastapi import APIRouter, Request, HTTPException, status, Query
from fastapi.responses import StreamingResponse, JSONResponse
from bson import ObjectId

from app.crud.sse import execute_sse_query, get_available_keywords
from app.utils.response_wrapper import StandardApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Cấu hình
SSE_POLL_INTERVAL = 3.0          # giây giữa các lần poll DB
SSE_SUBSCRIBER_QUEUE_SIZE = 8    # buffer cho mỗi subscriber, slow consumer sẽ bị drop
SSE_CLIENT_TIMEOUT = 10.0        # giây giữa các lần check disconnect
SSE_ERROR_BACKOFF = 5.0          # giây nghỉ khi query lỗi

# --- Hardening: chống bùng nổ tải (DoS) ---
# SSE để public (dữ liệu thị trường ai cũng xem) nhưng phải chịu tải an toàn.
# Mỗi cặp (keyword, ticker) sinh 1 background poller poll Mongo mỗi 3s → phải chặn
# kẻ xấu mở N kết nối ticker tuỳ ý làm bùng nổ poller đập Mongo standalone + phình RAM.
MAX_POLLERS = 200                # trần tổng số poller đồng thời (mỗi entry = 1 poller)
MAX_SUBSCRIBERS_PER_ENTRY = 1000 # trần subscriber cho 1 ticker "nóng" → bound RAM
MAX_TICKER_LENGTH = 64           # độ dài tối đa của tham số ticker (kể cả comma list)
MAX_TICKER_TOKENS = 30           # số mã tối đa trong 1 comma-separated ticker
# Ticker hợp lệ = chữ + số (mã CK/chỉ số/ngành VN), độ dài mỗi mã tối đa 20.
_TICKER_TOKEN_RE = re.compile(r"^[A-Za-z0-9]{1,20}$")


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


# ==============================================================================
# SHARED IN-PROCESS CACHE
# ==============================================================================


@dataclass
class _CacheEntry:
    last_payload: Optional[str] = None   # "data: ...\n\n" cuối cùng (dùng cho subscriber mới)
    last_hash: Optional[int] = None
    subscribers: Set[asyncio.Queue] = field(default_factory=set)
    task: Optional[asyncio.Task] = None


_cache: Dict[str, _CacheEntry] = {}
_cache_lock = asyncio.Lock()


def _cache_key(keyword: str, ticker: Optional[str]) -> str:
    return f"{keyword}|{ticker or ''}"


def _validate_ticker(ticker: Optional[str]) -> None:
    """
    Validate FORMAT của ticker (không round-trip DB).
    None/rỗng hợp lệ (nhiều keyword không cần ticker). Hỗ trợ comma-separated list.
    Ticker sai format → HTTPException 400, KHÔNG tạo poller.
    """
    if not ticker:
        return
    if len(ticker) > MAX_TICKER_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticker không hợp lệ")
    tokens = [t.strip() for t in ticker.split(",")]
    non_empty = [t for t in tokens if t]
    if not non_empty or len(non_empty) > MAX_TICKER_TOKENS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticker không hợp lệ")
    for tok in non_empty:
        if not _TICKER_TOKEN_RE.match(tok):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticker không hợp lệ")


async def _poller(cache_key: str, keyword: str, ticker: Optional[str]):
    """Background task: poll DB và broadcast tới mọi subscriber của 1 cache entry."""
    logger.info(f"SSE poller started: {cache_key}")
    try:
        while True:
            entry = _cache.get(cache_key)
            if entry is None or not entry.subscribers:
                break

            try:
                data = await execute_sse_query(keyword, ticker)
                payload_str = bson_to_json_str(data)
                payload_hash = hash(payload_str)

                if payload_hash != entry.last_hash:
                    entry.last_hash = payload_hash
                    entry.last_payload = f"data: {payload_str}\n\n"
                    # Broadcast non-blocking — slow subscriber sẽ bị drop frame
                    for q in list(entry.subscribers):
                        try:
                            q.put_nowait(entry.last_payload)
                        except asyncio.QueueFull:
                            logger.debug(f"Subscriber queue full, dropping frame: {cache_key}")
            except ValueError as ve:
                # Invalid keyword — phát error 1 lần và terminate poller
                err_payload = f"data: {json.dumps({'error': str(ve), 'type': 'invalid_keyword'})}\n\n"
                for q in list(entry.subscribers):
                    try:
                        q.put_nowait(err_payload)
                    except asyncio.QueueFull:
                        pass
                logger.warning(f"SSE poller stopping due to invalid keyword: {ve}")
                break
            except Exception as e:
                logger.error(f"SSE poller query error ({cache_key}): {e}", exc_info=True)
                # KHÔNG lộ chi tiết exception ra client — chỉ log nội bộ.
                err_payload = f"data: {json.dumps({'error': 'Database query failed', 'type': 'query_error'})}\n\n"
                for q in list(entry.subscribers):
                    try:
                        q.put_nowait(err_payload)
                    except asyncio.QueueFull:
                        pass
                await asyncio.sleep(SSE_ERROR_BACKOFF)
                continue

            await asyncio.sleep(SSE_POLL_INTERVAL)
    except asyncio.CancelledError:
        logger.info(f"SSE poller cancelled: {cache_key}")
        raise
    finally:
        # Cleanup cache entry nếu không còn subscriber
        async with _cache_lock:
            entry = _cache.get(cache_key)
            if entry is not None and not entry.subscribers:
                _cache.pop(cache_key, None)
        logger.info(f"SSE poller stopped: {cache_key}")


async def _subscribe(keyword: str, ticker: Optional[str]) -> tuple[str, asyncio.Queue]:
    """Đăng ký subscriber mới. Trả về (cache_key, queue)."""
    key = _cache_key(keyword, ticker)
    queue: asyncio.Queue = asyncio.Queue(maxsize=SSE_SUBSCRIBER_QUEUE_SIZE)

    async with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            # Tạo entry mới = tạo poller mới → chặn nếu đã chạm trần tổng poller.
            if len(_cache) >= MAX_POLLERS:
                logger.warning(f"SSE poller cap reached ({MAX_POLLERS}), rejecting: {key}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Hệ thống dữ liệu realtime đang quá tải, vui lòng thử lại sau.",
                )
            entry = _CacheEntry()
            _cache[key] = entry

        # Chặn 1 ticker "nóng" ngốn RAM vô hạn — không thêm subscriber khi vượt trần.
        if len(entry.subscribers) >= MAX_SUBSCRIBERS_PER_ENTRY:
            logger.warning(f"SSE subscriber cap reached ({MAX_SUBSCRIBERS_PER_ENTRY}), rejecting: {key}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Hệ thống dữ liệu realtime đang quá tải, vui lòng thử lại sau.",
            )

        entry.subscribers.add(queue)

        # Đẩy ngay payload cache cuối (nếu có) → subscriber mới không phải chờ 3s
        if entry.last_payload is not None:
            try:
                queue.put_nowait(entry.last_payload)
            except asyncio.QueueFull:
                pass

        # Start poller nếu chưa chạy
        if entry.task is None or entry.task.done():
            entry.task = asyncio.create_task(_poller(key, keyword, ticker))

    return key, queue


async def _unsubscribe(cache_key: str, queue: asyncio.Queue):
    """Huỷ subscriber. Nếu không còn subscriber nào, cancel poller + dọn entry."""
    async with _cache_lock:
        entry = _cache.get(cache_key)
        if entry is None:
            return
        entry.subscribers.discard(queue)
        if not entry.subscribers:
            if entry.task and not entry.task.done():
                entry.task.cancel()
            # Dọn entry ngay để giải phóng slot poller — không phụ thuộc hoàn toàn vào
            # finally của poller (poller có thể bị cancel trước khi kịp chạy finally → rò slot).
            _cache.pop(cache_key, None)


# --- SSE Event Generator (per-client) ---
async def sse_event_generator(request: Request, cache_key: str, queue: asyncio.Queue):
    """
    Per-client generator: yield payload từ queue đã subscribe sẵn.
    Subscribe (kèm validate + cap) được thực hiện ở endpoint TRƯỚC khi stream mở,
    để lỗi 400/503 trở thành HTTP response thật thay vì lỗi giữa dòng stream.
    DB không được poll trực tiếp ở đây — poller chung lo phần đó.
    """
    logger.info(f"SSE client subscribed: {cache_key}")

    try:
        while True:
            if await request.is_disconnected():
                logger.info(f"SSE client disconnected: {cache_key}")
                break
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=SSE_CLIENT_TIMEOUT)
                yield payload
            except asyncio.TimeoutError:
                # Heartbeat — giữ connection alive khi không có dữ liệu mới
                yield ": heartbeat\n\n"
    except asyncio.CancelledError:
        logger.info(f"SSE client cancelled: {cache_key}")
    except Exception as e:
        logger.error(f"SSE client error ({cache_key}): {e}", exc_info=True)
        # KHÔNG lộ chi tiết exception ra client — chỉ log nội bộ.
        try:
            yield f"data: {json.dumps({'error': 'Stream error', 'type': 'stream_error'})}\n\n"
        except Exception:
            pass
    finally:
        await _unsubscribe(cache_key, queue)
        logger.info(f"SSE client closed: {cache_key}")


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

    # Validate ticker FORMAT trước → ticker sai KHÔNG tạo poller (trả 400).
    _validate_ticker(ticker)

    logger.info(f"Client connecting to SSE stream - keyword: {keyword}, ticker: {ticker}")

    # Subscribe TRƯỚC khi mở stream: cap poller/subscriber sẽ trả 503 như HTTP response
    # thật (thay vì lỗi giữa dòng stream nếu subscribe nằm trong generator).
    cache_key, queue = await _subscribe(keyword, ticker)

    return StreamingResponse(
        sse_event_generator(request, cache_key, queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
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
    nntd_type: Optional[str] = Query(None, description="Loại giao dịch NNTD: 'NN' (nước ngoài) hoặc 'TD' (tự doanh)"),
    news_type: Optional[str] = Query(None, description="Loại tin tức (VD: thong_cao, trong_nuoc, doanh_nghiep, quoc_te)"),
    categories: Optional[str] = Query(
        None, description="Danh mục, có thể 1 hoặc nhiều cách nhau bởi dấu phẩy (VD: thi-truong hoặc thi-truong,doanh-nghiep)"
    ),
    report_type: Optional[str] = Query(None, description="Loại bản tin (VD: daily, weekly, monthly)"),
    article_slug: Optional[str] = Query(None, description="Slug của bài viết (cho keyword news_article)"),
    report_slug: Optional[str] = Query(None, description="Slug của báo cáo (cho keyword report_article)"),
    page: Optional[int] = Query(None, ge=1, description="Số trang (bắt đầu từ 1)"),
    limit: Optional[int] = Query(None, ge=1, le=5000, description="Số lượng bản ghi (tối đa 5000)"),
    skip: Optional[int] = Query(None, ge=0, description="Số bản ghi bỏ qua từ cuối (dùng cho lazy load chart)"),
    sort_by: Optional[str] = Query(None, description="Tên field để sắp xếp"),
    sort_order: Optional[str] = Query(None, regex="^(asc|desc)$", description="Thứ tự sắp xếp: asc hoặc desc"),
    projection: Optional[str] = Query(None, description='MongoDB projection dạng JSON (VD: {"title":1,"sapo":1})'),
    search: Optional[str] = Query(None, description="Từ khóa tìm kiếm text (dùng cho search_news, search_reports)"),
):
    """
    REST endpoint để query dữ liệu một lần.
    Dùng cho các trường hợp cần polling hoặc fetch đơn lẻ thay vì SSE stream.

    Hỗ trợ tất cả các keyword trong SSE_QUERY_REGISTRY.
    Hỗ trợ pagination với page, limit, sort_by, sort_order.
    Hỗ trợ filter nhiều categories với param 'categories' (comma-separated).
    """
    # Validate keyword trước
    available_keywords = get_available_keywords()
    if keyword not in available_keywords:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid keyword '{keyword}'. Available: {', '.join(available_keywords)}",
        )

    try:
        # Parse projection từ JSON string
        parsed_projection = None
        if projection:
            try:
                parsed_projection = json.loads(projection)
                # Luôn exclude _id
                parsed_projection["_id"] = 0
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid projection JSON format",
                )

        # Tạo dict chứa các tham số tuỳ chọn
        query_params = {
            "ticker": ticker,
            "nntd_type": nntd_type,
            "news_type": news_type,
            "categories": categories,
            "report_type": report_type,
            "article_slug": article_slug,
            "report_slug": report_slug,
            "page": page,
            "limit": limit,
            "skip": skip,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "projection": parsed_projection,
            "search": search,
        }

        result = await execute_sse_query(keyword, **query_params)
        # Serialize data với custom encoder để xử lý ObjectId, datetime, nan
        serialized_data = json.loads(bson_to_json_str(result))

        return JSONResponse(
            content=StandardApiResponse(status=200, message="Truy vấn dữ liệu thành công", data=serialized_data).model_dump()
        )
    except HTTPException:
        # Lỗi validate đã có status/detail rõ ràng (VD: projection JSON sai) — giữ nguyên.
        raise
    except Exception as e:
        logger.error(f"REST query error (keyword: {keyword}): {e}", exc_info=True)
        # KHÔNG lộ chi tiết exception ra client — chỉ log nội bộ.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Đã xảy ra lỗi khi truy vấn dữ liệu.")
