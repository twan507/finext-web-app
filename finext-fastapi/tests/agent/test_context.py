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
