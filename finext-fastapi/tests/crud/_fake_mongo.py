"""Fake Mongo async cho test crud chuỗi tiền (transactions/subscriptions/promotions).

Mở rộng pattern từ tests/agent/_fake_mongo.py để phủ đủ op mà crud tiền dùng:
- filter: eq + $gt/$gte/$lt/$lte/$in/$ne/$nin + $or (top-level)
- ops: insert_one, find_one(sort=/projection=), find, count_documents,
       update_one (đánh giá lại filter trên doc đích -> mô phỏng compare-and-set
       nguyên tử của Mongo), update_many, delete_one, delete_many
- KHÔNG có find_one_and_update (khớp giới hạn Mongo standalone của dự án).
Cho phép truy cập collection cả kiểu db["x"] lẫn db.x.
"""
from __future__ import annotations

from typing import Any, Optional

from bson import ObjectId


def _match_op(val: Any, op: str, operand: Any) -> bool:
    if op == "$gte":
        return val is not None and val >= operand
    if op == "$gt":
        return val is not None and val > operand
    if op == "$lte":
        return val is not None and val <= operand
    if op == "$lt":
        return val is not None and val < operand
    if op == "$in":
        return val in operand
    if op == "$nin":
        return val not in operand
    if op == "$ne":
        return val != operand
    return False


def _matches(doc: dict, flt: dict) -> bool:
    for key, cond in flt.items():
        if key == "$or":
            if not any(_matches(doc, sub) for sub in cond):
                return False
            continue
        val = doc.get(key)
        if isinstance(cond, dict) and any(str(op).startswith("$") for op in cond):
            for op, operand in cond.items():
                if not _match_op(val, op, operand):
                    return False
        elif val != cond:
            return False
    return True


class _Result:
    def __init__(self, **kw: Any) -> None:
        self.__dict__.update(kw)


class _Cursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    def sort(self, key_or_list: Any, direction: int = 1) -> "_Cursor":
        keys = key_or_list if isinstance(key_or_list, list) else [(key_or_list, direction)]
        for field, d in reversed(keys):
            self._docs = sorted(self._docs, key=lambda x: (x.get(field) is not None, x.get(field)), reverse=d < 0)
        return self

    def skip(self, n: int) -> "_Cursor":
        self._docs = self._docs[n:]
        return self

    def limit(self, n: int) -> "_Cursor":
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        docs = self._docs if length is None else self._docs[:length]
        return [dict(d) for d in docs]

    def __aiter__(self) -> "_Cursor":
        self._iter = iter(list(self._docs))
        return self

    async def __anext__(self) -> dict:
        try:
            return dict(next(self._iter))
        except StopIteration:
            raise StopAsyncIteration


def _apply_update(target: dict, update: dict) -> None:
    for k, v in update.get("$set", {}).items():
        target[k] = v
    for k, v in update.get("$inc", {}).items():
        target[k] = target.get(k, 0) + v


class FakeCollection:
    def __init__(self) -> None:
        self.docs: list[dict] = []

    async def insert_one(self, doc: dict) -> _Result:
        d = dict(doc)
        d.setdefault("_id", ObjectId())
        self.docs.append(d)
        return _Result(inserted_id=d["_id"])

    async def find_one(self, flt: dict, projection: Any = None, sort: Any = None) -> Optional[dict]:
        docs = [d for d in self.docs if _matches(d, flt)]
        if sort:
            for field, direction in reversed(sort):
                docs = sorted(docs, key=lambda x: (x.get(field) is not None, x.get(field)), reverse=direction < 0)
        return dict(docs[0]) if docs else None

    def find(self, flt: dict | None = None) -> _Cursor:
        flt = flt or {}
        return _Cursor([dict(d) for d in self.docs if _matches(d, flt)])

    async def count_documents(self, flt: dict) -> int:
        return sum(1 for d in self.docs if _matches(d, flt))

    async def update_one(self, flt: dict, update: dict, upsert: bool = False) -> _Result:
        target = next((d for d in self.docs if _matches(d, flt)), None)
        if target is None:
            if not upsert:
                return _Result(matched_count=0, modified_count=0, upserted_id=None)
            target = {k: v for k, v in flt.items() if not isinstance(v, dict)}
            target.setdefault("_id", ObjectId())
            self.docs.append(target)
            for k, v in update.get("$setOnInsert", {}).items():
                target[k] = v
            _apply_update(target, update)
            return _Result(matched_count=0, modified_count=0, upserted_id=target["_id"])
        _apply_update(target, update)
        return _Result(matched_count=1, modified_count=1, upserted_id=None)

    async def update_many(self, flt: dict, update: dict) -> _Result:
        targets = [d for d in self.docs if _matches(d, flt)]
        for t in targets:
            _apply_update(t, update)
        return _Result(matched_count=len(targets), modified_count=len(targets))

    async def delete_one(self, flt: dict) -> _Result:
        for i, d in enumerate(self.docs):
            if _matches(d, flt):
                del self.docs[i]
                return _Result(deleted_count=1)
        return _Result(deleted_count=0)

    async def delete_many(self, flt: dict) -> _Result:
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, flt)]
        return _Result(deleted_count=before - len(self.docs))


class FakeDB:
    def __init__(self) -> None:
        self._colls: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        return self._colls.setdefault(name, FakeCollection())

    def get_collection(self, name: str) -> FakeCollection:
        return self._colls.setdefault(name, FakeCollection())

    def __getattr__(self, name: str) -> FakeCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self.__dict__.setdefault("_colls", {}).setdefault(name, FakeCollection())
