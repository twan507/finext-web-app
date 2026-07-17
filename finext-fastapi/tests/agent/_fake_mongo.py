"""Fake Mongo async tối giản cho test crud/chat — CHỈ hỗ trợ ops crud dùng.
Không thay Mongo thật; đủ test logic prune/quota/persistence không cần DB.
Hỗ trợ filter: eq + $gte/$gt/$lte/$lt/$in/$ne; update: $set/$inc/$setOnInsert (upsert)."""
from __future__ import annotations

from typing import Any

from bson import ObjectId


def _matches(doc: dict, flt: dict) -> bool:
    for key, cond in flt.items():
        val = doc.get(key)
        if isinstance(cond, dict) and any(str(op).startswith("$") for op in cond):
            for op, operand in cond.items():
                if op == "$gte" and not (val is not None and val >= operand):
                    return False
                if op == "$gt" and not (val is not None and val > operand):
                    return False
                if op == "$lte" and not (val is not None and val <= operand):
                    return False
                if op == "$lt" and not (val is not None and val < operand):
                    return False
                if op == "$in" and val not in operand:
                    return False
                if op == "$ne" and val == operand:
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

    def sort(self, field: str, direction: int = 1) -> "_Cursor":
        self._docs = sorted(self._docs, key=lambda d: d.get(field), reverse=direction < 0)
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


class FakeCollection:
    def __init__(self) -> None:
        self.docs: list[dict] = []

    async def insert_one(self, doc: dict) -> _Result:
        d = dict(doc)
        d.setdefault("_id", ObjectId())
        self.docs.append(d)
        return _Result(inserted_id=d["_id"])

    async def find_one(self, flt: dict, projection: Any = None) -> dict | None:
        for d in self.docs:
            if _matches(d, flt):
                return dict(d)
        return None

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
        for k, v in update.get("$set", {}).items():
            target[k] = v
        for k, v in update.get("$inc", {}).items():
            target[k] = target.get(k, 0) + v
        return _Result(matched_count=1, modified_count=1, upserted_id=None)

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
