# finext-fastapi/app/core/seeding.py
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from app.schemas.permissions import PermissionCreate
from app.schemas.roles import RoleCreate
from app.schemas.users import UserCreate
from app.utils.security import get_password_hash
from app.utils.types import PyObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from .config import ADMIN_EMAIL, ADMIN_PWD, BROKER_EMAIL, USER_EMAIL


logger = logging.getLogger(__name__)

DEFAULT_PERMISSIONS_DATA = [
    # User Management
    {"name": "user:create", "description": "Quyền tạo người dùng mới (ví dụ: bởi admin)."},
    {"name": "user:list", "description": "Quyền xem danh sách tất cả người dùng."},
    {"name": "user:read_any", "description": "Quyền xem thông tin chi tiết của bất kỳ người dùng nào."},
    {"name": "user:update_self", "description": "Quyền tự cập nhật thông tin cá nhân của mình."},
    {"name": "user:update_any", "description": "Quyền cập nhật thông tin của bất kỳ người dùng nào (admin)."},
    {"name": "user:delete_any", "description": "Quyền xóa bất kỳ người dùng nào (admin)."},
    {"name": "user:manage_roles", "description": "Quyền gán/thu hồi vai trò cho người dùng."},

    # Role Management
    {"name": "role:create", "description": "Quyền tạo vai trò mới."},
    {"name": "role:list", "description": "Quyền xem danh sách vai trò."},
    {"name": "role:read_any", "description": "Quyền xem chi tiết vai trò."},
    {"name": "role:update_any", "description": "Quyền cập nhật vai trò."},
    {"name": "role:delete_any", "description": "Quyền xóa vai trò."},

    # Active Session Management
    # {"name": "session:list_own", "description": "Quyền xem các session đang hoạt động của chính mình."},
    # {"name": "session:list_any", "description": "Quyền xem các session đang hoạt động của người dùng bất kỳ (admin)."},
    # {"name": "session:delete_own", "description": "Quyền chấm dứt session của chính mình."},
    # {"name": "session:delete_any", "description": "Quyền chấm dứt session của người dùng bất kỳ (admin)."},
    # Tạm thời comment out session permissions nếu chưa có endpoint sử dụng
]

ALL_DEFAULT_PERMISSION_NAMES: Set[str] = {p["name"] for p in DEFAULT_PERMISSIONS_DATA}

async def seed_permissions(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    permissions_collection = db.get_collection("permissions")
    created_permission_ids: Dict[str, PyObjectId] = {}
    
    existing_permissions_names: Set[str] = set()
    async for perm_doc in permissions_collection.find({}, {"name": 1}):
        existing_permissions_names.add(perm_doc["name"])

    permissions_to_add = [
        p for p in DEFAULT_PERMISSIONS_DATA if p["name"] not in existing_permissions_names
    ]

    if permissions_to_add:
        logger.info(f"Tìm thấy {len(permissions_to_add)} permissions mới cần seed...")
        for perm_data in permissions_to_add:
            permission_to_create = PermissionCreate(**perm_data)
            dt_now = datetime.now(timezone.utc)
            result = await permissions_collection.insert_one(
                {
                    **permission_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now
                }
            )
            logger.info(f"Đã tạo permission: {perm_data['name']} với ID: {result.inserted_id}")
    else:
        logger.info("Không có permissions mới nào cần seed. Tất cả permissions trong DEFAULT_PERMISSIONS_DATA đã tồn tại.")

    # Luôn tải tất cả các ID của permission mặc định (kể cả đã tồn tại hoặc mới tạo) vào map
    async for perm_doc in permissions_collection.find({"name": {"$in": list(ALL_DEFAULT_PERMISSION_NAMES)}}):
        if perm_doc["name"] in ALL_DEFAULT_PERMISSION_NAMES:
            created_permission_ids[perm_doc["name"]] = str(perm_doc["_id"])
            
    logger.info(f"Đã tải {len(created_permission_ids)} permissions mặc định vào map.")
    return created_permission_ids


async def seed_roles(db: AsyncIOMotorDatabase, permission_ids_map: Dict[str, PyObjectId]) -> Optional[Dict[str, PyObjectId]]:
    roles_collection = db.get_collection("roles")
    created_role_ids: Dict[str, PyObjectId] = {}
    
    default_roles_data_template = [
        {
            "name": "admin",
            "description": "Quản trị viên hệ thống, có tất cả quyền.",
            "permission_names": [
                p_name for p_name in ALL_DEFAULT_PERMISSION_NAMES if p_name.startswith("user:") or p_name.startswith("role:")
            ]
        },
        {
            "name": "user",
            "description": "Người dùng thông thường.",
            "permission_names": ["user:update_self"] # Ví dụ: chỉ có quyền tự cập nhật
        },
        {
            "name": "broker",
            "description": "Nhà môi giới.",
            "permission_names": ["user:update_self"] # Ví dụ
        },
    ]

    # Kiểm tra xem tất cả permissions cần thiết cho các role mặc định có trong permission_ids_map không
    required_permission_names_for_default_roles: Set[str] = set()
    for role_template in default_roles_data_template:
        for perm_name in role_template.get("permission_names", []):
            required_permission_names_for_default_roles.add(perm_name)

    missing_permissions_for_roles: Set[str] = {
        perm_name for perm_name in required_permission_names_for_default_roles if perm_name not in permission_ids_map
    }

    if missing_permissions_for_roles:
        logger.error(
            f"Không thể seeding roles do thiếu các permissions cần thiết trong map: {missing_permissions_for_roles}. "
            f"Hãy đảm bảo các permissions này được định nghĩa trong DEFAULT_PERMISSIONS_DATA và đã được seed/tải thành công."
        )
        # Optionally, you might want to proceed with roles that CAN be created
        # For now, let's return None to indicate a problem
        # return None # Potentially problematic if admin role cannot be created

    # Seed roles if they don't exist
    existing_roles_names: Set[str] = set()
    async for role_doc in roles_collection.find({}, {"name": 1}):
        existing_roles_names.add(role_doc["name"])

    roles_to_seed_data = [
        role_data for role_data in default_roles_data_template
        if role_data["name"] not in existing_roles_names
    ]

    if roles_to_seed_data:
        logger.info(f"Bắt đầu seeding {len(roles_to_seed_data)} roles mới...")
        for role_data_template in roles_to_seed_data:
            current_role_permission_ids_str: List[PyObjectId] = []
            all_perms_for_this_role_found = True
            
            # Check if all permissions for *this specific role* are available in the map
            # This is a more granular check than the one above.
            role_specific_missing_perms = {
                p_name for p_name in role_data_template.get("permission_names", []) if p_name not in permission_ids_map
            }
            if role_specific_missing_perms:
                logger.warning(f"Skipping role '{role_data_template['name']}' due to missing permissions in map: {role_specific_missing_perms}")
                continue

            for perm_name in role_data_template.get("permission_names", []):
                perm_id_str = permission_ids_map.get(perm_name)
                if perm_id_str:
                    current_role_permission_ids_str.append(perm_id_str)
                else:
                    # This case should be caught by role_specific_missing_perms check already
                    logger.error(f"Lỗi logic: Permission '{perm_name}' không tìm thấy trong map khi tạo role '{role_data_template['name']}'.")
                    all_perms_for_this_role_found = False
                    break
            
            if not all_perms_for_this_role_found:
                logger.error(f"Hủy bỏ việc tạo role '{role_data_template['name']}' do thiếu permission ID.")
                continue

            role_to_create = RoleCreate(
                name=role_data_template["name"],
                description=role_data_template.get("description"),
                permission_ids=current_role_permission_ids_str
            )
            dt_now = datetime.now(timezone.utc)
            result = await roles_collection.insert_one(
                {
                    **role_to_create.model_dump(exclude_unset=True),
                    "created_at": dt_now,
                    "updated_at": dt_now
                }
            )
            logger.info(f"Đã tạo role: {role_data_template['name']} với ID: {result.inserted_id}")
    else:
        logger.info("Không có roles mới nào cần seed dựa trên template.")

    # Luôn tải các ID của role mặc định (theo template) vào map
    async for role_doc in roles_collection.find({"name": {"$in": [r["name"] for r in default_roles_data_template]}}):
        created_role_ids[role_doc["name"]] = str(role_doc["_id"])
        
    logger.info(f"Đã tải {len(created_role_ids)} roles mặc định (từ template) vào map.")
    
    if "admin" not in created_role_ids and not missing_permissions_for_roles: # If admin role was supposed to be created but failed for other reasons
        logger.error("Role 'admin' không được tạo hoặc không tải được vào map. Việc tạo admin user có thể thất bại.")
        # Consider returning None or raising an error if admin role is critical and missing
        
    return created_role_ids


async def seed_users(db: AsyncIOMotorDatabase, role_ids_map: Optional[Dict[str, PyObjectId]]):
    if not role_ids_map:
        logger.warning("role_ids_map không tồn tại (có thể do lỗi khi seed roles). Bỏ qua việc tạo sample users.")
        return

    users_collection = db.get_collection("users")
    
    # Kiểm tra xem các role cần thiết có tồn tại không
    admin_role_id_str = role_ids_map.get("admin")
    broker_role_id_str = role_ids_map.get("broker")
    user_role_id_str = role_ids_map.get("user")

    if not admin_role_id_str:
        logger.error("Không tìm thấy ID của role 'admin' trong map. Không thể tạo admin user.")
        return
    if not broker_role_id_str:
        logger.error("Không tìm thấy ID của role 'broker' trong map. Không thể tạo broker user.")
        return
    if not user_role_id_str:
        logger.error("Không tìm thấy ID của role 'user' trong map. Không thể tạo sample user.")
        return

    # Định nghĩa 3 tài khoản mẫu
    sample_users = [
        {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PWD,
            "full_name": "Administrator",
            "phone_number": "0000000000",
            "role_ids": [admin_role_id_str, broker_role_id_str, user_role_id_str],
            "is_active": True
        },
        {
            "email": BROKER_EMAIL,
            "password": ADMIN_PWD,
            "full_name": "Sample Broker",
            "phone_number": "0123456789",
            "role_ids": [broker_role_id_str, user_role_id_str],
            "is_active": True
        },
        {
            "email": USER_EMAIL,
            "password": ADMIN_PWD,
            "full_name": "Sample User",
            "phone_number": "0987654321",
            "role_ids": [user_role_id_str],
            "is_active": True
        }
    ]

    for user_data in sample_users:
        # Kiểm tra xem user đã tồn tại chưa
        existing_user = await users_collection.find_one({"email": user_data["email"]})
        
        if existing_user is None:
            logger.info(f"User '{user_data['email']}' chưa tồn tại. Bắt đầu tạo user...")
            
            # Hash password
            hashed_password = get_password_hash(user_data["password"])
            
            # Tạo UserCreate object
            user_create = UserCreate(
                email=user_data["email"],
                full_name=user_data["full_name"],
                phone_number=user_data["phone_number"],
                password=user_data["password"],
                is_active=user_data["is_active"],
                role_ids=user_data["role_ids"],
            )
            
            # Chuẩn bị document để insert
            user_document = user_create.model_dump(exclude={"password"})
            user_document["hashed_password"] = hashed_password
            user_document["created_at"] = user_create.created_at
            user_document["updated_at"] = user_create.updated_at

            result = await users_collection.insert_one(user_document)
            logger.info(f"Đã tạo user: {user_data['email']} với ID: {result.inserted_id}")
        else:
            logger.info(f"User '{user_data['email']}' đã tồn tại trong collection 'users'.")


async def seed_initial_data(db: AsyncIOMotorDatabase):
    logger.info("Bắt đầu quá trình kiểm tra và khởi tạo dữ liệu ban đầu...")
    try:
        permission_ids_map = await seed_permissions(db)
        
        # (Logic kiểm tra missing_perms_for_roles_check đã bị xóa để đơn giản hóa,
        #  vì seed_roles giờ đây xử lý việc bỏ qua role nếu thiếu perm cụ thể cho role đó)

        role_ids_map = await seed_roles(db, permission_ids_map)

        if role_ids_map is None: # Điều này xảy_ra nếu có lỗi nghiêm trọng trong seed_roles
            logger.error("Quá trình seeding roles đã bị hủy hoặc thất bại. Seeding users cũng sẽ bị hủy.")
            return
        elif "admin" not in role_ids_map:
            logger.error("Role 'admin' không được seed hoặc không tìm thấy sau khi seed roles. Không thể tạo admin user.")
            # Không return ở đây để cho phép ứng dụng vẫn chạy, nhưng admin có thể không hoạt động đúng.
            # Nếu admin là tối quan trọng, có thể return hoặc raise Exception.
            
        await seed_users(db, role_ids_map)

        logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu.")
    except Exception as e:
        logger.error(f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True)