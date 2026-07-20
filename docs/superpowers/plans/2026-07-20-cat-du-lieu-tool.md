# Cắt dữ liệu tool trung thực — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kết quả tool không bao giờ bị cắt mất phần mới nhất một cách âm thầm — cắt phải bỏ trọn phần tử, giữ kỳ mới, và nói rõ cho model biết đã bỏ cái gì.

**Architecture:** Thêm một module thuần tuý `shrink.py` làm nơi DUY NHẤT được phép bỏ dữ liệu, thu gọn theo cấu trúc (bỏ document cuối danh sách, rồi bỏ phần tử đầu của mảng lồng lớn nhất). `registry.py` gọi nó thay cho phép cắt chuỗi mù, và nối một ghi chú có địa chỉ qua đường `note` sẵn có. `loop.py` chia ngân sách đều cho các lời gọi song song trước khi chạy, thay vì cắt chuỗi sau khi chạy.

**Tech Stack:** Python 3.12 · FastAPI · pytest · Motor/MongoDB. Frontend: TypeScript/Next.js, verify bằng `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-07-20-cat-du-lieu-tool-design.md`

## Global Constraints

- **KHÔNG commit gì cả.** Owner đã chỉ đạo rõ: làm tới xong rồi owner tự kiểm tra trước khi commit. Mọi bước "Commit" trong quy trình chuẩn được thay bằng bước chạy lại test.
- **KHÔNG sửa bất kỳ file `.env*` nào.**
- **KHÔNG chạy `npm run build`** — hỏng dev server của owner. Verify frontend chỉ bằng `cd finext-nextjs && npx tsc --noEmit`.
- **KHÔNG dựng browser / Playwright** — owner tự test giao diện.
- Khi chạy pytest qua pipe, kiểm `${PIPESTATUS[0]}` chứ không phải mã thoát của lệnh cuối.
- Toàn bộ comment và chuỗi hướng tới người đọc viết **tiếng Việt**, theo đúng giọng file xung quanh.
- **K-hygiene:** không để lộ tên collection, tên field, số trần token ra câu trả lời cho khách. Ghi chú nội bộ cho model thì được — nó chỉ nằm trong message `role="tool"`, không bao giờ tới FE.
- Hằng số chốt: `MAX_TOOL_RESULT_CHARS = 24_000`, `MAX_TOTAL_TOOL_CHARS = 40_000`, `MAX_DROPPED_LABELS = 12`, `MAX_WALK_DEPTH = 4`, `_NOTE_RESERVE = 800`.
- **Viết test xong phải KIỂM TRA NGƯỢC:** gỡ phần sửa ra, xác nhận test chuyển đỏ, rồi khôi phục. Test xanh mà không ghim gì là test vô dụng — bài học đắt của phiên trước.
- Không thêm dependency mới.

## File Structure

| File | Trách nhiệm |
|---|---|
| `finext-fastapi/app/agent/tools/shrink.py` **(mới)** | Nơi DUY NHẤT bỏ dữ liệu. Thuần tuý: vào `list[dict]` + trần ký tự, ra `list[dict]` đã thu gọn + báo cáo. Không biết gì về gateway, Mongo, hay LLM. |
| `finext-fastapi/app/agent/tools/registry.py` | Gọi `shrink_result` thay cho cắt chuỗi mù; nối ghi chú; chuyển tiếp `truncated`/`bytes` vào `meta`. Nhận thêm tham số `max_chars`. |
| `finext-fastapi/app/agent/loop.py` | Chia ngân sách đều cho các lời gọi TRƯỚC khi chạy; bỏ cắt chuỗi mù; giữ một trần phòng thủ cắt theo dòng cho đường không đi qua shrink. |
| `finext-nextjs/services/chatPageContext.ts` | Bỏ nhãn `[NGỮ CẢNH TRANG…]` (backend đã tự chèn). |
| `finext-fastapi/tests/agent/tools/test_shrink.py` **(mới)** | Unit test module thu gọn + test hồi quy ghim đúng ca HPG. |

---

### Task 1: Module thu gọn `shrink.py`

**Files:**
- Create: `finext-fastapi/app/agent/tools/shrink.py`
- Test: `finext-fastapi/tests/agent/tools/test_shrink.py`

**Interfaces:**
- Consumes: không gì (module thuần tuý, chỉ dùng `json` và `dataclasses` của stdlib).
- Produces:
  - `ShrinkReport` — dataclass frozen, các field: `shrunk: bool`, `docs_kept: int`, `docs_dropped: int`, `array_path: str | None`, `items_kept: int`, `items_dropped: int`, `kept_first: str | None`, `kept_last: str | None`, `dropped_labels: tuple[str, ...]`.
  - `shrink_result(data: list[dict[str, Any]], max_chars: int) -> tuple[list[dict[str, Any]], ShrinkReport]`
  - `shrink_note(report: ShrinkReport) -> str | None`
  - Hằng `MAX_DROPPED_LABELS = 12`, `MAX_WALK_DEPTH = 4`.

- [ ] **Step 1: Viết test thất bại**

Tạo `finext-fastapi/tests/agent/tools/test_shrink.py`. Nếu `finext-fastapi/tests/agent/tools/__init__.py` chưa có thì tạo file rỗng.

```python
"""Thu gọn kết quả tool theo CẤU TRÚC, không cắt giữa chừng chuỗi.

BUG THẬT đã đo: registry.py cắt content[:12000] giữ phần ĐẦU. Kết quả HPG 28.026 ký tự
gồm 9 kỳ 2024_1…2026_1 bị cắt còn 4 kỳ 2024_1…2024_4 — mất sạch 5 kỳ MỚI NHẤT, đúng phần
khách hỏi, và JSON hỏng giữa chừng. Model không có dữ liệu 2025/2026 nên đã bịa số.
"""

import json

from app.agent.tools.shrink import ShrinkReport, shrink_note, shrink_result


def _quarter(period: str) -> dict:
    """Một kỳ báo cáo, hình dạng như financial_statements.quarterly thật (34 chỉ tiêu)."""
    return {
        "period": period,
        "metrics": [{"vi_name": f"Chỉ tiêu {i}", "value": 1_000_000 + i} for i in range(34)],
    }


def _hpg_doc(periods: list[str]) -> dict:
    return {"ticker": "HPG", "financial_statements": {"quarterly": [_quarter(p) for p in periods]}}


NINE_PERIODS = [
    "2024_1", "2024_2", "2024_3", "2024_4",
    "2025_1", "2025_2", "2025_3", "2025_4", "2026_1",
]


def test_vua_tran_thi_tra_nguyen():
    data = [{"ticker": "FPT", "price": 100}]
    out, report = shrink_result(data, 10_000)
    assert out == data
    assert report.shrunk is False
    assert report.docs_kept == 1


def test_data_rong_khong_coi_la_cat():
    out, report = shrink_result([], 10_000)
    assert out == []
    assert report.shrunk is False


def test_bo_document_tu_CUOI_danh_sach():
    """Danh sách doc đã theo thứ tự sort của truy vấn — doc đầu liên quan nhất, nên bỏ từ cuối."""
    data = [{"ticker": f"MA{i}", "pad": "x" * 500} for i in range(10)]
    out, report = shrink_result(data, 1_500)
    assert 1 <= len(out) < 10
    assert out == data[: len(out)], "phải giữ các doc ĐẦU"
    assert report.shrunk is True
    assert report.docs_kept == len(out)
    assert report.docs_dropped == 10 - len(out)


def test_HOI_QUY_giu_ky_MOI_bo_ky_CU():
    """ĐÂY LÀ TEST GHIM NGUYÊN NHÂN GỐC. Hành vi cũ giữ kỳ CŨ và vứt kỳ MỚI."""
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    out, report = shrink_result(data, full // 2)

    kept = [q["period"] for q in out[0]["financial_statements"]["quarterly"]]
    assert "2026_1" in kept, "kỳ MỚI NHẤT phải còn — đây chính là thứ hành vi cũ vứt đi"
    assert "2024_1" not in kept, "kỳ CŨ NHẤT phải bị bỏ trước"
    assert kept == NINE_PERIODS[-len(kept):], "phải là một đoạn đuôi liên tục"
    assert report.array_path == "financial_statements.quarterly"
    assert report.kept_last == "2026_1"
    assert report.items_kept == len(kept)
    assert report.items_dropped == 9 - len(kept)


def test_ket_qua_sau_khi_thu_luon_la_JSON_hop_le():
    """Hành vi cũ cắt giữa chuỗi nên JSON hỏng. Đây là ràng buộc không được vi phạm."""
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    for divisor in (2, 3, 5, 8):
        out, _ = shrink_result(data, full // divisor)
        json.loads(json.dumps(out, ensure_ascii=False))  # không được raise


def test_ton_trong_tran_ky_tu():
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    limit = full // 3
    out, _ = shrink_result(data, limit)
    assert len(json.dumps(out, ensure_ascii=False)) <= limit


def test_nhan_lay_tu_khoa_period_hoac_date():
    data = [{"series": [{"date": f"2026-01-{d:02d}", "v": "x" * 200} for d in range(1, 21)]}]
    out, report = shrink_result(data, 1_200)
    assert report.array_path == "series"
    assert report.kept_last == "2026-01-20"


def test_nhan_dung_chi_so_khi_khong_co_khoa_nhan():
    data = [{"rows": [{"v": "x" * 200} for _ in range(20)]}]
    _, report = shrink_result(data, 1_200)
    assert report.kept_last.startswith("#")


def test_mot_phan_tu_don_qua_lon_thi_bao_that_bai():
    data = [{"blob": "x" * 5_000}]
    out, report = shrink_result(data, 1_000)
    assert out == []
    assert report.shrunk is True


def test_ghi_chu_neu_dung_khoang_con_lai_va_cam_dien_so():
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    _, report = shrink_result(data, full // 2)
    note = shrink_note(report)
    assert note is not None
    assert "TUYỆT ĐỐI không tự điền số" in note
    assert "2026_1" in note
    assert "2024_1" in note, "phải liệt kê kỳ đã bỏ để model biết đường truy vấn lại"


def test_ghi_chu_rong_khi_khong_cat():
    assert shrink_note(ShrinkReport()) is None


def test_ghi_chu_dat_chi_dan_quan_trong_len_TRUOC():
    """Ghi chú có thể bị trần ngân sách cắt đuôi — chỉ dẫn cấm bịa số phải nằm ở đầu."""
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    _, report = shrink_result(data, full // 2)
    note = shrink_note(report)
    assert note.index("TUYỆT ĐỐI") < note.index("2026_1")
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

```bash
cd finext-fastapi && python -m pytest tests/agent/tools/test_shrink.py -q
```
Kỳ vọng: FAIL — `ModuleNotFoundError: No module named 'app.agent.tools.shrink'`.

- [ ] **Step 3: Viết `shrink.py`**

Tạo `finext-fastapi/app/agent/tools/shrink.py`:

```python
"""Thu gọn kết quả tool theo CẤU TRÚC — nơi DUY NHẤT được phép bỏ dữ liệu.

Cắt bớt dữ liệu là bình thường; cắt mà GIẤU mới là lỗi. Trước đây registry.py cắt
content[:12000] giữ phần ĐẦU: kết quả 9 kỳ báo cáo bị cắt còn 4 kỳ CŨ NHẤT, JSON hỏng
giữa chừng, model chỉ nhận được "…[đã cắt]" nên đã bịa số cho các kỳ nó không nhìn thấy.

Module này thuần tuý: không biết gateway, Mongo hay LLM. Vào list[dict] + trần ký tự,
ra list[dict] đã thu gọn + báo cáo đủ chi tiết để bên gọi nói lại cho model.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

MAX_DROPPED_LABELS = 12  # ghi chú chỉ liệt kê tối đa ngần này nhãn để không phình
MAX_WALK_DEPTH = 4  # độ sâu tối đa khi dò mảng lồng

# Mảng trong agent_db xếp CŨ → MỚI (đó là lý do policy dùng $slice: -N khắp nơi),
# nên giữ phần tử CUỐI nghĩa là giữ kỳ mới nhất.
_LABEL_KEYS = ("period", "year_quarter", "quarter", "date", "time", "year", "name", "ticker")


@dataclass(frozen=True)
class ShrinkReport:
    """Cái gì đã mất. Bên gọi dựng ghi chú cho model từ đây."""

    shrunk: bool = False
    docs_kept: int = 0
    docs_dropped: int = 0
    array_path: str | None = None
    items_kept: int = 0
    items_dropped: int = 0
    kept_first: str | None = None
    kept_last: str | None = None
    dropped_labels: tuple[str, ...] = ()


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _size(value: Any) -> int:
    return len(_dumps(value))


def _label(item: Any, index: int) -> str:
    """Nhãn người đọc được của một phần tử, để ghi chú nói rõ đã bỏ cái gì."""
    if isinstance(item, dict):
        for key in _LABEL_KEYS:
            value = item.get(key)
            if isinstance(value, (str, int, float)) and not isinstance(value, bool):
                return str(value)
    return f"#{index}"


def _find_largest_array(doc: Any, path: str = "", depth: int = 0) -> tuple[str, list[Any]] | None:
    """Mảng lồng lớn nhất (theo kích thước đóng gói) trong một document."""
    if depth >= MAX_WALK_DEPTH or not isinstance(doc, dict):
        return None
    best: tuple[int, str, list[Any]] | None = None
    for key, value in doc.items():
        sub_path = f"{path}.{key}" if path else key
        candidate: tuple[str, list[Any]] | None = None
        if isinstance(value, list) and len(value) > 1:
            candidate = (sub_path, value)
        elif isinstance(value, dict):
            candidate = _find_largest_array(value, sub_path, depth + 1)
        if candidate is None:
            continue
        size = _size(candidate[1])
        if best is None or size > best[0]:
            best = (size, candidate[0], candidate[1])
    return None if best is None else (best[1], best[2])


def _replace_at(doc: dict[str, Any], path: str, value: Any) -> dict[str, Any]:
    """Bản sao nông của doc với `path` được thay — KHÔNG sửa dữ liệu gốc."""
    keys = path.split(".")
    out = dict(doc)
    cursor = out
    for key in keys[:-1]:
        child = dict(cursor[key])
        cursor[key] = child
        cursor = child
    cursor[keys[-1]] = value
    return out


def _largest_prefix(data: list[dict[str, Any]], max_chars: int) -> int:
    """Số document ĐẦU nhiều nhất mà vẫn vừa trần. Tìm nhị phân: O(log n) lần đóng gói."""
    lo, hi, best = 1, len(data), 0
    while lo <= hi:
        mid = (lo + hi) // 2
        if _size(data[:mid]) <= max_chars:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1
    return best


def shrink_result(
    data: list[dict[str, Any]], max_chars: int
) -> tuple[list[dict[str, Any]], ShrinkReport]:
    """Thu gọn cho vừa `max_chars`, bỏ trọn phần tử. Trả ([], shrunk=True) nếu bất khả."""
    if _size(data) <= max_chars:
        return data, ShrinkReport(docs_kept=len(data))
    if not data:
        return [], ShrinkReport(shrunk=True)

    total_docs = len(data)

    # Bỏ document từ CUỐI: danh sách đã theo thứ tự sort của truy vấn nên doc đầu liên quan nhất.
    keep_docs = _largest_prefix(data, max_chars)
    if keep_docs >= 1:
        return data[:keep_docs], ShrinkReport(
            shrunk=True, docs_kept=keep_docs, docs_dropped=total_docs - keep_docs
        )

    # Ngay cả document ĐẦU cũng quá trần → thu mảng lồng lớn nhất bên trong nó,
    # giữ phần tử CUỐI (= kỳ mới nhất).
    doc = data[0]
    found = _find_largest_array(doc)
    if found is None:
        return [], ShrinkReport(shrunk=True)
    path, items = found

    lo, hi, keep_items = 0, len(items), 0
    while lo <= hi:
        mid = (lo + hi) // 2
        trial = [_replace_at(doc, path, items[len(items) - mid :] if mid else [])]
        if _size(trial) <= max_chars:
            keep_items, lo = mid, mid + 1
        else:
            hi = mid - 1
    if keep_items == 0:
        return [], ShrinkReport(shrunk=True)

    cut = len(items) - keep_items
    kept, dropped = items[cut:], items[:cut]
    return [_replace_at(doc, path, kept)], ShrinkReport(
        shrunk=True,
        docs_kept=1,
        docs_dropped=total_docs - 1,
        array_path=path,
        items_kept=len(kept),
        items_dropped=len(dropped),
        kept_first=_label(kept[0], cut),
        kept_last=_label(kept[-1], len(items) - 1),
        dropped_labels=tuple(_label(it, i) for i, it in enumerate(dropped[:MAX_DROPPED_LABELS])),
    )


def shrink_note(report: ShrinkReport) -> str | None:
    """Ghi chú cho MODEL. Chỉ dẫn quan trọng đặt TRƯỚC vì đuôi có thể bị trần ngân sách cắt."""
    if not report.shrunk:
        return None
    parts = [
        "Kết quả quá lớn nên đã lược bớt. Chỉ kết luận trên phần còn lại. Nếu khách hỏi về "
        "phần đã bỏ, hãy nói là chưa lấy được — TUYỆT ĐỐI không tự điền số."
    ]
    if report.array_path:
        total = report.items_kept + report.items_dropped
        parts.append(
            f"Đã giữ {report.items_kept}/{total} phần tử MỚI NHẤT của {report.array_path}, "
            f"từ {report.kept_first} đến {report.kept_last}."
        )
        if report.dropped_labels:
            more = "…" if report.items_dropped > len(report.dropped_labels) else ""
            parts.append(f"Đã bỏ các phần tử cũ hơn: {', '.join(report.dropped_labels)}{more}.")
    if report.docs_dropped:
        parts.append(
            f"Đã bỏ {report.docs_dropped} kết quả cuối danh sách, giữ {report.docs_kept} kết quả đầu."
        )
    parts.append("Cần phần đã bỏ thì truy vấn lại với projection ít field hơn hoặc $slice nhỏ hơn.")
    return " ".join(parts)
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

```bash
cd finext-fastapi && python -m pytest tests/agent/tools/test_shrink.py -q
```
Kỳ vọng: 12 passed.

- [ ] **Step 5: Kiểm tra ngược**

Đổi tạm dòng `kept, dropped = items[cut:], items[:cut]` thành `kept, dropped = items[:keep_items], items[keep_items:]` (tức giữ kỳ CŨ như hành vi hỏng cũ). Chạy lại:

```bash
cd finext-fastapi && python -m pytest tests/agent/tools/test_shrink.py -q
```
Kỳ vọng: `test_HOI_QUY_giu_ky_MOI_bo_ky_CU` **FAIL**. Nếu nó vẫn xanh thì test không ghim gì — phải sửa test.

Khôi phục lại dòng đúng, chạy lại xác nhận xanh.

- [ ] **Step 6: Chạy toàn bộ suite để chắc không vỡ gì**

```bash
cd finext-fastapi && python -m pytest -q 2>&1 | tail -5; echo "EXIT=${PIPESTATUS[0]}"
```
Kỳ vọng: `EXIT=0`, tổng số test tăng thêm 12 so với 449.

---

### Task 2: `registry.py` dùng shrink, chuyển tiếp tín hiệu cắt

**Files:**
- Modify: `finext-fastapi/app/agent/tools/registry.py`
- Test: `finext-fastapi/tests/agent/test_tools.py`

**Interfaces:**
- Consumes: `shrink_result`, `shrink_note`, `ShrinkReport` từ Task 1.
- Produces:
  - `execute_tool(gateway, ctx, call, *, max_chars: int = MAX_TOOL_RESULT_CHARS) -> tuple[str, dict[str, Any]]` — tham số mới là **từ khoá, có mặc định**, nên mọi lời gọi cũ chạy nguyên.
  - `MAX_TOOL_RESULT_CHARS = 24_000` (nâng từ 12.000).
  - `meta` trả về nay có thêm khoá `truncated: bool`, `bytes: int`, `shrunk: bool`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `finext-fastapi/tests/agent/test_tools.py`. Đọc đầu file trước để dùng lại đúng fixture/gateway giả sẵn có; nếu file đã có helper dựng `GatewayResult` giả thì dùng lại, đừng dựng cái mới.

```python
class _FakeGateway:
    """Gateway giả trả đúng data đã đặt trước — chỉ để soi hành vi của execute_tool."""

    def __init__(self, result):
        self._result = result

    async def find(self, *args, **kwargs):
        return self._result

    async def aggregate(self, *args, **kwargs):
        return self._result

    async def stats(self, *args, **kwargs):
        return self._result


def _big_doc(n_periods: int) -> dict:
    return {
        "ticker": "HPG",
        "financial_statements": {
            "quarterly": [
                {
                    "period": f"20{24 + i // 4}_{i % 4 + 1}",
                    "metrics": [{"vi_name": f"CT {k}", "value": 1_000_000 + k} for k in range(34)],
                }
                for i in range(n_periods)
            ]
        },
    }


@pytest.mark.asyncio
async def test_ket_qua_qua_lon_van_la_JSON_hop_le_va_giu_ky_moi():
    """Hành vi cũ: content[:12000] → JSON hỏng + mất kỳ mới. Nay phải ngược lại."""
    from app.agent.gateway.types import GatewayResult
    from app.agent.tools.registry import execute_tool

    result = GatewayResult(ok=True, data=[_big_doc(9)], meta={"ms": 5, "bytes": 30_000})
    content, meta = await execute_tool(
        _FakeGateway(result), _ctx(), _call("db_find", {"collection": "stock_finstats"}),
        max_chars=6_000,
    )

    body = content.split("\n\n[GHI CHÚ NỘI BỘ")[0]
    data = json.loads(body)  # không được raise — hành vi cũ raise ở đây
    kept = [q["period"] for q in data[0]["financial_statements"]["quarterly"]]
    assert "2026_1" in kept
    assert "2024_1" not in kept
    assert meta["shrunk"] is True


@pytest.mark.asyncio
async def test_ghi_chu_cat_di_kem_va_cam_bia_so():
    from app.agent.gateway.types import GatewayResult
    from app.agent.tools.registry import execute_tool

    result = GatewayResult(ok=True, data=[_big_doc(9)], meta={"ms": 5})
    content, _ = await execute_tool(
        _FakeGateway(result), _ctx(), _call("db_find", {"collection": "stock_finstats"}),
        max_chars=6_000,
    )
    assert "[GHI CHÚ NỘI BỘ" in content
    assert "TUYỆT ĐỐI không tự điền số" in content


@pytest.mark.asyncio
async def test_chuyen_tiep_co_truncated_cua_gateway():
    """Gateway biết mình đã bỏ document nhưng registry đang VỨT cờ này — không ai đo được."""
    from app.agent.gateway.types import GatewayResult
    from app.agent.tools.registry import execute_tool

    result = GatewayResult(
        ok=True, data=[{"ticker": "FPT"}], meta={"ms": 3, "bytes": 120, "truncated": True}
    )
    _, meta = await execute_tool(
        _FakeGateway(result), _ctx(), _call("db_find", {"collection": "stock_snapshot"})
    )
    assert meta["truncated"] is True
    assert meta["bytes"] == 120


@pytest.mark.asyncio
async def test_giu_note_san_co_cua_gateway():
    from app.agent.gateway.types import GatewayResult
    from app.agent.tools.registry import execute_tool

    result = GatewayResult(
        ok=True, data=[{"ticker": "FPT"}], meta={"ms": 3, "note": "Field abc không tồn tại."}
    )
    content, _ = await execute_tool(
        _FakeGateway(result), _ctx(), _call("db_find", {"collection": "stock_snapshot"})
    )
    assert "Field abc không tồn tại." in content


@pytest.mark.asyncio
async def test_qua_lon_khong_thu_noi_thi_bao_loi_day_model():
    from app.agent.gateway.types import GatewayResult
    from app.agent.tools.registry import execute_tool

    result = GatewayResult(ok=True, data=[{"blob": "x" * 5_000}], meta={"ms": 3})
    content, meta = await execute_tool(
        _FakeGateway(result), _ctx(), _call("db_find", {"collection": "stock_snapshot"}),
        max_chars=1_000,
    )
    assert meta["ok"] is False
    assert "$slice" in content or "projection" in content
```

Hai helper `_ctx()` và `_call(...)` phải dựng đúng theo `GatewayContext` và `ToolCall` của dự án — đọc `app/agent/gateway/types.py` và `app/agent/events.py` để lấy đúng chữ ký. Nếu file test đã có helper tương đương thì dùng lại thay vì viết mới.

- [ ] **Step 2: Chạy test, xác nhận đỏ**

```bash
cd finext-fastapi && python -m pytest tests/agent/test_tools.py -q
```
Kỳ vọng: các test mới FAIL (`json.JSONDecodeError` ở test đầu, `KeyError: 'truncated'` ở test thứ ba).

- [ ] **Step 3: Sửa `registry.py`**

Thêm import:

```python
from .shrink import shrink_note, shrink_result
```

Đổi hằng và thêm thông điệp lỗi (đặt cạnh `MAX_TOOL_RESULT_CHARS` hiện có):

```python
# Nâng từ 12.000: trần cũ cắt mất 5/9 kỳ báo cáo của một truy vấn thường gặp. Thêm 12.000
# ký tự ≈ 3.000 token ≈ 0,0009 USD, so với 0,039 USD một lượt — rẻ hơn nhiều so với việc
# model không có dữ liệu rồi bịa số.
MAX_TOOL_RESULT_CHARS = 24_000
# Chừa chỗ cho [GHI CHÚ NỘI BỘ] nối SAU phần JSON, để trần ngân sách ở loop.py không cắt mất nó.
_NOTE_RESERVE = 800
_OVERSIZE_MSG = (
    "Kết quả quá lớn nên không trả được. Hãy giảm số phần tử $slice (ví dụ -20) "
    "hoặc projection ít field hơn (chỉ các field thật sự cần)."
)
```

Đổi chữ ký hàm:

```python
async def execute_tool(
    gateway: GatewayProtocol,
    ctx: GatewayContext,
    call: ToolCall,
    *,
    max_chars: int = MAX_TOOL_RESULT_CHARS,
) -> tuple[str, dict[str, Any]]:
```

Thay khối cuối hàm (từ `meta = {"ok": ...}` tới hết) bằng:

```python
    meta = {
        "ok": result.ok,
        "ms": result.meta.get("ms", 0),
        # Gateway đã biết mình bỏ bớt document; trước đây cờ này bị vứt nên không ai đo được.
        "truncated": bool(result.meta.get("truncated")),
        "bytes": result.meta.get("bytes", 0),
        "shrunk": False,
    }
    if not result.ok:
        return result.error or "Query bị từ chối.", meta

    data, report = shrink_result(result.data, max(1, max_chars - _NOTE_RESERVE))
    meta["shrunk"] = report.shrunk
    if report.shrunk and not data:
        # Không trả rỗng CÂM: rỗng câm khiến model tưởng không có dữ liệu và lặp query vô ích.
        meta["ok"] = False
        return _OVERSIZE_MSG, meta

    content = json.dumps(data, ensure_ascii=False, default=str)
    # Note nội bộ cho MODEL. Chỉ đi vào tool-result trung gian; câu trả lời khách vẫn qua
    # sanitize nên không lộ tên field/collection.
    notes = [n for n in (shrink_note(report), result.meta.get("note")) if n]
    if notes:
        content = f"{content}\n\n[GHI CHÚ NỘI BỘ — không đọc cho khách] " + " ".join(notes)
    return content, meta
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

```bash
cd finext-fastapi && python -m pytest tests/agent/test_tools.py -q
```
Kỳ vọng: tất cả passed.

- [ ] **Step 5: Kiểm tra ngược**

Đổi tạm dòng `data, report = shrink_result(...)` về hành vi cũ:
```python
data, report = result.data, ShrinkReport()
content_old = json.dumps(data, ensure_ascii=False, default=str)[:max_chars]
```
Chạy lại — `test_ket_qua_qua_lon_van_la_JSON_hop_le_va_giu_ky_moi` phải FAIL. Khôi phục.

- [ ] **Step 6: Chạy toàn bộ suite**

```bash
cd finext-fastapi && python -m pytest -q 2>&1 | tail -5; echo "EXIT=${PIPESTATUS[0]}"
```
Kỳ vọng: `EXIT=0`. Nếu có test cũ vỡ vì `meta` nay có thêm khoá, sửa test đó cho đúng chứ đừng gỡ khoá mới.

---

### Task 3: `loop.py` chia ngân sách trước, bỏ cắt mù

**Files:**
- Modify: `finext-fastapi/app/agent/loop.py`
- Test: `finext-fastapi/tests/agent/test_loop.py`

**Interfaces:**
- Consumes: `execute_tool(..., max_chars=...)` và `MAX_TOOL_RESULT_CHARS` từ Task 2.
- Produces: `MAX_TOTAL_TOOL_CHARS = 40_000`; hàm nội bộ `_cap_text(content: str, max_chars: int) -> str`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `finext-fastapi/tests/agent/test_loop.py`:

```python
def test_cap_text_cat_tai_ranh_gioi_dong():
    """read_kb trả markdown, không đi qua shrink. Cắt giữa chữ là mất nghĩa."""
    from app.agent.loop import _cap_text

    content = "\n".join(f"dòng số {i} có nội dung dài dài" for i in range(200))
    out = _cap_text(content, 500)
    assert len(out) <= 500 + 120, "phần ghi chú nối thêm phải ngắn"
    body = out.split("…[đã cắt")[0]
    assert body.endswith("dài") or body.endswith("\n"), "phải kết thúc ở ranh giới dòng"
    assert "đã cắt" in out


def test_cap_text_khong_dong_vao_noi_dung_vua_tran():
    from app.agent.loop import _cap_text

    content = "ngắn thôi"
    assert _cap_text(content, 500) == content


def test_ngan_sach_chia_deu_cho_cac_loi_goi_song_song():
    """Trước đây ngân sách tiêu theo thứ tự: tool cuối hàng có thể nhận về RỖNG."""
    from app.agent.loop import MAX_TOOL_RESULT_CHARS, MAX_TOTAL_TOOL_CHARS, _per_call_budget

    assert _per_call_budget(1) == MAX_TOOL_RESULT_CHARS
    assert _per_call_budget(4) == MAX_TOTAL_TOOL_CHARS // 4
    assert _per_call_budget(0) >= 1, "không được chia cho 0"
    assert _per_call_budget(100) >= 1, "nhiều lời gọi vẫn phải còn chỗ, không được ra 0"
    # Tổng không bao giờ vượt ngân sách chung.
    for n in (1, 2, 3, 5, 10):
        assert _per_call_budget(n) * n <= max(MAX_TOTAL_TOOL_CHARS, MAX_TOOL_RESULT_CHARS)
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

```bash
cd finext-fastapi && python -m pytest tests/agent/test_loop.py -q
```
Kỳ vọng: FAIL — `ImportError: cannot import name '_cap_text'`.

- [ ] **Step 3: Sửa `loop.py`**

Sửa import sẵn có của registry để lấy thêm hằng (đọc dòng import hiện tại rồi bổ sung, đừng thêm dòng import trùng):

```python
from .tools.registry import MAX_TOOL_RESULT_CHARS, TOOL_SCHEMAS, execute_tool
```

Đổi hằng:

```python
# Nâng từ 30.000 cùng với trần mỗi kết quả. Ngân sách này được CHIA ĐỀU cho các lời gọi
# song song TRƯỚC khi chạy, thay vì tiêu theo thứ tự (kiểu cũ làm tool cuối hàng nhận rỗng).
MAX_TOTAL_TOOL_CHARS = 40_000
_TEXT_CUT_NOTE = "\n\n…[đã cắt bớt phần cuối do quá dài — hãy đọc mục cần thiết bằng lời gọi hẹp hơn]"
```

Thêm hai hàm (đặt ngay trước `_run_tools`):

```python
def _per_call_budget(n_calls: int) -> int:
    """Phần ngân sách cho MỖI lời gọi, chia đều trước khi chạy."""
    return max(1, min(MAX_TOOL_RESULT_CHARS, MAX_TOTAL_TOOL_CHARS // max(1, n_calls)))


def _cap_text(content: str, max_chars: int) -> str:
    """Trần phòng thủ cho các đường KHÔNG đi qua shrink_result (read_kb trả markdown).

    Cắt tại ranh giới DÒNG chứ không giữa chữ, và nói rõ là đã cắt.
    """
    if len(content) <= max_chars:
        return content
    head = content[:max_chars]
    newline = head.rfind("\n")
    if newline > max_chars // 2:
        head = head[:newline]
    return head + _TEXT_CUT_NOTE
```

Trong `_run_tools`, trước `results = await asyncio.gather(...)` thêm:

```python
    per_call = _per_call_budget(len(calls))
```

và sửa `_run_one` để truyền xuống:

```python
        return await execute_tool(gateway, ctx, call, max_chars=per_call)
```

Thay khối cắt mù (ba dòng `if len(content) > budget: ... budget = max(0, ...)`) bằng:

```python
        # shrink_result đã lo phần JSON có cấu trúc; _cap_text chỉ chặn các đường văn bản
        # (read_kb, watchlist) và cắt theo ranh giới dòng.
        content = _cap_text(content, per_call)
```

Xoá dòng khởi tạo `budget = MAX_TOTAL_TOOL_CHARS` vì không còn dùng.

- [ ] **Step 4: Chạy test, xác nhận xanh**

```bash
cd finext-fastapi && python -m pytest tests/agent/test_loop.py tests/agent/test_loop_usage.py tests/agent/test_sse_contract.py -q
```
Kỳ vọng: tất cả passed.

- [ ] **Step 5: Kiểm tra ngược**

Đổi tạm `_cap_text` thành `return content[:max_chars]`. Chạy lại — `test_cap_text_cat_tai_ranh_gioi_dong` phải FAIL vì thiếu chuỗi "đã cắt". Khôi phục.

- [ ] **Step 6: Chạy toàn bộ suite**

```bash
cd finext-fastapi && python -m pytest -q 2>&1 | tail -5; echo "EXIT=${PIPESTATUS[0]}"
```
Kỳ vọng: `EXIT=0`.

---

### Task 4: Bỏ nhãn ngữ cảnh trang bị chèn trùng

**Files:**
- Modify: `finext-nextjs/services/chatPageContext.ts`
- Test: `finext-nextjs/services/chatPageContext.test.ts`

**Interfaces:**
- Consumes: không gì từ các task trước — độc lập hoàn toàn.
- Produces: `buildPageContext()` trả chuỗi **không còn** dòng nhãn `[NGỮ CẢNH TRANG…]` ở đầu.

- [ ] **Step 1: Xem hiện trạng hai nơi chèn nhãn**

```bash
cd "d:/twan_projects/finext-web-app" && grep -n "NGỮ CẢNH TRANG" finext-nextjs/services/chatPageContext.ts finext-nextjs/services/chatPageContext.test.ts finext-fastapi/app/routers/chat.py
```
Kỳ vọng: thấy hằng `HEADER` ở frontend và `_PAGE_CONTEXT_HEADER` ở backend — cùng một nhãn, chèn hai lần, phí ~90 token mỗi lượt.

- [ ] **Step 2: Sửa test trước**

Trong `finext-nextjs/services/chatPageContext.test.ts`, đổi mọi assert đang mong đợi nhãn ở đầu chuỗi thành assert **không có** nhãn. Thêm một test ghim rõ:

```ts
test('buildPageContext KHÔNG tự chèn nhãn — backend sở hữu phần bọc', () => {
  const ctx = buildPageContext('/stocks/HPG');
  assert.ok(ctx);
  assert.ok(!ctx.includes('NGỮ CẢNH TRANG'), 'nhãn do backend chèn, chèn ở đây là trùng hai lần');
});
```

- [ ] **Step 3: Chạy test, xác nhận đỏ**

```bash
cd finext-nextjs && node --test services/chatPageContext.test.ts
```
Kỳ vọng: test mới FAIL.

- [ ] **Step 4: Bỏ nhãn ở frontend**

Trong `finext-nextjs/services/chatPageContext.ts`: xoá hằng `HEADER` và bỏ nó khỏi chuỗi mà `buildPageContext()` dựng. Backend `_page_context_block()` trong `app/routers/chat.py` giữ nguyên — nó là nơi quyết định cách bọc khối ngữ cảnh vào system prompt nên nó nên sở hữu cái nhãn.

- [ ] **Step 5: Chạy test và typecheck**

```bash
cd finext-nextjs && node --test services/chatPageContext.test.ts && npx tsc --noEmit; echo "TSC=$?"
```
Kỳ vọng: test passed, `TSC=0`.

- [ ] **Step 6: Kiểm tra backend vẫn còn chèn nhãn**

```bash
cd finext-fastapi && python -m pytest tests/agent/test_chat_page_context.py -q
```
Kỳ vọng: passed — backend vẫn chèn đúng một nhãn.

---

### Task 5: Kiểm chứng trên dữ liệu THẬT + đo phân bố kích thước

**Files:**
- Create (ngoài repo, chỉ trong scratchpad): script kiểm chứng.
- Không sửa file nào trong repo.

**Interfaces:**
- Consumes: `shrink_result`, `shrink_note` (Task 1); `MAX_TOOL_RESULT_CHARS` (Task 2).
- Produces: số liệu để chốt hoặc điều chỉnh trần ở §4.5 của spec.

Lý do task này tồn tại: bài học phiên 2026-07-20 — ba trên bốn lỗi lọt qua hơn 400 test vì test dùng Mongo giả và adapter giả. Test dựng ở Task 1 dùng dữ liệu tự dựng; task này chạy trên dữ liệu thật.

- [ ] **Step 1: Chạy `shrink_result` trên file HPG thật**

File thật `hpg_toolresult.json` (28.026 ký tự, 9 kỳ 2024_1…2026_1) nằm ở thư mục scratchpad của phiên. Viết script scratchpad nạp file đó, chạy `shrink_result(data, 24_000 - 800)`, in ra:
- danh sách kỳ còn lại,
- `shrink_note(report)`,
- độ dài chuỗi kết quả.

Kỳ vọng: **2026_1 còn**, một vài kỳ cũ nhất bị bỏ, ghi chú nêu đúng khoảng còn lại. Nếu 2026_1 mất thì thiết kế sai — dừng lại báo cáo, đừng sửa test cho vừa.

- [ ] **Step 2: Đo phân bố kích thước kết quả thật**

Viết script scratchpad chạy qua `build_gateway()` thật (chỉ ĐỌC, không ghi), thực hiện một tập truy vấn tiêu biểu trên `agent_db`: `stock_finstats`, `history_finratios_*`, `stock_snapshot`, `other_data`, `news` — mỗi collection vài truy vấn dạng thường gặp (một mã, một ngành, top N theo sort). Với mỗi kết quả, ghi lại `len(json.dumps(result.data, ensure_ascii=False, default=str))`.

Báo cáo: bao nhiêu phần trăm vượt **12.000** (trần cũ) và bao nhiêu phần trăm vượt **24.000** (trần mới).

- [ ] **Step 3: Kết luận về trần**

Nếu tỷ lệ vượt 24.000 vẫn cao (trên ~30 %) thì **báo cáo số đo và đề xuất**, KHÔNG tự đổi hằng số — con số trần là quyết định của owner. Nếu tỷ lệ thấp thì ghi nhận là 24.000 đủ.

---

### Task 6: Chạy lại eval 14 câu

**Files:**
- Modify: `docs/finext_agent/eval-smoke-2026-07-20.md` (thêm mục mới ở cuối, **không sửa số cũ**)

**Interfaces:**
- Consumes: toàn bộ thay đổi của Task 1-3.
- Produces: bằng chứng nghiệm thu cho §6.5 của spec.

- [ ] **Step 1: Chạy lại bộ 14 câu**

Dùng lại đúng cách chạy đã ghi ở đầu file eval: script probe trong scratchpad đi đúng đường của endpoint `/chat/stream` — `connect_to_mongo()` → `build_gateway()` → `build_system_blocks()` → nối khối ngữ cảnh trang → `run_agent(...)`, `thinking = disabled`. Bộ 14 route và câu hỏi lấy nguyên từ bảng §1 của file eval.

Lần này **lưu nguyên văn kết quả tool của từng lượt** — lần đo trước cắt ở 6.000 ký tự nên không đối chiếu sâu được, và chính điều đó đã giấu nguyên nhân gốc suốt một phiên.

- [ ] **Step 2: Chấm câu 6 trước tiên**

Câu 6 (`/stocks/HPG?tab=financials` — "Lợi nhuận HPG tăng hay giảm so với cùng kỳ?") phải **ĐẠT**: nêu đúng kỳ mới nhất **2026_1**, doanh thu **53.313 tỷ**, lợi nhuận **+168,9 %** so với cùng kỳ. Đối chiếu trực tiếp với `agent_db`, đừng tin câu trả lời.

Nếu vẫn sai: báo cáo trung thực là sửa gốc chưa đủ, kèm nguyên văn kết quả tool mà model nhận được ở lượt đó. Đừng tự ý mở rộng sang làm guard.

- [ ] **Step 3: Đối chiếu 13 câu còn lại với bảng §2**

Với mỗi câu, so kết quả mới với cột "Kết quả" cũ. Đánh dấu rõ: giữ nguyên / tốt lên / **xấu đi**. Bất kỳ câu nào đang ĐẠT mà nay hỏng là lỗi hồi quy — báo cáo ngay, đừng bỏ qua.

- [ ] **Step 4: Ghi kết quả vào file eval**

Thêm mục `## 7. Chạy lại sau khi sửa chỗ cắt dữ liệu (2026-07-20)` vào cuối `docs/finext_agent/eval-smoke-2026-07-20.md`: bảng 14 câu mới đặt cạnh kết quả cũ, phần chấm câu 6 chi tiết, và danh sách câu xấu đi (nếu có). **Không sửa các số ở §2** — đó là ảnh chụp trước khi sửa, giá trị của nó nằm ở chỗ đối chiếu được.

- [ ] **Step 5: Chạy toàn bộ kiểm tra lần cuối**

```bash
cd finext-fastapi && python -m pytest -q 2>&1 | tail -5; echo "PYTEST=${PIPESTATUS[0]}"
cd ../finext-nextjs && node --test services/chatPageContext.test.ts && npx tsc --noEmit; echo "TSC=$?"
```
Kỳ vọng: `PYTEST=0`, node test passed, `TSC=0`.

- [ ] **Step 6: KHÔNG commit**

Để nguyên working tree bẩn. Owner sẽ tự kiểm tra rồi quyết định commit. Chạy `git status --short` và báo cáo danh sách file đã đổi.

---

## Self-Review

**Spec coverage:**

| Yêu cầu spec | Task |
|---|---|
| §4.1 `shrink.py` thuật toán 4 bước | Task 1 |
| §4.2 ghi chú cho model, đi qua đường `note` sẵn có | Task 1 (`shrink_note`) + Task 2 (nối vào content) |
| §4.3 `registry.py` + chuyển tiếp `truncated`/`bytes` | Task 2 |
| §4.4 `loop.py` chia ngân sách + cắt theo dòng cho read_kb | Task 3 |
| §4.5 trần mới 24.000 / 40.000 | Task 2 + Task 3 |
| §6.1 đo phân bố kích thước | Task 5 Step 2 |
| §6.2 unit test | Task 1 Step 1 |
| §6.3 test hồi quy + kiểm tra ngược | Task 1 Step 1 + Step 5 |
| §6.4 kiểm chứng dữ liệu thật | Task 5 Step 1 |
| §6.5 nghiệm thu eval 14 câu | Task 6 |
| §7 nhãn ngữ cảnh trùng | Task 4 |

Không có yêu cầu nào của spec thiếu task.

**Placeholder scan:** không có "TBD"/"TODO"/"xử lý lỗi phù hợp". Mọi bước sửa code đều kèm code thật.

**Type consistency:** `ShrinkReport` dùng cùng tên field ở Task 1 (định nghĩa), Task 1 (`shrink_note` đọc), Task 2 (`report.shrunk`). `shrink_result` luôn trả `tuple[list[dict], ShrinkReport]`. `execute_tool` nhận `max_chars` từ khoá ở Task 2, được truyền đúng tên ở Task 3. `_per_call_budget` và `_cap_text` khai ở Task 3, dùng đúng tên trong test cùng task.

**Một điểm cần lưu ý cho người thực thi:** `_NOTE_RESERVE = 800` ở Task 2 tồn tại để phần JSON cộng ghi chú vẫn nằm dưới trần mà `_cap_text` ở Task 3 áp. Nếu bỏ khoản dự trữ này thì `_cap_text` sẽ cắt mất phần đuôi ghi chú — tức cắt mất đúng thứ ta vừa dựng ra để chống bịa số. Đó cũng là lý do `shrink_note` đặt câu "TUYỆT ĐỐI không tự điền số" lên **đầu** thay vì cuối.
