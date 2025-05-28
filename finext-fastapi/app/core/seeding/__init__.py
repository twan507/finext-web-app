# finext-fastapi/app/core/seeding/__init__.py
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from ._seed_permissions import seed_permissions
from ._seed_features import seed_features
from ._seed_roles import seed_roles
from ._seed_licenses import seed_licenses
from ._seed_users import seed_users
from ._seed_subscriptions import seed_subscriptions

logger = logging.getLogger(__name__)

async def seed_initial_data(db: AsyncIOMotorDatabase):
    logger.info("Bắt đầu quá trình kiểm tra và khởi tạo dữ liệu ban đầu...")
    try:
        permission_ids_map = await seed_permissions(db)
        # Features can be seeded independently or if licenses depend on their IDs,
        # they could return a map too. For now, it returns a map but it's not used by others.
        await seed_features(db) # Keep this if licenses don't need feature_ids map directly for seeding
                                # If they do, then: feature_ids_map = await seed_features(db)

        license_ids_map = await seed_licenses(db) # Depends on features being present in DB if validation is strict

        # Roles depend on permissions
        role_ids_map = await seed_roles(db, permission_ids_map)
        if role_ids_map is None:
            logger.error("Không thể seeding users và subscriptions do lỗi ở seeding roles (role_ids_map is None).")
            return

        # Users depend on roles
        user_ids_map = await seed_users(db, role_ids_map)
        if not user_ids_map: # Check if the map is empty or None if seed_users could return None
            logger.warning("Không có user IDs nào được tạo hoặc trả về từ seed_users. Bỏ qua seeding subscriptions.")
            # Still log completion, but with a warning
            logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu (với cảnh báo về users).")
            return


        # Subscriptions depend on users and licenses
        await seed_subscriptions(db, user_ids_map, license_ids_map)

        logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu.")
    except Exception as e:
        logger.error(
            f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True
        )

__all__ = ["seed_initial_data"]