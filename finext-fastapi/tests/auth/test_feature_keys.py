"""Test get_user_feature_keys — resolve feature keys từ subscription hiệu lực → license.feature_keys.

Dùng chung cho /me/features (auth router) và gate advanced của mode=portfolio (chat router).
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import app.auth.access as access


class _Sub:
    def __init__(self, license_id, is_active, expiry_date):
        self.license_id = license_id
        self.is_active = is_active
        self.expiry_date = expiry_date


class _Lic:
    def __init__(self, feature_keys):
        self.feature_keys = feature_keys


async def test_no_subscription_returns_empty():
    user = SimpleNamespace(subscription_id=None)
    assert await access.get_user_feature_keys(object(), user) == []


async def test_active_sub_returns_license_features(monkeypatch):
    future = datetime.now(timezone.utc) + timedelta(days=30)

    async def fake_sub(db, sid):
        return _Sub("60d5ec49f7b4e6a0e7d5c2b2", True, future)

    async def fake_lic(db, license_id):
        return _Lic(["advanced_feature", "basic_feature"])

    monkeypatch.setattr(access.crud_subscriptions, "get_subscription_by_id_db", fake_sub)
    monkeypatch.setattr(access.crud_licenses, "get_license_by_id", fake_lic)
    user = SimpleNamespace(subscription_id="60d5ec49f7b4e6a0e7d5c2a1")
    keys = await access.get_user_feature_keys(object(), user)
    assert "advanced_feature" in keys


async def test_expired_sub_returns_empty(monkeypatch):
    past = datetime.now(timezone.utc) - timedelta(days=1)

    async def fake_sub(db, sid):
        return _Sub("60d5ec49f7b4e6a0e7d5c2b2", True, past)

    monkeypatch.setattr(access.crud_subscriptions, "get_subscription_by_id_db", fake_sub)
    user = SimpleNamespace(subscription_id="60d5ec49f7b4e6a0e7d5c2a1")
    assert await access.get_user_feature_keys(object(), user) == []


async def test_inactive_sub_returns_empty(monkeypatch):
    future = datetime.now(timezone.utc) + timedelta(days=30)

    async def fake_sub(db, sid):
        return _Sub("60d5ec49f7b4e6a0e7d5c2b2", False, future)

    monkeypatch.setattr(access.crud_subscriptions, "get_subscription_by_id_db", fake_sub)
    user = SimpleNamespace(subscription_id="60d5ec49f7b4e6a0e7d5c2a1")
    assert await access.get_user_feature_keys(object(), user) == []
