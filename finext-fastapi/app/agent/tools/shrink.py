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
        # Nêu TÊN document đã bỏ (thường là mã cổ phiếu), không chỉ đếm số lượng: hỏi so sánh
        # nhiều mã mà rụng bớt mã thì model phải biết rụng mã NÀO để còn truy vấn lại.
        dropped_docs = data[keep_docs:]
        return data[:keep_docs], ShrinkReport(
            shrunk=True,
            docs_kept=keep_docs,
            docs_dropped=len(dropped_docs),
            dropped_labels=tuple(
                _label(doc, keep_docs + i)
                for i, doc in enumerate(dropped_docs[:MAX_DROPPED_LABELS])
            ),
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
        # Ở nhánh thu mảng lồng, dropped_labels là nhãn PHẦN TỬ (đã nêu ở trên) chứ không phải
        # nhãn document — nên chỉ liệt kê tên document khi đúng nhánh bỏ document.
        detail = ""
        if report.dropped_labels and not report.array_path:
            more = "…" if report.docs_dropped > len(report.dropped_labels) else ""
            detail = f" (đã bỏ: {', '.join(report.dropped_labels)}{more})"
        parts.append(
            f"Đã bỏ {report.docs_dropped} kết quả cuối danh sách{detail}, "
            f"giữ {report.docs_kept} kết quả đầu."
        )
    parts.append("Cần phần đã bỏ thì truy vấn lại với projection ít field hơn hoặc $slice nhỏ hơn.")
    return " ".join(parts)
