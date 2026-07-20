"""
Test hardening cho SSE router (chống bùng nổ tải / DoS).

Bao phủ:
    - Validate ticker FORMAT (chấp nhận mã hợp lệ, từ chối rác) → không tạo poller.
    - Trần MAX_POLLERS → từ chối poller mới (503).
    - Trần subscriber mỗi entry → từ chối (503).
    - Poller bị cancel + entry được dọn khi hết subscriber.
    - Exception KHÔNG lộ str(e) ra client.

Tất cả test gọi trực tiếp các hàm (unit) — không dựng server thật.
"""

import asyncio

import pytest
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

import app.routers.sse as sse


@pytest.fixture(autouse=True)
def _isolate_cache():
    """Cô lập shared in-process cache giữa các test."""
    sse._cache.clear()
    yield
    sse._cache.clear()


class _DummyRequest:
    """Request giả — endpoint chỉ dùng request bên trong generator (không chạy ở đây)."""

    async def is_disconnected(self) -> bool:
        return True


async def _stub_query(keyword, ticker=None, **kwargs):
    """Stub execute_sse_query — không đụng DB."""
    return []


# ---------------------------------------------------------------------------
# 1. Validate ticker FORMAT
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "ticker",
    [
        None,
        "",
        "FPT",
        "fpt",
        "VNINDEX",
        "VN30F1M",
        "FNX100",
        "BAOHIEM,NGANHANG,BDS",
        "BAOHIEM, NGANHANG",  # có khoảng trắng sau dấu phẩy (được strip)
        "A,,,,B",  # empty token bị bỏ qua
    ],
)
def test_validate_ticker_accepts_valid(ticker):
    # Không raise là pass.
    sse._validate_ticker(ticker)


@pytest.mark.parametrize(
    "ticker",
    [
        "bad ticker!!",  # khoảng trắng + ký tự đặc biệt
        "FP T",  # khoảng trắng giữa token
        "DROP TABLE",  # SQL-ish
        "{$gt:1}",  # NoSQL operator injection attempt
        "../x",  # path traversal attempt
        "FPT;rm",  # command injection attempt
        "FPT-USD",  # ký tự '-' không thuộc tập cho phép (stream)
        "A" * 21,  # 1 token vượt độ dài mã tối đa (20)
        "A" * 65,  # vượt MAX_TICKER_LENGTH (64)
        ",",  # chỉ toàn dấu phẩy → không có token thật
        ",".join(["AB"] * 31),  # vượt MAX_TICKER_TOKENS (30)
    ],
)
def test_validate_ticker_rejects_invalid(ticker):
    with pytest.raises(HTTPException) as ei:
        sse._validate_ticker(ticker)
    assert ei.value.status_code == 400


# ---------------------------------------------------------------------------
# 2. Ticker sai format → endpoint 400, KHÔNG tạo poller
# ---------------------------------------------------------------------------
async def test_stream_endpoint_rejects_bad_ticker_no_poller(monkeypatch):
    # Stub để đảm bảo: nếu (vô tình) tạo poller thì cũng không đụng DB.
    monkeypatch.setattr(sse, "execute_sse_query", _stub_query)

    with pytest.raises(HTTPException) as ei:
        await sse.sse_stream_endpoint(
            _DummyRequest(), keyword="home_today_index", ticker="bad ticker!!"
        )

    assert ei.value.status_code == 400
    # Không có poller/entry nào được tạo.
    assert sse._cache == {}


# ---------------------------------------------------------------------------
# 3. Vượt MAX_POLLERS → 503, không tạo poller mới
# ---------------------------------------------------------------------------
async def test_subscribe_rejects_when_max_pollers_reached(monkeypatch):
    monkeypatch.setattr(sse, "MAX_POLLERS", 2)
    # Lấp đầy tới trần bằng entry giả (task=None → không có poller thật).
    sse._cache["k1"] = sse._CacheEntry()
    sse._cache["k2"] = sse._CacheEntry()

    with pytest.raises(HTTPException) as ei:
        await sse._subscribe("home_today_index", "FPT")

    assert ei.value.status_code == 503
    # Không tạo entry/poller mới.
    assert sse._cache_key("home_today_index", "FPT") not in sse._cache
    assert len(sse._cache) == 2


async def test_subscribe_existing_entry_allowed_at_cap(monkeypatch):
    """Đã chạm trần nhưng subscribe vào entry SẴN CÓ vẫn được (không đẻ poller mới)."""
    monkeypatch.setattr(sse, "MAX_POLLERS", 1)
    monkeypatch.setattr(sse, "execute_sse_query", _stub_query)

    key = sse._cache_key("home_today_index", "FPT")
    sse._cache[key] = sse._CacheEntry()  # entry sẵn có, len(_cache)==1==trần

    key2, q = await sse._subscribe("home_today_index", "FPT")

    assert key2 == key
    assert len(sse._cache) == 1  # không vượt trần
    entry = sse._cache[key]
    assert q in entry.subscribers

    # Dọn poller vừa được start.
    if entry.task is not None:
        entry.task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await entry.task


# ---------------------------------------------------------------------------
# 4. Trần subscriber mỗi entry → 503
# ---------------------------------------------------------------------------
async def test_subscribe_rejects_when_subscriber_cap_reached(monkeypatch):
    monkeypatch.setattr(sse, "MAX_SUBSCRIBERS_PER_ENTRY", 1)

    key = sse._cache_key("home_today_index", "FPT")
    entry = sse._CacheEntry()
    entry.subscribers.add(asyncio.Queue())  # đã đạt trần (1)
    sse._cache[key] = entry

    with pytest.raises(HTTPException) as ei:
        await sse._subscribe("home_today_index", "FPT")

    assert ei.value.status_code == 503
    assert entry.task is None  # không tạo poller mới
    assert len(entry.subscribers) == 1  # không thêm subscriber


# ---------------------------------------------------------------------------
# 5. Hết subscriber → poller bị cancel + entry được dọn
# ---------------------------------------------------------------------------
async def test_unsubscribe_cancels_poller_and_cleans_cache(monkeypatch):
    monkeypatch.setattr(sse, "execute_sse_query", _stub_query)

    key, q = await sse._subscribe("home_today_index", "FPT")
    entry = sse._cache[key]
    task = entry.task
    assert task is not None

    await sse._unsubscribe(key, q)

    # Entry được dọn ngay (giải phóng slot poller).
    assert key not in sse._cache
    # Poller đã bị cancel.
    with pytest.raises(asyncio.CancelledError):
        await task


# ---------------------------------------------------------------------------
# 6. REST endpoint KHÔNG lộ chi tiết exception ra client
# ---------------------------------------------------------------------------
async def test_rest_query_does_not_leak_exception(monkeypatch):
    secret = "mongodb://user:SECRETpass@10.0.0.1:27017"

    async def _boom(keyword, **kwargs):
        raise RuntimeError(secret)

    monkeypatch.setattr(sse, "execute_sse_query", _boom)

    with pytest.raises(HTTPException) as ei:
        await sse.rest_query_endpoint(keyword="home_today_index", projection=None)

    assert ei.value.status_code == 500
    detail = str(ei.value.detail)
    assert "SECRETpass" not in detail
    assert "mongodb://" not in detail
    assert "10.0.0.1" not in detail


# ---------------------------------------------------------------------------
# 7. Happy path: endpoint hợp lệ trả StreamingResponse + tạo đúng 1 poller
# ---------------------------------------------------------------------------
async def test_stream_endpoint_happy_path_creates_poller(monkeypatch):
    monkeypatch.setattr(sse, "execute_sse_query", _stub_query)

    resp = await sse.sse_stream_endpoint(
        _DummyRequest(), keyword="home_today_index", ticker="FPT"
    )

    assert isinstance(resp, StreamingResponse)
    key = sse._cache_key("home_today_index", "FPT")
    assert key in sse._cache
    entry = sse._cache[key]

    # Dọn poller vừa start (generator chưa chạy nên chưa unsubscribe).
    if entry.task is not None:
        entry.task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await entry.task
