import logging
from datetime import datetime
from typing import Annotated, Dict, List, Optional, Set

from app.schemas.permissions import PermissionCreate
from app.schemas.roles import RoleCreate
from app.schemas.users import UserCreate
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext
from pydantic import BeforeValidator
from .config import ADMIN_EMAIL, ADMIN_PWD

PyObjectId = Annotated[str, BeforeValidator(str)]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

logger = logging.getLogger(__name__)

DEFAULT_PERMISSIONS_DATA = [
    {"name": "user:create", "description": "Quyền tạo người dùng mới"},
    {"name": "user:read", "description": "Quyền xem thông tin người dùng"},
    {"name": "user:update", "description": "Quyền cập nhật thông tin người dùng"},
    {"name": "user:delete", "description": "Quyền xóa người dùng"},
    {"name": "user:manage_roles", "description": "Quyền quản lý vai trò của người dùng"},
    {"name": "role:create", "description": "Quyền tạo vai trò mới"},
    {"name": "role:read", "description": "Quyền xem thông tin vai trò"},
    {"name": "role:update", "description": "Quyền cập nhật vai trò"},
    {"name": "role:delete", "description": "Quyền xóa vai trò"},
    {"name": "role:manage_permissions", "description": "Quyền quản lý quyền của vai trò"},
    {"name": "session:read", "description": "Quyền xem các session đang hoạt động"},
    {"name": "session:delete", "description": "Quyền chấm dứt session"},
]

# Danh sách tên các permission mặc định để kiểm tra
ALL_DEFAULT_PERMISSION_NAMES: Set[str] = {p["name"] for p in DEFAULT_PERMISSIONS_DATA}

async def seed_permissions(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    permissions_collection = db.get_collection("permissions")
    created_permission_ids: Dict[str, PyObjectId] = {}
    should_seed_permissions = await permissions_collection.find_one() is None

    if should_seed_permissions:
        logger.info("Collection 'permissions' trống. Bắt đầu seeding permissions...")
        for perm_data in DEFAULT_PERMISSIONS_DATA:
            permission_to_create = PermissionCreate(**perm_data)
            result = await permissions_collection.insert_one(
                {
                    **permission_to_create.model_dump(),
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
            )
            logger.info(f"Đã tạo permission: {perm_data['name']} với ID: {result.inserted_id}")
            created_permission_ids[perm_data['name']] = result.inserted_id
    else:
        async for perm_doc in permissions_collection.find({"name": {"$in": list(ALL_DEFAULT_PERMISSION_NAMES)}}):
            if perm_doc["name"] in ALL_DEFAULT_PERMISSION_NAMES: # Đảm bảo chỉ lấy perm mặc định
                created_permission_ids[perm_doc["name"]] = perm_doc["_id"]
        logger.info(f"Collection 'permissions' đã có dữ liệu. Tải {len(created_permission_ids)} permissions vào map.")

    return created_permission_ids


async def seed_roles(db: AsyncIOMotorDatabase, permission_ids_map: Dict[str, PyObjectId]) -> Optional[Dict[str, PyObjectId]]:
    roles_collection = db.get_collection("roles")
    created_role_ids: Dict[str, PyObjectId] = {}
    should_seed_roles = await roles_collection.find_one() is None

    default_roles_data_template = [ # Đổi tên để phân biệt
        {
            "name": "admin",
            "description": "Quản trị viên hệ thống, có tất cả quyền.",
            "permission_names": list(ALL_DEFAULT_PERMISSION_NAMES) # Admin có tất cả permission mặc định
        },
        {
            "name": "user",
            "description": "Người dùng thông thường.",
            "permission_names": ["user:read", "user:update"]
        },
        {
            "name": "broker",
            "description": "Nhà môi giới.",
            "permission_names": ["user:read"]
        },
    ]

    # Kiểm tra xem tất cả permissions cần thiết cho các role mặc định có trong permission_ids_map không
    required_permission_names_for_default_roles: Set[str] = set()
    for role_template in default_roles_data_template:
        for perm_name in role_template.get("permission_names", []):
            required_permission_names_for_default_roles.add(perm_name)

    missing_permissions_for_roles: Set[str] = set()
    for perm_name in required_permission_names_for_default_roles:
        if perm_name not in permission_ids_map:
            missing_permissions_for_roles.add(perm_name)

    if missing_permissions_for_roles:
        logger.error(
            f"Không thể seeding roles do thiếu các permissions cần thiết: {missing_permissions_for_roles}. "
            f"Hãy đảm bảo các permissions này được định nghĩa trong DEFAULT_PERMISSIONS_DATA và đã được seed hoặc tồn tại trong DB."
        )
        return None # Hủy bỏ việc seed roles

    if should_seed_roles:
        logger.info("Collection 'roles' trống và tất cả permissions cần thiết đã có. Bắt đầu seeding roles...")
        for role_data_template in default_roles_data_template:
            current_role_permission_ids: List[PyObjectId] = []
            all_perms_for_this_role_found = True
            for perm_name in role_data_template.get("permission_names", []):
                perm_id = permission_ids_map.get(perm_name)
                if perm_id:
                    current_role_permission_ids.append(perm_id)
                else:
                    # Điều này không nên xảy ra nếu kiểm tra ở trên đã pass
                    logger.error(f"Lỗi logic: Permission '{perm_name}' không tìm thấy trong map dù đã kiểm tra trước đó, khi tạo role '{role_data_template['name']}'.")
                    all_perms_for_this_role_found = False
                    break # Dừng nếu có lỗi không mong muốn

            if not all_perms_for_this_role_found:
                logger.error(f"Hủy bỏ việc tạo role '{role_data_template['name']}' do thiếu permission ID.")
                continue # Bỏ qua role này

            role_to_create = RoleCreate(
                name=role_data_template["name"],
                description=role_data_template.get("description"),
                permission_ids=current_role_permission_ids
            )
            result = await roles_collection.insert_one(
                {
                    **role_to_create.model_dump(exclude_unset=True),
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
            )
            logger.info(f"Đã tạo role: {role_data_template['name']} với ID: {result.inserted_id}")
            created_role_ids[role_data_template['name']] = result.inserted_id
    else:
        async for role_doc in roles_collection.find({"name": {"$in": [r["name"] for r in default_roles_data_template]}}):
            created_role_ids[role_doc["name"]] = role_doc["_id"]
        logger.info(f"Collection 'roles' đã có dữ liệu. Tải {len(created_role_ids)} roles vào map.")

    return created_role_ids


async def seed_admin_user(db: AsyncIOMotorDatabase, role_ids_map: Optional[Dict[str, PyObjectId]]): # role_ids_map có thể là None
    if not role_ids_map: # Nếu map roles là None (do seeding roles bị hủy)
        logger.warning("role_ids_map không tồn tại. Bỏ qua việc tạo admin user.")
        return

    users_collection = db.get_collection("users")
    if ADMIN_EMAIL is None or ADMIN_PWD is None:
        logger.warning("ADMIN_EMAIL hoặc ADMIN_PWD không được cấu hình. Không thể tạo admin user.")
        return
    else:
        admin_email = ADMIN_EMAIL
        admin_password = ADMIN_PWD

    should_seed_admin = await users_collection.find_one({"email": admin_email}) is None

    if should_seed_admin:
        logger.info(f"Admin user '{admin_email}' chưa tồn tại. Bắt đầu seeding admin user...")
        admin_role_id = role_ids_map.get("admin")

        if not admin_role_id:
            logger.error("Không tìm thấy role 'admin'. Không thể tạo admin user.")
            return
        else:
            role_ids_for_admin = [admin_role_id]

        hashed_password = get_password_hash(admin_password)
        admin_user_data = UserCreate(
            email=admin_email,
            full_name="Administrator",
            phone_number="1234567890",
            password=admin_password,
            is_active=True,
            role_ids=role_ids_for_admin
        )
        user_document_to_insert = admin_user_data.model_dump(exclude={"password"})
        user_document_to_insert["hashed_password"] = hashed_password
        user_document_to_insert["created_at"] = datetime.now()
        user_document_to_insert["updated_at"] = datetime.now()

        result = await users_collection.insert_one(user_document_to_insert)
        logger.info(f"Đã tạo admin user: {admin_email} với ID: {result.inserted_id}")
    else:
        logger.info(f"Collection 'users' đã tồn tại '{admin_email}'.")


async def seed_initial_data(db: AsyncIOMotorDatabase):
    logger.info("Bắt đầu quá trình kiểm tra và khởi tạo dữ liệu ban đầu...")
    try:
        # 1. Seed Permissions (hoặc tải ID nếu đã có)
        permission_ids_map = await seed_permissions(db)

        # Kiểm tra xem tất cả các permission mặc định có trong map không
        # Điều này quan trọng để đảm bảo seed_roles có đủ dữ liệu
        loaded_default_perms_count = sum(1 for p_name in ALL_DEFAULT_PERMISSION_NAMES if p_name in permission_ids_map)
        if loaded_default_perms_count < len(ALL_DEFAULT_PERMISSION_NAMES):
            missing_from_map = ALL_DEFAULT_PERMISSION_NAMES - set(permission_ids_map.keys())
            logger.error(
                f"Không phải tất cả permissions mặc định đều được tải vào map ({loaded_default_perms_count}/{len(ALL_DEFAULT_PERMISSION_NAMES)}). "
                f"Các permissions bị thiếu: {missing_from_map}. "
                f"Huỷ bỏ việc seeding dữ liệu."
            )
            return

        # 2. Seed Roles (hoặc tải ID nếu đã có)
        # Hàm này giờ sẽ trả về None nếu không thể seed do thiếu permission
        role_ids_map = await seed_roles(db, permission_ids_map)

        if role_ids_map is None:
            logger.error("Quá trình seeding roles đã bị hủy do thiếu permissions. Seeding admin user cũng sẽ bị ảnh hưởng.")
            return
        elif "admin" not in role_ids_map:
            logger.warning("Role 'admin' không được seed hoặc không tìm thấy sau khi seed roles.")
            return

        # 3. Seed Admin User (nếu chưa có)
        await seed_admin_user(db, role_ids_map)

        logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu.")
    except Exception as e:
        logger.error(f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True)