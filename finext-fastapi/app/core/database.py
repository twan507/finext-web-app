# finext-fastapi/app/core/database.py
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ConfigurationError
from .config import MONGODB_CONNECTION_STRING
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient | None = None
    dbs: dict[str, AsyncIOMotorDatabase | None] = {}

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

        db_names_to_connect = ["user_db", "stock_db"]
        mongodb.dbs = {}

        for db_name in db_names_to_connect:
            mongodb.dbs[db_name] = mongodb.client[db_name]
            logger.info(f"Đã thiết lập kết nối tới database (Async): {db_name}")

        if "user_db" in mongodb.dbs and mongodb.dbs["user_db"] is not None:
            db = mongodb.dbs["user_db"]

            # users collection indexes
            await db.users.create_index("email", unique=True)
            # THAY ĐỔI: Index cho subscription_id
            await db.users.create_index("subscription_id")

            # roles collection indexes
            await db.roles.create_index("name", unique=True)

            # permissions collection indexes
            await db.permissions.create_index("name", unique=True)

            # sessions collection indexes
            await db.sessions.create_index("user_id")
            await db.sessions.create_index("jti", unique=True)
            await db.sessions.create_index("created_at")
            await db.sessions.create_index("last_active_at")

            # features collection indexes
            await db.features.create_index("key", unique=True)

            # licenses collection indexes
            await db.licenses.create_index("key", unique=True)

            # subscriptions collection indexes (MỚI)
            await db.subscriptions.create_index("user_id")
            await db.subscriptions.create_index("license_id")
            await db.subscriptions.create_index([("user_id", 1), ("is_active", 1), ("expiry_date", 1)])
            await db.subscriptions.create_index("expiry_date")


            logger.info("Đã tạo/đảm bảo các indexes cần thiết cho user_db.")

        logger.info(f"Sử dụng các databases (Async): {', '.join(mongodb.dbs.keys())}")

    except (ConnectionFailure, ConfigurationError, Exception) as e:
        logger.error(f"Không thể kết nối tới MongoDB: {e}")
        if mongodb.client:
            mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {}

async def close_mongo_connection():
    if mongodb.client:
        logger.info("Đang đóng kết nối MongoDB (Async)...")
        mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {}
        logger.info("Đã đóng kết nối MongoDB (Async).")

def get_database(db_name: str) -> AsyncIOMotorDatabase | None:
    if mongodb.client and db_name in mongodb.dbs:
        return mongodb.dbs.get(db_name)
    elif mongodb.client:
        logger.warning(f"Database '{db_name}' chưa được khởi tạo trước. Đang thử truy cập trực tiếp.")
        db_instance = mongodb.client[db_name]
        mongodb.dbs[db_name] = db_instance
        return db_instance
    logger.warning(f"Database '{db_name}' không khả dụng hoặc MongoDB client (Async) chưa được kết nối.")
    return None