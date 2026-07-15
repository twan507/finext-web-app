from pathlib import Path

import pytest

from app.agent.tools.kb import READ_KB_SCHEMA, list_kb_docs, read_kb_doc


def test_schema_shape():
    fn = READ_KB_SCHEMA["function"]
    assert fn["name"] == "read_kb"
    assert "doc" in fn["parameters"]["properties"]
    assert fn["parameters"]["required"] == ["doc"]


def test_list_kb_docs_includes_methodology_files():
    docs = list_kb_docs()
    assert "agent_db_04" in docs
    assert "agent_db_06" in docs


def test_read_existing_doc_returns_content():
    content, ok = read_kb_doc("agent_db_06")
    assert ok is True
    assert "Market Phase" in content or "phase" in content.lower()


def test_read_unknown_doc_returns_error_not_raise():
    content, ok = read_kb_doc("khong_ton_tai")
    assert ok is False
    assert "agent_db_04" in content  # liệt kê tài liệu khả dụng để model tự sửa


@pytest.mark.parametrize("evil", ["../config", "a/b", "a\\b", "..", "x.md", "agent_db_04;rm"])
def test_path_traversal_rejected(evil: str):
    content, ok = read_kb_doc(evil)
    assert ok is False


def test_dynamic_extension_new_file_readable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import app.agent.tools.kb as kb

    (tmp_path / "nganh_moi.md").write_text("Kiến thức ngành mới", encoding="utf-8")
    monkeypatch.setattr(kb, "KB_DIR", tmp_path)
    content, ok = kb.read_kb_doc("nganh_moi")
    assert ok is True and "ngành mới" in content  # thêm file .md là đọc được, không sửa code


def test_read_invalid_utf8_returns_error_not_raise(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import app.agent.tools.kb as kb

    # File .md tương lai có bytes UTF-8 lỗi -> đọc phải trả text (False), KHÔNG raise ra execute_tool.
    (tmp_path / "bad.md").write_bytes(b"\xff\xfe invalid")
    monkeypatch.setattr(kb, "KB_DIR", tmp_path)
    content, ok = kb.read_kb_doc("bad")
    assert ok is False
    assert isinstance(content, str)
