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
from ._seed_promotions import seed_promotions

logger = logging.getLogger(__name__)


async def seed_initial_data(db: AsyncIOMotorDatabase):
    try:
        # Bước 1: Seeding các thành phần cơ bản không phụ thuộc user
        permission_ids_map = await seed_permissions(db)
        await seed_features(db)
        license_ids_map = await seed_licenses(db)  # This now includes "FREE"
        await seed_promotions(db)

        # Bước 2: Seeding Roles (phụ thuộc permissions)
        role_ids_map = await seed_roles(db, permission_ids_map)
        if role_ids_map is None:
            logger.error("Không thể seeding các bước tiếp theo do lỗi ở seeding roles (role_ids_map is None).")
            return

        # Bước 3: Seeding Users (phụ thuộc roles)
        user_ids_map = await seed_users(db, role_ids_map)
        if not user_ids_map:
            logger.warning("Không có user IDs nào được tạo hoặc trả về từ seed_users. Các bước seeding phụ thuộc user có thể bị ảnh hưởng.")

        # Bước 4: Seeding Brokers (phụ thuộc users)
        await seed_brokers(db, user_ids_map if user_ids_map else {})

        # Bước 5: Seeding Subscriptions (phụ thuộc users và licenses)
        # This will seed specific subs (ADMIN, PARTNER) and then ensure all users (including USER_EMAIL_1,2,3)
        # get a FREE sub if they don't have an active one.
        await seed_subscriptions(db, user_ids_map if user_ids_map else {}, license_ids_map)

    except Exception as e:
        logger.error(f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True)


__all__ = ["seed_initial_data"]
