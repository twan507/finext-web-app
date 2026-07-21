# DeepSeek V4 migration (GẤP) — Implementation Plan

> **HISTORICAL — COMPLETED:** Đây là kế hoạch migration theo provider tại thời điểm 2026-07-15. Runtime hiện chọn model/provider bằng env; không dùng deadline hoặc model trong file này làm trạng thái hiện hành.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.
> **ƯU TIÊN TUYỆT ĐỐI:** `deepseek-chat` khai tử 24/07/2026 15:59 UTC — app CHẾT sau hạn nếu không migrate.

**Goal:** Đổi model sang `deepseek-v4-flash` (non-thinking) + temperature 0.2, app sống sau 24/07, và ĐO lại K-hygiene trên thế hệ mới để quyết có cần thinking (Phần 2 spec) không.

**Architecture:** Chỉ đổi env `LLM_MODEL` + thêm param `temperature` (non-thinking hỗ trợ) vào adapter payload. `base_url` giữ nguyên, OpenAI-compat như cũ. Không đụng loop/gateway/policy.

**Tech Stack:** Python 3.13 · httpx · pytest · uv (cwd `finext-fastapi`, chạy `PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest`).

**Nguồn:** [spec](../specs/2026-07-15-deepseek-v4-reasoning-roadmap-design.md) · [[reference_deepseek_v4_api]].

## Global Constraints
- KHÔNG thêm dependency. Type hints · không `except:` trần · không `print()` · hàm ≤40 dòng.
- Secrets chỉ ở `.env*` (owner tự điền key). KHÔNG `NEXT_PUBLIC_` cho key.
- Chỉ sửa file trong "Files" mỗi task. Baseline: 190 test PASS trên branch `feat/agent-v1-slice`.

---

### Task 1: Thêm temperature vào adapter + đổi model env

**Files:**
- Modify: `finext-fastapi/app/core/config.py` (thêm `LLM_TEMPERATURE`)
- Modify: `finext-fastapi/app/agent/adapters/openai_compat.py` (`__init__` + `_payload` nhận temperature)
- Modify: `finext-fastapi/app/agent/loop.py` (`build_adapter` truyền temperature)
- Modify: `finext-fastapi/.env.development` + `.env.production` (owner: `LLM_MODEL=deepseek-v4-flash`, `LLM_TEMPERATURE=0.2`)
- Test: `finext-fastapi/tests/agent/adapters/test_openai_compat.py` (thêm test payload có temperature)

**Interfaces:**
- Produces: `OpenAICompatAdapter(base_url, api_key, model, client=None, temperature=None)` — `_payload` thêm `"temperature"` khi `temperature is not None`.

- [ ] **Step 1: Thêm env config.** Trong `config.py`, cạnh block LLM:
```python
LLM_TEMPERATURE = os.getenv("LLM_TEMPERATURE")  # str|None; None = không gửi (dùng default provider)
```

- [ ] **Step 2: Viết failing test.** Thêm vào `tests/agent/adapters/test_openai_compat.py`:
```python
def test_payload_includes_temperature_when_set():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(base_url="https://api.test/v1", api_key="k", model="deepseek-v4-flash", temperature=0.2)
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert payload["temperature"] == 0.2
    assert payload["model"] == "deepseek-v4-flash"


def test_payload_omits_temperature_when_none():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(base_url="https://api.test/v1", api_key="k", model="m", temperature=None)
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert "temperature" not in payload
```

- [ ] **Step 3: Chạy test — FAIL.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/adapters/test_openai_compat.py::test_payload_includes_temperature_when_set -v` → FAIL (TypeError: unexpected kwarg temperature).

- [ ] **Step 4: Sửa `openai_compat.py`.** `__init__` thêm `temperature: float | None = None` (lưu `self._temperature`). Trong `_payload`, trước `return`:
```python
        if self._temperature is not None:
            payload["temperature"] = self._temperature
```

- [ ] **Step 5: Sửa `loop.py::build_adapter`.** Đọc `LLM_TEMPERATURE`, ép float nếu set:
```python
from app.core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TEMPERATURE
...
def build_adapter() -> ModelAdapter:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        raise RuntimeError("Thiếu cấu hình LLM_BASE_URL / LLM_API_KEY / LLM_MODEL")
    temp = float(LLM_TEMPERATURE) if LLM_TEMPERATURE else None
    return OpenAICompatAdapter(base_url=LLM_BASE_URL, api_key=LLM_API_KEY, model=LLM_MODEL, temperature=temp)
```
(Nếu `build_adapter` dùng `_get_client()` singleton — giữ nguyên, chỉ thêm `temperature=temp`.)

- [ ] **Step 6: Chạy test — PASS + full suite.** `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest -v` → tất cả PASS (190 + 2).

- [ ] **Step 7: Owner điền env** (KHÔNG commit key): `.env.development` + `.env.production`:
```
LLM_MODEL=deepseek-v4-flash
LLM_TEMPERATURE=0.2
```

- [ ] **Step 8: Commit** (chỉ code, KHÔNG .env):
```bash
git add finext-fastapi/app/core/config.py finext-fastapi/app/agent/adapters/openai_compat.py finext-fastapi/app/agent/loop.py finext-fastapi/tests/agent/adapters/test_openai_compat.py
git commit -m "feat(agent): adapter nhận temperature + chuẩn bị migrate deepseek-v4-flash"
```

---

### Task 2: Verify DeepSeek v4-flash thật + ĐO K-hygiene (thủ công, owner)

**Files:** Create nếu bắt được: `finext-fastapi/tests/agent/adapters/fixtures/deepseek_v4_tool_stream.txt`

Không unit test tự động (cần DeepSeek thật). Dùng script như `scratchpad/verify_pack.py` phiên trước.

- [ ] **Step 1: Verify tool-calling còn chạy với v4-flash.** Chạy lại 3 câu: "FPT giá bao nhiêu" · "thị trường pha nào, cầm bao nhiêu %" · "HPG đắt/rẻ so lịch sử". Xác nhận: agent gọi `db_find`/`read_kb` đúng (v4-flash stream tool-call có thể khác format → nếu parse hỏng, bắt bytes thật + sửa `_ToolCallBuffer`/`parse_sse_chunk`).

- [ ] **Step 2: ĐO K-hygiene (DỮ LIỆU QUYẾT ĐỊNH).** Trong 3 câu trên, kiểm output có còn lộ ký hiệu không:
  - Còn "VSI"/`breadth_blend`/"bottom 3"/"day_score" thô? → V4-flash non-thinking CHƯA đủ → cần Phần 2 (thinking).
  - Đã dịch hết sang ngôn ngữ tự nhiên ("thanh khoản gấp 2.5 lần", "rẻ nhất 2 năm")? → ĐỦ, không cần thinking.
  - **GHI kết quả vào `.superpowers/sdd/progress.md`** — đây là căn cứ quyết Phần 2.

- [ ] **Step 3: Cập nhật spec** theo kết quả đo: nếu đủ → đánh dấu Phần 2 "không cần"; nếu chưa → giữ Phần 2 + tạo plan thinking (đọc spec §2 + reference API — nhớ loop pass-back reasoning_content).

- [ ] **Step 4: Commit fixture nếu bắt được** (`deepseek_v4_tool_stream.txt`): `git add ... && git commit -m "test(agent): fixture bytes thật deepseek-v4-flash"`.

---

## Nghiệm thu
- [ ] `LLM_MODEL=deepseek-v4-flash` chạy được, tool-calling OK (verify thật).
- [ ] full suite PASS.
- [ ] K-hygiene đo xong, kết quả ghi ledger → quyết định Phần 2 rõ ràng.
- [ ] App không dùng `deepseek-chat` nữa (an toàn sau 24/07).

**Sau plan này:** nếu đo thấy cần thinking → brainstorm/plan Phần 2 (spec §2). CoT display + model selector (spec §3) → roadmap sau.
