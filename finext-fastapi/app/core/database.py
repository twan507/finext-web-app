from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase # Thay đổi import
from pymongo.errors import ConnectionFailure, ConfigurationError
from .config import MONGODB_CONNECTION_STRING
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient | None = None # Thay đổi kiểu dữ liệu
    dbs: dict[str, AsyncIOMotorDatabase | None] = {} # Thay đổi kiểu dữ liệu

mongodb = MongoDB()

async def connect_to_mongo():
    if not MONGODB_CONNECTION_STRING:
        logger.error("MONGODB_CONNECTION_STRING is not set. Cannot connect to MongoDB.")
        mongodb.client = None
        mongodb.dbs = {}
        return
    try:
        logger.info("Đang kết nối tới MongoDB (Async)...")
        mongodb.client = AsyncIOMotorClient(MONGODB_CONNECTION_STRING, serverSelectionTimeoutMS=5000)
        await mongodb.client.admin.command('ping')
        logger.info("Đã kết nối thành công tới MongoDB client (Async)!")

        db_names_to_connect = ["user_db", "stock_db"] # Giả sử user_db là nơi chứa các collection mới
        mongodb.dbs = {}

        for db_name in db_names_to_connect:
            mongodb.dbs[db_name] = mongodb.client[db_name]
            logger.info(f"Đã thiết lập kết nối tới database (Async): {db_name}")

        # ---- TẠO INDEXES ----
        if "user_db" in mongodb.dbs and mongodb.dbs["user_db"] is not None:
            db = mongodb.dbs["user_db"] # Lấy database instance

            # users collection indexes
            await db.users.create_index("email", unique=True)

            # roles collection indexes
            await db.roles.create_index("name", unique=True)

            # permissions collection indexes
            await db.permissions.create_index("name", unique=True)

            # active_sessions collection indexes
            await db.active_sessions.create_index("jti", unique=True)

            logger.info("Đã tạo/đảm bảo các indexes cần thiết cho user_db.")
        # --------------------

        logger.info(f"Sử dụng các databases (Async): {', '.join(mongodb.dbs.keys())}")

    except ConnectionFailure as e:
        logger.error(f"Không thể kết nối tới MongoDB (ConnectionFailure): {e}")
        if mongodb.client:
            mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {}
    except ConfigurationError as e:
        logger.error(f"Lỗi cấu hình MongoDB: {e}")
        if mongodb.client:
            mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {}
    except Exception as e:
        logger.error(f"Không thể kết nối tới MongoDB (Lỗi không xác định): {e}")
        if mongodb.client:
            mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {}

async def close_mongo_connection():
    if mongodb.client:
        logger.info("Đang đóng kết nối MongoDB (Async)...")
        mongodb.client.close()
        mongodb.client = None # Quan trọng: đặt lại client thành None
        mongodb.dbs = {} # Xóa các tham chiếu db
        logger.info("Đã đóng kết nối MongoDB (Async).")

def get_database(db_name: str) -> AsyncIOMotorDatabase | None: # Thay đổi kiểu trả về
    if mongodb.client and db_name in mongodb.dbs:
        return mongodb.dbs.get(db_name)
    elif mongodb.client: # Nếu client tồn tại nhưng db chưa được khởi tạo trước
        logger.warning(f"Database '{db_name}' chưa được khởi tạo trước. Đang thử truy cập trực tiếp.")
        # Cẩn thận: điều này có thể không phải lúc nào cũng mong muốn nếu bạn muốn kiểm soát chặt chẽ các db được sử dụng
        db_instance = mongodb.client[db_name]
        mongodb.dbs[db_name] = db_instance # Cache lại để sử dụng sau
        return db_instance
    logger.warning(f"Database '{db_name}' không khả dụng hoặc MongoDB client (Async) chưa được kết nối.")
    return None

# Tạo thư mục app/core/ nếu chưa có và file __init__.py
# d:\twan-projects\finext-web-app\finext-fastapi\app\core\__init__.py (empty file)