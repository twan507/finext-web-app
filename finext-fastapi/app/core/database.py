from pymongo import MongoClient
from pymongo.database import Database
from pymongo.uri_parser import parse_uri # Added
from pymongo.errors import ConnectionFailure, ConfigurationError # Added
from .config import MONGODB_CONNECTION_STRING
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: MongoClient | None = None
    dbs: dict[str, Database | None] = {} # Changed to a dictionary

mongodb = MongoDB()

async def connect_to_mongo():
    if not MONGODB_CONNECTION_STRING:
        logger.error("MONGODB_CONNECTION_STRING is not set. Cannot connect to MongoDB.")
        return
    try:
        logger.info("Đang kết nối tới MongoDB...")
        # Initialize the main client
        mongodb.client = MongoClient(MONGODB_CONNECTION_STRING, serverSelectionTimeoutMS=5000)
        
        # Kiểm tra kết nối client
        mongodb.client.admin.command('ping')
        logger.info("Đã kết nối thành công tới MongoDB client!")

        # Kết nối tới các databases cụ thể
        db_names_to_connect = ["user_db", "stock_db"]
        mongodb.dbs = {} # Reset dbs dictionary

        for db_name in db_names_to_connect:
            mongodb.dbs[db_name] = mongodb.client[db_name]
            logger.info(f"Đã thiết lập kết nối tới database: {db_name}")
        
        logger.info(f"Sử dụng các databases: {', '.join(mongodb.dbs.keys())}")

    except ConnectionFailure as e: # Specific exception for connection failures
        logger.error(f"Không thể kết nối tới MongoDB (ConnectionFailure): {e}")
        if mongodb.client:
            mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {} # Clear dbs on failure
    except ConfigurationError as e: # Specific exception for configuration errors (e.g. bad URI)
        logger.error(f"Lỗi cấu hình MongoDB: {e}")
        if mongodb.client: # Client might exist if error is post-instantiation
            mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {} # Clear dbs on failure
    except Exception as e: # General fallback for other errors
        logger.error(f"Không thể kết nối tới MongoDB (Lỗi không xác định): {e}")
        if mongodb.client:
            mongodb.client.close()
        mongodb.client = None
        mongodb.dbs = {} # Clear dbs on failure

async def close_mongo_connection():
    if mongodb.client:
        logger.info("Đang đóng kết nối MongoDB...")
        mongodb.client.close()
        mongodb.dbs = {} # Clear dbs when client is closed
        logger.info("Đã đóng kết nối MongoDB.")

def get_database(db_name: str) -> Database | None: # Added db_name parameter
    return mongodb.dbs.get(db_name)

# Tạo thư mục app/core/ nếu chưa có và file __init__.py
# d:\twan-projects\finext-web-app\finext-fastapi\app\core\__init__.py (empty file)
