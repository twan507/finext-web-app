import json

from app.agent.events import ToolCall
from app.agent.gateway.executor import MongoGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool
from tests.agent.gateway.test_executor import FakeCollection, FakeDB

CTX = GatewayContext(request_id="r1", user_id="u1")


def _stats_policy() -> Policy:
    policy = Policy.load()
    policy.collections["history_finratios_industry"].stats_fields = ["series.pe", "series.pb"]
    return policy


def test_db_stats_registered_in_schemas():
    names = {schema["function"]["name"] for schema in TOOL_SCHEMAS}
    assert "db_stats" in names
    schema = next(s for s in TOOL_SCHEMAS if s["function"]["name"] == "db_stats")
    props = schema["function"]["parameters"]["properties"]
    assert {"collection", "field", "ops"} <= set(props)
    assert schema["function"]["parameters"]["required"] == ["collection", "field", "ops"]


async def test_execute_db_stats_returns_scalar_json():
    series = [{"date": f"2020-01-{i:02d}", "pe": 10.0 + i} for i in range(1, 6)]
    collection = FakeCollection([{"industry_name": "Toàn bộ thị trường", "series": series}])
    gateway = MongoGateway(FakeDB(collection), _stats_policy())
    call = ToolCall(
        id="c1", name="db_stats",
        arguments={
            "collection": "history_finratios_industry",
            "field": "series.pe", "ops": ["min", "max", "latest"],
            "filter": {"industry_name": "Toàn bộ thị trường"},
        },
    )
    content, meta = await execute_tool(gateway, CTX, call)
    assert meta["ok"] is True
    row = json.loads(content)[0]
    assert row["min"] == 11.0 and row["max"] == 15.0 and row["latest"] == 15.0


async def test_execute_db_stats_bad_op_returns_teaching_error():
    collection = FakeCollection([{"industry_name": "X", "series": [{"date": "d", "pe": 1.0}]}])
    gateway = MongoGateway(FakeDB(collection), _stats_policy())
    call = ToolCall(
        id="c2", name="db_stats",
        arguments={"collection": "history_finratios_industry", "field": "series.pe", "ops": ["sum"], "filter": {"industry_name": "X"}},
    )
    content, meta = await execute_tool(gateway, CTX, call)
    assert meta["ok"] is False
    assert "hợp lệ" in content
