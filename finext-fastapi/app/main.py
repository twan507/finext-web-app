from fastapi import FastAPI
from .routers import items, auth  # Import the auth router
from .core.database import connect_to_mongo, close_mongo_connection, get_database
import logging
from contextlib import asynccontextmanager

# Cấu hình logging cơ bản
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    logger.info("Ứng dụng FastAPI đang khởi động...")
    await connect_to_mongo()
    yield
    # Code to run on shutdown
    logger.info("Ứng dụng FastAPI đang tắt...")
    await close_mongo_connection()

# Tạo một instance của FastAPI
app = FastAPI(
    title="Finext FastAPI",
    description="API cho ứng dụng Finext, tích hợp MongoDB.",
    version="0.1.0",
    lifespan=lifespan  # Use the lifespan context manager
)

app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(auth.router, prefix="/auth", tags=["authentication"])  # Add the auth router

# Định nghĩa một route cơ bản
@app.get("/")
async def read_root():
    db = get_database("user_db")
    if db is not None:  # Explicitly check if db is not None
        return {"message": f"Xin chào, đây là dự án FastAPI đầu tiên của tôi! Kết nối tới DB: {db.name}"}
    return {"message": "Xin chào, đây là dự án FastAPI đầu tiên của tôi! Không thể kết nối DB."}