# finext-fastapi/app/core/seeding/__init__.py
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from ._seed_permissions import seed_permissions
from ._seed_features import seed_features
from ._seed_roles import seed_roles
from ._seed_licenses import seed_licenses
from ._seed_users import seed_users
from ._seed_brokers import seed_brokers 
from ._seed_subscriptions import seed_subscriptions

logger = logging.getLogger(__name__)

async def seed_initial_data(db: AsyncIOMotorDatabase):
    logger.info("Bắt đầu quá trình kiểm tra và khởi tạo dữ liệu ban đầu...")
    try:
        # Bước 1: Seeding các thành phần cơ bản không phụ thuộc user
        permission_ids_map = await seed_permissions(db)
        await seed_features(db) 
        license_ids_map = await seed_licenses(db) 

        # Bước 2: Seeding Roles (phụ thuộc permissions)
        role_ids_map = await seed_roles(db, permission_ids_map)
        if role_ids_map is None: # Sửa: Kiểm tra role_ids_map is None
            logger.error("Không thể seeding các bước tiếp theo do lỗi ở seeding roles (role_ids_map is None).")
            return

        # Bước 3: Seeding Users (phụ thuộc roles)
        # seed_users sẽ tự gán role "broker" cho BROKER_EMAIL nếu có trong config
        user_ids_map = await seed_users(db, role_ids_map)
        if not user_ids_map: 
            logger.warning("Không có user IDs nào được tạo hoặc trả về từ seed_users. Các bước seeding phụ thuộc user có thể bị ảnh hưởng.")
            # Vẫn tiếp tục để seed_brokers có thể được gọi nếu BROKER_EMAIL đã tồn tại từ trước
        
        # Bước 4: Seeding Brokers (phụ thuộc users)
        # Hàm này sẽ tạo bản ghi broker cho BROKER_EMAIL nếu user đó tồn tại
        # và chưa phải là broker. Sau đó, nó sẽ cập nhật referral_code cho user BROKER_EMAIL.
        await seed_brokers(db, user_ids_map if user_ids_map else {}) # Truyền dict rỗng nếu user_ids_map là None


        # Bước 5: Seeding Subscriptions (phụ thuộc users và licenses)
        # seed_subscriptions sẽ gán license "PARTNER" cho BROKER_EMAIL
        # Đảm bảo user_ids_map được truyền đúng
        await seed_subscriptions(db, user_ids_map if user_ids_map else {}, license_ids_map)

        logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu.")
    except Exception as e:
        logger.error(
            f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True
        )

__all__ = ["seed_initial_data"]