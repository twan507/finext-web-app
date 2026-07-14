"""Gateway — lớp duy nhất được chạm agent_db (doc 01)."""

import logging

from app.core.config import AGENT_GATEWAY, GATEWAY_EXPLAIN_MODE
from app.core.database import get_database

from .executor import MongoGateway
from .fixture import FixtureGateway
from .policy import Policy
from .types import GatewayContext, GatewayProtocol, GatewayResult

logger = logging.getLogger(__name__)

__all__ = ["GatewayContext", "GatewayProtocol", "GatewayResult", "build_gateway"]

_policy: Policy | None = None


def build_gateway() -> GatewayProtocol:
    """Chọn implementation theo env. Fixture KHÔNG BAO GIỜ chạy ở production (doc 01 §7)."""
    global _policy
    if _policy is None:
        _policy = Policy.load()

    if AGENT_GATEWAY == "fixture":
        logger.warning("Gateway đang chạy chế độ FIXTURE — chỉ dùng cho dev/test.")
        return FixtureGateway(_policy)

    return MongoGateway(get_database("agent_db"), _policy, explain_mode=GATEWAY_EXPLAIN_MODE)
