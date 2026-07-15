import logging

from app.agent import context as context_module
from app.agent.context import RESIDENT_DOCS, _read_resident


def test_resident_docs_order():
    assert RESIDENT_DOCS == ["system_prompt", "agent_db_01", "agent_db_02"]


def test_read_resident_concatenates_three_docs():
    text = _read_resident()
    assert "Finext" in text  # từ system_prompt
    assert "Collections Schema" in text or "stock_snapshot" in text  # từ agent_db_01
    assert "Query Patterns" in text or "Workflow" in text  # từ agent_db_02
    # KHÔNG nạp 03-06 vào resident (đọc qua read_kb)
    assert "News Methodology" not in text


def test_partial_resident_logs_warning_and_returns_loaded(tmp_path, monkeypatch, caplog):
    # Chỉ có 2/3 file resident (thiếu agent_db_02.md — mô phỏng sync pack lỗi).
    (tmp_path / "system_prompt.md").write_text("SP Finext", encoding="utf-8")
    (tmp_path / "agent_db_01.md").write_text("DB01 schema", encoding="utf-8")
    monkeypatch.setattr(context_module, "KB_DIR", tmp_path)

    with caplog.at_level(logging.WARNING, logger="app.agent.context"):
        text = _read_resident()

    # Vẫn trả nội dung 2 file đã nạp (không raise, không fallback stub).
    assert "SP Finext" in text
    assert "DB01 schema" in text
    # Nhưng phải WARNING nêu rõ file thiếu để monitoring alert được.
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("agent_db_02" in msg for msg in warnings)
