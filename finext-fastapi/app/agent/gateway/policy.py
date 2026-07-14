"""Load + parse policy file. Toàn bộ hiểu biết về agent_db nằm ở YAML, không ở code."""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

DEFAULT_POLICY_PATH = Path(__file__).parent / "policy.agent_db.yaml"


@dataclass
class PolicyDefaults:
    max_response_kb: int
    max_time_ms: int
    default_limit: int
    max_limit: int
    banned_operators: list[str]


@dataclass
class CollectionRule:
    name: str
    size: str  # "large" | "small"
    key: str | None = None
    require_filter: list[str] = field(default_factory=list)
    require_series_slice: bool = False
    max_slice: int | None = None
    allow_aggregate: bool = True  # False cho collection có mảng lớn: aggregate là đường exfil không chặn nổi


@dataclass
class Policy:
    version: int
    defaults: PolicyDefaults
    collections: dict[str, CollectionRule]

    @classmethod
    def load(cls, path: Path | str = DEFAULT_POLICY_PATH) -> "Policy":
        raw: dict[str, Any] = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        defaults = PolicyDefaults(**raw["defaults"])
        collections = {
            name: CollectionRule(name=name, **(cfg or {}))
            for name, cfg in raw["collections"].items()
        }
        policy = cls(version=raw["version"], defaults=defaults, collections=collections)
        logger.info("Đã nạp policy agent_db version=%s (%d collection)", policy.version, len(collections))
        return policy

    def rule_for(self, collection: str) -> CollectionRule | None:
        return self.collections.get(collection)
