import json

from bson import ObjectId

import app.crud.chat as crud
import app.routers.chat as chat_router
from app.schemas.chat import ConversationPinRequest, ConversationRenameRequest
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())
OTHER = str(ObjectId())


class _User:
    def __init__(self, uid):
        self.id = uid


def _body(resp):
    return json.loads(bytes(resp.body))


async def test_list_conversations_returns_only_mine():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "của tôi")
    await crud.start_turn(db, OTHER, None, "của người khác")
    resp = await chat_router.list_my_conversations(current_user=_User(USER), db=db)
    payload = _body(resp)
    assert payload["status"] == 200
    assert len(payload["data"]) == 1
    assert payload["data"][0]["title"] == "của tôi"


async def test_get_conversation_detail_ok_and_ownership_404():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    await crud.add_message(db, conv_id, USER, "assistant", "trả lời")
    ok = await chat_router.get_my_conversation(conversation_id=conv_id, current_user=_User(USER), db=db)
    data = _body(ok)["data"]
    assert len(data["messages"]) == 2 and data["messages"][0]["role"] == "user"
    # user khác → 404
    denied = await chat_router.get_my_conversation(conversation_id=conv_id, current_user=_User(OTHER), db=db)
    assert _body(denied)["status"] == 404


async def test_pin_conversation_ok_and_ownership_404():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "x")
    ok = await chat_router.pin_my_conversation(
        conversation_id=conv_id, body=ConversationPinRequest(pinned=True), current_user=_User(USER), db=db
    )
    assert _body(ok)["status"] == 200
    conv = await db[crud.CONVERSATIONS].find_one({"_id": ObjectId(conv_id)})
    assert conv["pinned"] is True
    denied = await chat_router.pin_my_conversation(
        conversation_id=conv_id, body=ConversationPinRequest(pinned=True), current_user=_User(OTHER), db=db
    )
    assert _body(denied)["status"] == 404


async def test_rename_conversation_ok_and_ownership_404():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "x")
    ok = await chat_router.rename_my_conversation(
        conversation_id=conv_id, body=ConversationRenameRequest(title="Tên mới"), current_user=_User(USER), db=db
    )
    assert _body(ok)["status"] == 200
    conv = await db[crud.CONVERSATIONS].find_one({"_id": ObjectId(conv_id)})
    assert conv["title"] == "Tên mới"
    denied = await chat_router.rename_my_conversation(
        conversation_id=conv_id, body=ConversationRenameRequest(title="Cướp"), current_user=_User(OTHER), db=db
    )
    assert _body(denied)["status"] == 404


async def test_delete_conversation_ok_and_ownership_404():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "x")
    denied = await chat_router.delete_my_conversation(conversation_id=conv_id, current_user=_User(OTHER), db=db)
    assert _body(denied)["status"] == 404
    ok = await chat_router.delete_my_conversation(conversation_id=conv_id, current_user=_User(USER), db=db)
    assert _body(ok)["status"] == 200
    assert db[crud.CONVERSATIONS].docs == []
