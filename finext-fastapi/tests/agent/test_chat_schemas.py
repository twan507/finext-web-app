from datetime import datetime, timezone

from bson import ObjectId

from app.schemas.chat import ConversationDetail, ConversationSummary, MessagePublic


def _now():
    return datetime.now(timezone.utc)


def test_conversation_summary_from_mongo_doc():
    doc = {"_id": ObjectId(), "user_id": ObjectId(), "title": "FPT", "created_at": _now(),
           "updated_at": _now(), "msg_count": 3}
    s = ConversationSummary.model_validate(doc)
    assert s.title == "FPT" and s.msg_count == 3
    assert isinstance(s.id, str)  # PyObjectId serialize thành str


def test_message_public_defaults_and_tool_calls():
    doc = {"_id": ObjectId(), "role": "assistant", "content": "xin chào",
           "tool_calls": [{"name": "db_find", "args_summary": "stock_snapshot FPT", "ok": True, "ms": 12}],
           "usage": {"in": 100, "out": 20}, "created_at": _now()}
    m = MessagePublic.model_validate(doc)
    assert m.role == "assistant" and m.tool_calls[0].name == "db_find"
    assert m.usage == {"in": 100, "out": 20} and m.interrupted is False


def test_message_public_minimal_user_msg():
    doc = {"_id": ObjectId(), "role": "user", "content": "hi", "created_at": _now()}
    m = MessagePublic.model_validate(doc)
    assert m.tool_calls == [] and m.usage is None


def test_conversation_detail_nests_messages():
    conv = {"_id": ObjectId(), "user_id": ObjectId(), "title": "T", "created_at": _now(),
            "updated_at": _now(), "msg_count": 1,
            "messages": [{"_id": ObjectId(), "role": "user", "content": "hi", "created_at": _now()}]}
    d = ConversationDetail.model_validate(conv)
    assert len(d.messages) == 1 and d.messages[0].content == "hi"
