import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import json
from fastapi.middleware.cors import CORSMiddleware

from .core.database import connect_to_mongo, close_mongo_connection, get_database, mongodb
from .core.seeding import seed_initial_data
from .routers import auth, users

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    logger.info("Ứng dụng FastAPI đang khởi động...")
    await connect_to_mongo()

    # Khởi tạo dữ liệu ban đầu sau khi kết nối DB thành công
    if (
        mongodb.client
        and "user_db" in mongodb.dbs
        and mongodb.dbs["user_db"] is not None
    ):
        db_instance = mongodb.dbs["user_db"]
        await seed_initial_data(db_instance)  # GỌI HÀM SEEDING
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
)

# THÊM CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js development server
        "http://127.0.0.1:3000",  # Alternative localhost
        "https://finext.vn",  # Thêm domain production nếu có
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

#EXCEPTION HANDLER:
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_details_for_log = exc.errors()
    
    # In ra terminal bằng print() để đảm bảo nó xuất hiện
    print("-----------------------------------------------------------------------")
    print(f"!!! LỖI VALIDATION (422) CHO REQUEST: {request.method} {request.url}")
    print("!!! CHI TIẾT LỖI VALIDATION TỪ PYDANTIC (exc.errors()):")
    try:
        # Cố gắng pretty print JSON nếu được
        print(json.dumps(error_details_for_log, indent=2, ensure_ascii=False))
    except TypeError: # Nếu có gì đó không thể serialize sang JSON (ít khả năng với exc.errors())
        print(str(error_details_for_log))
    print("-----------------------------------------------------------------------")
    
    # Log bằng logger như cũ (để phòng trường hợp print không hoạt động vì lý do nào đó)
    logger.error(f"Lỗi RequestValidationError cho request: {request.method} {request.url}")
    logger.error(f"Chi tiết lỗi Pydantic: {json.dumps(error_details_for_log, indent=2)}")
    
    # Trả về response lỗi 422 chuẩn của FastAPI
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": error_details_for_log}, # Sử dụng error_details_for_log
    )

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(users.router, prefix="/users", tags=["users"])

@app.get("/")
async def read_root():
    # Sử dụng get_database để lấy instance một cách an toàn
    db = get_database("user_db")  # Sử dụng tên DB bạn đã định nghĩa khi kết nối
    if db is not None:
        return {
            "message": f"Xin chào, đây là dự án FastAPI đầu tiên của tôi! Kết nối tới DB: {db.name}"
        }
    return {
        "message": "Xin chào, đây là dự án FastAPI đầu tiên của tôi! Không thể kết nối DB."
    }
