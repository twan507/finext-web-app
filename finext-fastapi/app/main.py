import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import json
from fastapi.middleware.cors import CORSMiddleware

from .core.database import (
    connect_to_mongo,
    close_mongo_connection,
    mongodb,
)
from .core.seeding import seed_initial_data
from .routers import auth, users, roles, permissions, sessions, sse

from app.utils.response_wrapper import StandardApiResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    logger.info("Ứng dụng FastAPI đang khởi động...")
    await connect_to_mongo()

    # Khởi tạo dữ liệu ban đầu
    if (
        mongodb.client
        and "user_db" in mongodb.dbs
        and mongodb.dbs["user_db"] is not None
    ):
        db_instance = mongodb.dbs["user_db"]
        await seed_initial_data(db_instance)
    else:
        logger.error(
            "Không thể khởi tạo dữ liệu ban đầu do kết nối DB thất bại hoặc user_db không khả dụng."
        )

    yield
    # Code to run on shutdown
    logger.info("Ứng dụng FastAPI đang tắt...")
    await close_mongo_connection()


app = FastAPI(
    title="Finext FastAPI",
    description="API cho ứng dụng Finext, tích hợp MongoDB.",
    version="0.1.0",
    lifespan=lifespan,
    # THAY ĐỔI: Thêm /v1 vào openapi_url
    openapi_url="/api/v1/openapi.json",
    # THAY ĐỔI: Cập nhật docs_url và redoc_url để chúng cũng nằm dưới /api/v1
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

# THÊM CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://finext.vn",
        "https://twan.io.vn/",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


# THÊM CUSTOM HTTP EXCEPTION HANDLER
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    logger.info(
        f"Custom handler bắt HTTPException: {exc.status_code} - {exc.detail} cho request: {request.method} {request.url}"
    )
    error_response_payload = StandardApiResponse[Any](
        status=exc.status_code,
        message=str(exc.detail),
        data=None,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response_payload.model_dump(mode="json", exclude_none=False),
    )


# EXCEPTION HANDLER
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_details_for_log = exc.errors()
    logger.error(
        f"Lỗi RequestValidationError: {json.dumps(error_details_for_log, indent=2)}"
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": error_details_for_log},
    )


# Include routers - THÊM /v1 VÀO TRƯỚC MỖI PREFIX CŨ
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(roles.router, prefix="/api/v1/roles", tags=["roles"])
app.include_router(permissions.router, prefix="/api/v1/permissions", tags=["permissions"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(sse.router, prefix="/api/v1/sse", tags=["sse"])

@app.get("/api/v1")  # THAY ĐỔI: Endpoint gốc của API
async def read_api_v1_root():
    return {"message": "Đây là gốc API v1 của Finext FastAPI!"}


@app.get("/")
async def read_root():
    return {
        "message": "Chào mừng đến với Finext! Truy cập /api/v1/docs để xem tài liệu API."
    }
