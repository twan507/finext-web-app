# finext-fastapi/app/main.py
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import json
from fastapi.middleware.cors import CORSMiddleware

from .core.database import (
    connect_to_mongo,
    close_mongo_connection,
    get_database
)
from .core.seeding import seed_initial_data

# routers cũ
from .routers import auth, users, roles, permissions, sessions, sse, subscriptions, transactions
from .routers import brokers as brokers_router
# THÊM IMPORT ROUTER MỚI
from .routers import licenses as licenses_router # <--- THÊM DÒNG NÀY

from app.utils.response_wrapper import StandardApiResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Ứng dụng FastAPI đang khởi động...")
    await connect_to_mongo()

    try:
        db_instance = get_database("user_db")
        if db_instance is not None:
            await seed_initial_data(db_instance)
        else:
            logger.error("Không thể lấy user_db instance để khởi tạo dữ liệu ban đầu (get_database trả về None).")
    except RuntimeError as e:
         logger.error(f"Lỗi khi lấy database để seeding: {e}")
    except Exception as e:
        logger.error(f"Lỗi không xác định trong quá trình seeding: {e}", exc_info=True)

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
        "https://twan.io.vn",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    error_response_payload = StandardApiResponse[Any](
        status=exc.status_code, message=str(exc.detail), data=None,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response_payload.model_dump(exclude_none=True),
        headers=getattr(exc, "headers", None),
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        loggable_error_details = json.dumps(jsonable_encoder(exc.errors()), ensure_ascii=False)
    except Exception:
        loggable_error_details = str(exc.errors())

    logger.warning(
        f"RequestValidationError: Path: {request.url.path}, Details: {loggable_error_details}"
    )

    serializable_errors = jsonable_encoder(exc.errors())

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=StandardApiResponse[Any](
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Lỗi xác thực dữ liệu đầu vào.",
            data={"errors": serializable_errors}
        ).model_dump(exclude_none=True),
    )

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(roles.router, prefix="/api/v1/roles", tags=["roles"])
app.include_router(permissions.router, prefix="/api/v1/permissions", tags=["permissions"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["subscriptions"])
app.include_router(sse.router, prefix="/api/v1/sse", tags=["sse"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(brokers_router.router, prefix="/api/v1/brokers", tags=["brokers"])
app.include_router(licenses_router.router, prefix="/api/v1/licenses", tags=["licenses"])


@app.get("/api/v1")
async def read_api_v1_root():
    return {"message": "Đây là gốc API v1 của Finext FastAPI!"}


@app.get("/")
async def read_root():
    return {"message": "Chào mừng đến với Finext!"}