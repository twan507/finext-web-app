from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging

# Import các router của bạn
from .routers import items, auth, users

# Import các hàm quản lý DB và seeding
from .core.database import connect_to_mongo, close_mongo_connection, get_database, mongodb
from .core.seeding import seed_initial_data # THÊM IMPORT NÀY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    logger.info("Ứng dụng FastAPI đang khởi động...")
    await connect_to_mongo() # Kết nối và tạo indexes

    # Khởi tạo dữ liệu ban đầu sau khi kết nối DB thành công
    if mongodb.client and "user_db" in mongodb.dbs and mongodb.dbs["user_db"] is not None:
        db_instance = mongodb.dbs["user_db"]
        await seed_initial_data(db_instance) # GỌI HÀM SEEDING
    else:
        logger.error("Không thể khởi tạo dữ liệu ban đầu do kết nối DB thất bại hoặc user_db không khả dụng.")

    yield
    # Code to run on shutdown
    logger.info("Ứng dụng FastAPI đang tắt...")
    await close_mongo_connection()

app = FastAPI(
    title="Finext FastAPI",
    description="API cho ứng dụng Finext, tích hợp MongoDB.",
    version="0.1.0",
    lifespan=lifespan
)

# Include routers
app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(users.router, prefix="/users", tags=["users"])

@app.get("/")
async def read_root():
    # Sử dụng get_database để lấy instance một cách an toàn
    db = get_database("user_db") # Sử dụng tên DB bạn đã định nghĩa khi kết nối
    if db is not None:
        return {"message": f"Xin chào, đây là dự án FastAPI đầu tiên của tôi! Kết nối tới DB: {db.name}"}
    return {"message": "Xin chào, đây là dự án FastAPI đầu tiên của tôi! Không thể kết nối DB."}