# finext-fastapi/app/main.py
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
# THÊM subscriptions VÀO IMPORT
from .routers import auth, users, roles, permissions, sessions, sse, subscriptions

from app.utils.response_wrapper import StandardApiResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Ứng dụng FastAPI đang khởi động...")
    await connect_to_mongo()
    if (
        mongodb.client
        and "user_db" in mongodb.dbs
        and mongodb.dbs["user_db"] is not None
    ):
        db_instance = mongodb.dbs["user_db"]
        await seed_initial_data(db_instance)
    else:
        logger.error("Không thể khởi tạo dữ liệu ban đầu.")
    yield
    logger.info("Ứng dụng FastAPI đang tắt...")
    await close_mongo_connection()


app = FastAPI(
    title="Finext FastAPI",
    description="API cho ứng dụng Finext, tích hợp MongoDB.",
    version="0.1.0",
    lifespan=lifespan,
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://finext.vn",
        "https://twan.io.vn/",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    logger.info(f"Custom handler bắt HTTPException: {exc.status_code} - {exc.detail}")
    error_response_payload = StandardApiResponse[Any](
        status=exc.status_code, message=str(exc.detail), data=None,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response_payload.model_dump(mode="json", exclude_none=False),
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_details_for_log = exc.errors()
    logger.error(f"Lỗi RequestValidationError: {json.dumps(error_details_for_log, indent=2)}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": error_details_for_log},
    )

app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(roles.router, prefix="/api/v1/roles", tags=["roles"])
app.include_router(permissions.router, prefix="/api/v1/permissions", tags=["permissions"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["subscriptions"])
app.include_router(sse.router, prefix="/api/v1/sse", tags=["sse"])


@app.get("/api/v1")
async def read_api_v1_root():
    return {"message": "Đây là gốc API v1 của Finext FastAPI!"}


@app.get("/")
async def read_root():
    return {"message": "Chào mừng đến với Finext!"}