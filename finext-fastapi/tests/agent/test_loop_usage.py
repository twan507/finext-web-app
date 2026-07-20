"""Hồi quy: usage phải được cộng dồn qua MỌI vòng LLM, kể cả vòng gọi tool.

Bug thật đã đo được: adapter lấy usage cho mọi vòng, nhưng khi vòng đó kết thúc bằng
ToolCallsEvent thì nó yield event rồi return — usage của vòng đó bị vứt. Chỉ vòng cuối
(DoneEvent) được tính. Hậu quả: quota và cầu dao ngân sách đếm hụt ~2,5 lần so với token
thật bị tính tiền, nên cầu dao chống cháy ví sẽ không nhảy khi cần.

Bộ test cũ không bắt được vì mọi ToolCallsEvent trong test đều tạo không kèm usage.
"""

from typing import Any

import pytest

from app.agent.adapters.base import SystemBlock
from app.agent.events import DoneEvent, TokenEvent, ToolCall, ToolCallsEvent
from app.agent.loop import _drive_turn, _merge_usage


class _ScriptedRound:
    """Adapter giả phát đúng một vòng sự kiện đã dựng sẵn."""

    def __init__(self, events: list[Any]) -> None:
        self._events = events

    async def stream_chat(self, system, messages, tools, max_tokens):  # noqa: ANN001, ANN201
        for event in self._events:
            yield event


_CALL = ToolCall(id="c1", name="db_find", arguments={"collection": "market_phase", "filter": {}})


async def _run(events: list[Any], usage_total: dict[str, int]) -> str:
    _, _, _, _, status = await _drive_turn(
        adapter=_ScriptedRound(events),
        system=[SystemBlock(text="sys")],
        working=[{"role": "user", "content": "hỏi"}],
        tools=[],
        usage_total=usage_total,
    )
    return status


@pytest.mark.asyncio
async def test_vong_goi_tool_phai_duoc_tinh_token():
    """Đây chính là vòng bị bỏ sót trước đây."""
    total: dict[str, int] = {}
    status = await _run([ToolCallsEvent(calls=[_CALL], usage={"in": 12000, "out": 80})], total)
    assert status == "tools"
    assert total == {"in": 12000, "out": 80}, "vòng gọi tool phải được cộng vào tổng token"


@pytest.mark.asyncio
async def test_cong_don_qua_nhieu_vong():
    """Một lượt chat nhiều vòng: tổng phải bằng tổng các vòng, không phải chỉ vòng cuối."""
    total: dict[str, int] = {}
    await _run([ToolCallsEvent(calls=[_CALL], usage={"in": 10000, "out": 50})], total)
    await _run([ToolCallsEvent(calls=[_CALL], usage={"in": 14000, "out": 60})], total)
    await _run([TokenEvent(text="xong"), DoneEvent(usage={"in": 16000, "out": 400})], total)
    assert total == {"in": 40000, "out": 510}
    # Nếu chỉ đếm vòng cuối thì sẽ ra 16000 — hụt 2,5 lần, đúng tỉ lệ đã đo ngoài thực tế.
    assert total["in"] > 16000 * 2


@pytest.mark.asyncio
async def test_vong_goi_tool_khong_co_usage_thi_khong_vo():
    """Provider không trả usage cho vòng đó → bỏ qua, không được ném lỗi."""
    total: dict[str, int] = {}
    status = await _run([ToolCallsEvent(calls=[_CALL])], total)
    assert status == "tools"
    assert total == {}


def test_merge_usage_bo_qua_gia_tri_khong_phai_so():
    total: dict[str, int] = {"in": 5}
    _merge_usage(total, {"in": 3, "out": 2, "model": "m3"})  # type: ignore[dict-item]
    assert total == {"in": 8, "out": 2}
