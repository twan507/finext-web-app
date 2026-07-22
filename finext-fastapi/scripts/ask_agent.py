"""Gửi câu hỏi vào agent THẬT và in câu trả lời — để audit xem gợi ý có trả lời nổi không.

    uv run python scripts/ask_agent.py "câu hỏi 1" "câu hỏi 2"
    uv run python scripts/ask_agent.py --from-db     # audit đúng kho gợi ý đang publish
    uv run python scripts/ask_agent.py --chain "câu 1" "còn nhóm đó thì sao?"  # đa lượt: các câu là LƯỢT LIÊN TIẾP của 1 hội thoại
"""
import asyncio
import sys
import time

from app.agent.context import build_system_blocks
from app.agent.gateway import GatewayContext, build_gateway
from app.agent.loop import build_adapter, run_agent
from app.core.database import close_mongo_connection, connect_to_mongo, get_database
from app.crud.chat_suggestions import get_latest_suggestions


async def ask(messages: list[dict]) -> tuple[str, list[str], dict]:
    # Mỗi lượt vẫn build gateway + system MỚI; chỉ messages là tích luỹ (user/assistant xen kẽ).
    gateway = build_gateway()
    ctx = GatewayContext(request_id=f"audit-{int(time.time() * 1000)}", user_id="audit-script")
    system, _ = await build_system_blocks(gateway, ctx)

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
    await connect_to_mongo()
    chain = "--chain" in sys.argv  # các positional args là lượt liên tiếp của 1 hội thoại
    args = [a for a in sys.argv[1:] if a not in ("--from-db", "--chain")]
    if "--from-db" in sys.argv:
        args = await get_latest_suggestions(get_database("user_db"))

    messages: list[dict] = []  # ở chế độ --chain: tích luỹ qua các lượt; mặc định: reset mỗi câu
    for i, q in enumerate(args, 1):
        if not chain:
            messages = []
        messages.append({"role": "user", "content": q})
        t0 = time.monotonic()
        answer, tools, usage = await ask(messages)
        print(f"\n{'=' * 78}\n[{i}] HỎI: {q}\n{'=' * 78}")
        print(f"(tool: {tools or 'KHÔNG GỌI TOOL NÀO'} | {time.monotonic() - t0:.1f}s | usage={usage})\n")
        print(answer or "[RỖNG]")
        if chain:
            # Nối câu trả lời vào messages để lượt sau có ngữ cảnh (tham chiếu "nó", "nhóm đó"...).
            messages.append({"role": "assistant", "content": answer})

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
