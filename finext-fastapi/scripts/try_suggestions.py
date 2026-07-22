"""Công cụ tinh chỉnh prompt gợi ý câu hỏi chat — CHẠY KHÔ, KHÔNG ghi DB.

In ra prompt đầy đủ + output thô + kết quả validate, để lặp prompt nhanh mà không
tốn thêm gì ngoài một lượt gọi LLM.

    cd finext-fastapi
    uv run python scripts/try_suggestions.py           # chạy khô
    uv run python scripts/try_suggestions.py --write   # chạy THẬT, ghi user_db.chat_suggestions

Trên Windows nhớ PYTHONIOENCODING=utf-8 nếu terminal báo lỗi encode tiếng Việt.
"""
import asyncio
import sys

from app.agent.adapters.base import SystemBlock
from app.agent.loop import _complete, build_adapter
from app.agent.suggestions import (
    ROUNDS,
    _SYS,
    _load_sources,
    _user_prompt,
    build_snapshot,
    generate_and_store,
    validate_suggestions,
)
from app.core.config import LLM_MODEL
from app.core.database import close_mongo_connection, connect_to_mongo, get_database
from app.crud.chat_suggestions import SUGGESTIONS_COLLECTION, sample_suggestions


async def dry_run(db) -> None:
    phase_rows, comment_rows, stock_rows = await _load_sources(db)
    snap = build_snapshot(phase_rows, comment_rows, stock_rows)

    print("=" * 78, "\nSYSTEM PROMPT\n", "=" * 78, sep="")
    print(_SYS)
    print("\n" + "=" * 78, "\nUSER PROMPT (vòng 1)\n", "=" * 78, sep="")
    print(_user_prompt(snap))

    adapter = build_adapter(thinking="disabled")
    collected: list[str] = []
    for r in range(ROUNDS):
        usage: dict[str, int] = {}
        raw = await _complete(
            adapter,
            [SystemBlock(text=_SYS, cache_hint=False)],
            [{"role": "user", "content": _user_prompt(snap, already=collected)}],
            usage,
        )
        batch = validate_suggestions(raw, set(snap["tickers"]))
        print(f"\n{'=' * 78}\nVÒNG {r + 1} — {LLM_MODEL} — usage={usage}\n{'=' * 78}")
        print(f"RAW:\n{raw}\n")
        if batch is None:
            print(">>> TRƯỢT VALIDATE (xem raw phía trên để biết vì sao)")
            continue
        seen = {q.lower() for q in collected}
        collected += [q for q in batch if q.lower() not in seen]

    print(f"\n{'=' * 78}\nKHO CUỐI CÙNG ({len(collected)} câu)\n{'=' * 78}")
    for i, q in enumerate(collected, 1):
        print(f"  {i:2d}. {q}   [{len(q)} ký tự]")


async def real_run(db) -> None:
    before = await db[SUGGESTIONS_COLLECTION].count_documents({})
    ok = await generate_and_store(db)
    after = await db[SUGGESTIONS_COLLECTION].count_documents({})
    print(f"generate_and_store → {ok}   ({before} → {after} document)")
    print("\nMột lượt bốc ngẫu nhiên (đúng thứ frontend nhận):")
    for i, q in enumerate(await sample_suggestions(db), 1):
        print(f"  {i}. {q}")


async def main() -> None:
    await connect_to_mongo()
    db = get_database("user_db")
    if "--write" in sys.argv:
        await real_run(db)
    else:
        await dry_run(db)
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
