"""Gửi câu hỏi vào agent THẬT và in câu trả lời — để audit xem gợi ý có trả lời nổi không.

    uv run python scripts/ask_agent.py "câu hỏi 1" "câu hỏi 2"
    uv run python scripts/ask_agent.py --from-db     # audit đúng kho gợi ý đang publish
    uv run python scripts/ask_agent.py --chain "câu 1" "còn nhóm đó thì sao?"  # đa lượt: các câu là LƯỢT LIÊN TIẾP của 1 hội thoại

Tư vấn danh mục (mode=portfolio) — ghép system Y HỆT production (persona + ngữ cảnh trang):
    uv run python scripts/ask_agent.py --mode portfolio \
        --page-context 'Danh mục đang tư vấn: "DM của tôi". Mã đang theo dõi: HPG, FPT, VCB. Giai đoạn thị trường hiện tại: SIDEWAY (hệ gợi ý nắm ~50%). Chỉ tư vấn các mã trong danh mục này, theo khung điều kiện.' \
        --chain "danh mục này ổn chưa?" "HPG mình đang lãi 10% có nên giữ không?"
"""
import argparse
import asyncio
import time

from app.agent.context import build_system_blocks
from app.agent.gateway import GatewayContext, build_gateway
from app.agent.loop import build_adapter, run_agent
from app.core.database import close_mongo_connection, connect_to_mongo, get_database
from app.crud.chat_suggestions import get_latest_suggestions
from app.routers.chat import _page_context_block, portfolio_system_block


async def ask(messages: list[dict], mode: str | None, page_context: str | None) -> tuple[str, list[str], dict]:
    # Mỗi lượt vẫn build gateway + system MỚI; chỉ messages là tích luỹ (user/assistant xen kẽ).
    # Ghép system Y HỆT production (chat.py::_produce): thường trú → persona portfolio → page_context.
    gateway = build_gateway()
    ctx = GatewayContext(request_id=f"audit-{int(time.time() * 1000)}", user_id="audit-script")
    system, _ = await build_system_blocks(gateway, ctx)
    pf_block = portfolio_system_block(mode)
    if pf_block is not None:
        system.append(pf_block)  # persona tư vấn danh mục — TRƯỚC page_context
    page_block = _page_context_block(page_context)
    if page_block is not None:
        system.append(page_block)  # nối CUỐI như production (giữ cache-prefix)

    parts: list[str] = []
    tools: list[str] = []
    usage: dict = {}

    async def emit(event_type: str, payload: dict) -> None:
        if event_type == "token":
            parts.append(payload.get("text", ""))
        elif event_type == "tool_end":
            tools.append(f"{payload.get('name')}{'' if payload.get('ok') else '(FAIL)'}")
        elif event_type == "done":
            usage.update(payload.get("usage") or {})
        elif event_type == "error":
            parts.append(f"[ERROR] {payload.get('message')}")

    await run_agent(
        adapter=build_adapter(thinking="disabled"),
        gateway=gateway,
        ctx=ctx,
        system=system,
        messages=messages,
        emit=emit,
    )
    return "".join(parts), tools, usage


async def main() -> None:
    parser = argparse.ArgumentParser(description="Audit agent THẬT (chat thường hoặc tư vấn danh mục).")
    parser.add_argument("questions", nargs="*", help="Câu hỏi — mỗi câu 1 lượt (xem --chain).")
    parser.add_argument("--chain", action="store_true", help="Các câu là lượt LIÊN TIẾP của 1 hội thoại.")
    parser.add_argument("--from-db", action="store_true", help="Lấy đúng kho gợi ý đang publish thay cho positional.")
    parser.add_argument("--mode", default=None, help="'portfolio' để bật persona tư vấn danh mục.")
    parser.add_argument("--page-context", dest="page_context", default=None, help="Ngữ cảnh trang giả lập (WL + giai đoạn).")
    ns = parser.parse_args()

    await connect_to_mongo()
    args = await get_latest_suggestions(get_database("user_db")) if ns.from_db else ns.questions

    messages: list[dict] = []  # --chain: tích luỹ qua các lượt; mặc định: reset mỗi câu
    for i, q in enumerate(args, 1):
        if not ns.chain:
            messages = []
        messages.append({"role": "user", "content": q})
        t0 = time.monotonic()
        answer, tools, usage = await ask(messages, ns.mode, ns.page_context)
        print(f"\n{'=' * 78}\n[{i}] HỎI: {q}\n{'=' * 78}")
        print(f"(tool: {tools or 'KHÔNG GỌI TOOL NÀO'} | {time.monotonic() - t0:.1f}s | usage={usage})\n")
        print(answer or "[RỖNG]")
        if ns.chain:
            # Nối câu trả lời vào messages để lượt sau có ngữ cảnh (tham chiếu "nó", "nhóm đó"...).
            messages.append({"role": "assistant", "content": answer})

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
