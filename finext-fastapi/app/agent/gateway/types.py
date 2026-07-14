"""Interface chung của gateway — web runtime CHỈ biết những type này (doc 01 §5)."""

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class GatewayContext:
    """Web tạo mỗi request. user_id CHỈ để log/audit — không bao giờ vào query agent_db."""

    request_id: str
    user_id: str
    tier: str = "internal"  # điểm cắm gating tương lai (v1 allow-all)


@dataclass
class GatewayResult:
    ok: bool
    data: list[dict[str, Any]] | None = None
    error: str | None = None  # lỗi bằng NGÔN NGỮ MODEL HIỂU, kèm gợi ý sửa
    meta: dict[str, Any] = field(default_factory=dict)  # {collection, ms, bytes, plan, truncated}


class GatewayProtocol(Protocol):
    async def find(
        self,
        ctx: GatewayContext,
        collection: str,
        filter: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[list[Any]] | None = None,
        limit: int | None = None,
    ) -> GatewayResult: ...

    async def aggregate(
        self,
        ctx: GatewayContext,
        collection: str,
        pipeline: list[dict[str, Any]],
    ) -> GatewayResult: ...
