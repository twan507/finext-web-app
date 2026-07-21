"""Gate trang tài liệu API theo môi trường (đợt hardening 2026-07-20).

FastAPI mặc định mở /docs, /redoc, /openapi.json ở MỌI môi trường, lộ toàn bộ
cấu trúc API ra public ở production. ``resolve_docs_urls`` chỉ MỞ khi
ENVIRONMENT == "development"; production / thiếu biến / giá trị lạ đều TẮT (None).

Test hàm thuần ``resolve_docs_urls`` (deterministic, không cần reload/env), cộng
một test wiring xác nhận app thật dùng đúng kết quả của hàm theo config.ENVIRONMENT.
"""

from app.core import config
from app.main import resolve_docs_urls


def test_development_mo_full_docs() -> None:
    urls = resolve_docs_urls("development")
    assert urls == {
        "openapi_url": "/api/v1/openapi.json",
        "docs_url": "/api/v1/docs",
        "redoc_url": "/api/v1/redoc",
    }


def test_production_tat_het() -> None:
    urls = resolve_docs_urls("production")
    assert urls == {"openapi_url": None, "docs_url": None, "redoc_url": None}


def test_thieu_bien_hoac_gia_tri_la_fail_safe_tat() -> None:
    # Bất kỳ giá trị nào KHÁC "development" đều phải TẮT (fail-safe về prod).
    for env in ("", "prod", "staging", "PRODUCTION", "dev", "test"):
        urls = resolve_docs_urls(env)
        assert urls == {"openapi_url": None, "docs_url": None, "redoc_url": None}, env


def test_development_khong_phan_biet_hoa_thuong_va_khoang_trang() -> None:
    for env in ("Development", "  development  ", "DEVELOPMENT"):
        urls = resolve_docs_urls(env)
        assert urls["docs_url"] == "/api/v1/docs", env
        assert urls["openapi_url"] == "/api/v1/openapi.json", env
        assert urls["redoc_url"] == "/api/v1/redoc", env


def test_app_that_wiring_khop_voi_resolve() -> None:
    # App tạo ở module-level -> xác nhận nó dùng đúng URL do resolve_docs_urls tính
    # theo config.ENVIRONMENT thực tế (giá trị nào cũng đúng, không phụ thuộc file .env).
    from app.main import app

    expected = resolve_docs_urls(config.ENVIRONMENT)
    assert app.docs_url == expected["docs_url"]
    assert app.redoc_url == expected["redoc_url"]
    assert app.openapi_url == expected["openapi_url"]
