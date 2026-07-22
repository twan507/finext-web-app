"""CAP-03 — /api/v1/health phản ánh trung thực trạng thái kết nối DB.

Startup fail-open (không crash khi Mongo chết) là cố ý, nhưng healthcheck phải
báo unhealthy thật để không có 200 giả khi DB mất kết nối.
"""
import pytest

from app.core.database import mongodb
from app.main import health_check


@pytest.fixture
def restore_mongo():
    saved_client, saved_dbs = mongodb.client, mongodb.dbs
    yield
    mongodb.client, mongodb.dbs = saved_client, saved_dbs


async def test_health_ok_khi_co_ket_noi(restore_mongo):
    mongodb.client = object()  # chỉ cần khác None
    mongodb.dbs = {"user_db": object()}
    result = await health_check()
    assert result == {"status": "ok"}


async def test_health_503_khi_client_none(restore_mongo):
    mongodb.client = None
    mongodb.dbs = {}
    with pytest.raises(Exception) as exc:
        await health_check()
    assert getattr(exc.value, "status_code", None) == 503


async def test_health_503_khi_dbs_rong(restore_mongo):
    """Client còn nhưng dbs rỗng (vd lỗi index làm rụng dbs) → vẫn unhealthy."""
    mongodb.client = object()
    mongodb.dbs = {}
    with pytest.raises(Exception) as exc:
        await health_check()
    assert getattr(exc.value, "status_code", None) == 503
