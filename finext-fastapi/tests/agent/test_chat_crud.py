from bson import ObjectId

import app.crud.chat as crud
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())
OTHER = str(ObjectId())


async def test_start_turn_creates_conversation_with_title_and_user_msg():
    db = FakeDB()
    msg = "Phân tích cổ phiếu FPT giúp tôi rất chi tiết dài dòng quá 60 ký tự luôn nhé bạn"
    conv_id = await crud.start_turn(db, USER, None, msg)
    convs = db[crud.CONVERSATIONS].docs
    assert len(convs) == 1
    assert convs[0]["title"] == msg[:60]  # 60 ký tự đầu
    assert len(convs[0]["title"]) == 60
    msgs = db[crud.MESSAGES].docs
    assert len(msgs) == 1 and msgs[0]["role"] == "user"
    assert convs[0]["msg_count"] == 1  # add_message bump
    assert convs[0]["_id"] == ObjectId(conv_id)


async def test_start_turn_reuses_owned_conversation():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "câu 1")
    conv_id2 = await crud.start_turn(db, USER, conv_id, "câu 2")
    assert conv_id2 == conv_id
    assert len(db[crud.CONVERSATIONS].docs) == 1
    assert db[crud.CONVERSATIONS].docs[0]["msg_count"] == 2


async def test_start_turn_ignores_foreign_conversation_creates_new():
    db = FakeDB()
    mine = await crud.start_turn(db, USER, None, "của tôi")
    hijack = await crud.start_turn(db, OTHER, mine, "cướp hội thoại người khác")
    assert hijack != mine  # không dùng được conversation của user khác → tạo mới
    assert len(db[crud.CONVERSATIONS].docs) == 2


async def test_add_message_persists_tool_calls_and_usage():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "hỏi")
    await crud.add_message(db, conv_id, USER, "assistant", "trả lời",
                           tool_calls=[{"name": "db_find", "args_summary": "x", "ok": True, "ms": 5}],
                           usage={"in": 100, "out": 20})
    asst = [m for m in db[crud.MESSAGES].docs if m["role"] == "assistant"][0]
    assert asst["usage"] == {"in": 100, "out": 20}
    assert asst["tool_calls"][0]["name"] == "db_find"
    assert db[crud.CONVERSATIONS].docs[0]["msg_count"] == 2


async def test_prune_keeps_max_and_cascades(monkeypatch):
    monkeypatch.setattr(crud, "CHAT_MAX_CONVERSATIONS", 3)
    db = FakeDB()
    ids = []
    for i in range(5):
        ids.append(await crud.start_turn(db, USER, None, f"hội thoại {i}"))
    convs = db[crud.CONVERSATIONS].docs
    assert len(convs) == 3  # chỉ giữ 3 mới nhất
    kept_ids = {str(c["_id"]) for c in convs}
    assert ids[0] not in kept_ids and ids[1] not in kept_ids  # 2 cũ nhất bị xoá
    # cascade: message của hội thoại bị xoá cũng biến mất
    remaining_conv_ids = {c["_id"] for c in convs}
    for m in db[crud.MESSAGES].docs:
        assert m["conversation_id"] in remaining_conv_ids


async def test_get_conversation_detail_returns_messages_ordered_and_checks_owner():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    await crud.add_message(db, conv_id, USER, "assistant", "câu trả lời")
    detail = await crud.get_conversation_detail(db, conv_id, USER)
    assert detail is not None and len(detail["messages"]) == 2
    assert detail["messages"][0]["role"] == "user"
    assert await crud.get_conversation_detail(db, conv_id, OTHER) is None  # không phải chủ


async def test_delete_conversation_cascades_and_checks_owner():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "x")
    await crud.add_message(db, conv_id, USER, "assistant", "y")
    assert await crud.delete_conversation(db, conv_id, OTHER) is False  # không phải chủ
    assert await crud.delete_conversation(db, conv_id, USER) is True
    assert db[crud.CONVERSATIONS].docs == []
    assert db[crud.MESSAGES].docs == []  # cascade


async def test_list_conversations_sorted_desc_and_scoped_to_user():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "a")
    await crud.start_turn(db, OTHER, None, "b")
    c = await crud.start_turn(db, USER, None, "c")
    lst = await crud.list_conversations(db, USER)
    assert len(lst) == 2  # chỉ của USER
    assert str(lst[0]["_id"]) == c  # mới nhất trước


async def test_set_pinned_and_list_orders_pinned_first():
    db = FakeDB()
    a = await crud.start_turn(db, USER, None, "a")
    b = await crud.start_turn(db, USER, None, "b")  # b mới hơn
    assert [str(c["_id"]) for c in await crud.list_conversations(db, USER)] == [b, a]  # chưa ghim: mới nhất trước
    assert await crud.set_pinned(db, a, USER, True) is True
    lst = await crud.list_conversations(db, USER)
    assert str(lst[0]["_id"]) == a and lst[0]["pinned"] is True  # ghim lên đầu
    assert str(lst[1]["_id"]) == b


async def test_set_pinned_checks_owner():
    db = FakeDB()
    a = await crud.start_turn(db, USER, None, "a")
    assert await crud.set_pinned(db, a, OTHER, True) is False  # không phải chủ


async def test_rename_conversation_ok_owner_and_empty():
    db = FakeDB()
    a = await crud.start_turn(db, USER, None, "tên cũ")
    assert await crud.rename_conversation(db, a, USER, "  Tên mới xịn  ") is True
    conv = await db[crud.CONVERSATIONS].find_one({"_id": ObjectId(a)})
    assert conv["title"] == "Tên mới xịn"  # đã trim
    assert await crud.rename_conversation(db, a, OTHER, "cướp") is False  # không phải chủ
    assert await crud.rename_conversation(db, a, USER, "   ") is False  # rỗng sau trim


async def test_prune_skips_pinned(monkeypatch):
    monkeypatch.setattr(crud, "CHAT_MAX_CONVERSATIONS", 2)
    db = FakeDB()
    first = await crud.start_turn(db, USER, None, "giữ bằng ghim")
    await crud.set_pinned(db, first, USER, True)
    for i in range(3):  # thêm 3 non-pinned (cap non-pinned = 2)
        await crud.start_turn(db, USER, None, f"c{i}")
    convs = db[crud.CONVERSATIONS].docs
    assert first in {str(c["_id"]) for c in convs}  # hội thoại ghim luôn còn (miễn nhiễm prune)
    assert len([c for c in convs if not c.get("pinned")]) == 2  # non-pinned chỉ giữ 2 mới nhất
