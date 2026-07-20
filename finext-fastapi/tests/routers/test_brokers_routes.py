"""Test S1 — C5: route GET /me phải được khai báo TRƯỚC GET /{broker_id_or_code},
nếu không FastAPI sẽ match /me vào route param và không bao giờ tới handler /me."""
from app.routers.brokers import router


def _get_paths_in_order(method: str) -> list[str]:
    paths: list[str] = []
    for route in router.routes:
        methods = getattr(route, "methods", None) or set()
        if method in methods:
            paths.append(route.path)
    return paths


def test_me_route_declared_before_param_route():
    get_paths = _get_paths_in_order("GET")
    assert "/me" in get_paths
    assert "/{broker_id_or_code}" in get_paths
    assert get_paths.index("/me") < get_paths.index("/{broker_id_or_code}")
