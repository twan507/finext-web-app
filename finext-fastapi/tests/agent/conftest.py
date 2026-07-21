"""Fixture chung cho test agent: reset registry chạy nền per-user giữa các test.

Registry `_runners` là state module-level (in-memory). Không reset → task nền của test trước
rò sang test sau (loop khác) gây nhiễu. Clear trước + huỷ task còn sót sau mỗi test."""
import pytest

import app.routers.chat as chat_router


@pytest.fixture(autouse=True)
def _reset_chat_runners():
    chat_router._runners.clear()
    yield
    for runner in list(chat_router._runners.values()):
        task = runner.current
        if task is not None and not task.done():
            task.cancel()
    chat_router._runners.clear()
