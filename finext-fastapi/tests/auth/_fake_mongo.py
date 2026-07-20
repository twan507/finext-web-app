"""Fake Mongo async cho test tầng bảo mật (auth/permission/IDOR).

Mở rộng bản tests/crud/_fake_mongo.py: bổ sung tham số `projection` cho `find()`
vì app/auth/access.py::get_user_permissions gọi
`db.roles.find({...}, {"permission_ids": 1})` và `db.permissions.find({...}, {"name": 1})`
(projection ở vị trí positional thứ 2). Bản crud chỉ nhận `find(flt)` nên sẽ TypeError.

Cho phép truy cập collection cả kiểu db["x"] lẫn db.x (access.py dùng cả hai)."""
from __future__ import annotations

from typing import Any

from tests.crud._fake_mongo import (  # type: ignore[import-not-found]
    FakeCollection as _CrudCollection,
    _Cursor,
    _matches,
)


class FakeCollection(_CrudCollection):
    def find(self, flt: dict | None = None, projection: Any = None) -> _Cursor:
        flt = flt or {}
        return _Cursor([dict(d) for d in self.docs if _matches(d, flt)])


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
