import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from app.schemas.permissions import PermissionCreate
from app.schemas.roles import RoleCreate
from app.schemas.users import UserCreate
from app.utils.security import get_password_hash
from app.utils.types import PyObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from .config import ADMIN_EMAIL, ADMIN_PWD

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

ALL_DEFAULT_PERMISSION_NAMES: Set[str] = {p["name"] for p in DEFAULT_PERMISSIONS_DATA}

async def seed_permissions(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    permissions_collection = db.get_collection("permissions")
    created_permission_ids: Dict[str, PyObjectId] = {}
    
    # Đếm số lượng permission hiện có để quyết định có seed không
    count = await permissions_collection.count_documents({})
    should_seed_permissions = count == 0

    if should_seed_permissions:
        logger.info("Collection 'permissions' trống. Bắt đầu seeding permissions...")
        for perm_data in DEFAULT_PERMISSIONS_DATA:
            permission_to_create = PermissionCreate(**perm_data)
            dt_now = datetime.now(timezone.utc) # Sử dụng timezone aware datetime
            result = await permissions_collection.insert_one(
                {
                    **permission_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now
                }
            )
            logger.info(f"Đã tạo permission: {perm_data['name']} với ID: {result.inserted_id}")
            created_permission_ids[perm_data['name']] = str(result.inserted_id) # Chuyển ObjectId sang str
    else:
        logger.info(f"Collection 'permissions' đã có {count} dữ liệu. Tải permissions mặc định vào map...")
    
    # Luôn tải các ID của permission mặc định vào map, bất kể có seed hay không
    async for perm_doc in permissions_collection.find({"name": {"$in": list(ALL_DEFAULT_PERMISSION_NAMES)}}):
        if perm_doc["name"] in ALL_DEFAULT_PERMISSION_NAMES: # Đảm bảo chỉ lấy perm mặc định
            created_permission_ids[perm_doc["name"]] = str(perm_doc["_id"]) # str(ObjectId)
            
    logger.info(f"Đã tải {len(created_permission_ids)} permissions mặc định vào map.")
    return created_permission_ids


async def seed_roles(db: AsyncIOMotorDatabase, permission_ids_map: Dict[str, PyObjectId]) -> Optional[Dict[str, PyObjectId]]:
    roles_collection = db.get_collection("roles")
    created_role_ids: Dict[str, PyObjectId] = {}
    
    count = await roles_collection.count_documents({})
    should_seed_roles = count == 0

    default_roles_data_template = [ # Đổi tên để phân biệt
        {
            "name": "admin",
            "description": "Quản trị viên hệ thống, có tất cả quyền.",
            "permission_names": list(ALL_DEFAULT_PERMISSION_NAMES) # Admin có tất cả permission mặc định
        },
        {
            "name": "user",
            "description": "Người dùng thông thường.",
            "permission_names": ["user:read", "user:update"] # Ví dụ quyền cơ bản
        },
        {
            "name": "broker",
            "description": "Nhà môi giới.",
            "permission_names": ["user:read"] # Ví dụ
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
            f"Không thể seeding roles do thiếu các permissions cần thiết: {missing_permissions_for_roles}. "
            f"Hãy đảm bảo các permissions này được định nghĩa trong DEFAULT_PERMISSIONS_DATA và đã được seed hoặc tồn tại trong DB."
        )
        return None # Hủy bỏ việc seed roles

    if should_seed_roles:
        logger.info("Collection 'roles' trống và tất cả permissions cần thiết đã có. Bắt đầu seeding roles...")
        for role_data_template in default_roles_data_template:
            current_role_permission_ids_str: List[PyObjectId] = [] # List of string ObjectIds
            all_perms_for_this_role_found = True
            for perm_name in role_data_template.get("permission_names", []):
                perm_id_str = permission_ids_map.get(perm_name) # perm_id_str là string (PyObjectId)
                if perm_id_str:
                    current_role_permission_ids_str.append(perm_id_str)
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
                permission_ids=current_role_permission_ids_str # Đây là list các string ObjectId
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
            created_role_ids[role_data_template['name']] = str(result.inserted_id)
    else:
        logger.info(f"Collection 'roles' đã có {count} dữ liệu. Tải roles mặc định vào map.")

    # Luôn tải các ID của role mặc định vào map
    async for role_doc in roles_collection.find({"name": {"$in": [r["name"] for r in default_roles_data_template]}}):
        created_role_ids[role_doc["name"]] = str(role_doc["_id"]) # str(ObjectId)
        
    logger.info(f"Đã tải {len(created_role_ids)} roles mặc định vào map.")
    return created_role_ids


async def seed_admin_user(db: AsyncIOMotorDatabase, role_ids_map: Optional[Dict[str, PyObjectId]]): # role_ids_map có thể là None
    if not role_ids_map: # Nếu map roles là None (do seeding roles bị hủy)
        logger.warning("role_ids_map không tồn tại. Bỏ qua việc tạo admin user.")
        return

    users_collection = db.get_collection("users")
    if ADMIN_EMAIL is None or ADMIN_PWD is None:
        logger.warning("ADMIN_EMAIL hoặc ADMIN_PWD không được cấu hình. Không thể tạo admin user.")
        return
    
    admin_email = ADMIN_EMAIL
    admin_password = ADMIN_PWD

    should_seed_admin = await users_collection.find_one({"email": admin_email}) is None

    if should_seed_admin:
        logger.info(f"Admin user '{admin_email}' chưa tồn tại. Bắt đầu seeding admin user...")
        admin_role_id_str = role_ids_map.get("admin") # Đây là string ObjectId

        if not admin_role_id_str:
            logger.error("Không tìm thấy ID của role 'admin' (dưới dạng string). Không thể tạo admin user.")
            return
        
        # role_ids trong UserCreate là List[PyObjectId], tức List[str]
        role_ids_for_admin: List[PyObjectId] = [admin_role_id_str]

        # UserCreate yêu cầu password thuần, sẽ được hash bên trong user_crud.create_user
        # Tuy nhiên, ở đây chúng ta đang chèn trực tiếp, nên cần hash trước
        hashed_password = get_password_hash(admin_password)
        
        # Sử dụng UserCreate để validate dữ liệu, nhưng sau đó điều chỉnh cho phù hợp với DB
        # created_at và updated_at sẽ được UserCreate tự tạo với default_factory
        admin_user_data_validated = UserCreate(
            email=admin_email,
            full_name="Administrator",
            phone_number="0000000000", # Cung cấp giá trị hợp lệ
            password=admin_password, # Sẽ không được lưu trực tiếp
            is_active=True,
            role_ids=role_ids_for_admin, # List[str]
        )
        
        user_document_to_insert = admin_user_data_validated.model_dump(exclude={"password"})
        user_document_to_insert["hashed_password"] = hashed_password
        # Đảm bảo created_at và updated_at là datetime objects từ model
        user_document_to_insert["created_at"] = admin_user_data_validated.created_at
        user_document_to_insert["updated_at"] = admin_user_data_validated.updated_at


        result = await users_collection.insert_one(user_document_to_insert)
        logger.info(f"Đã tạo admin user: {admin_email} với ID: {result.inserted_id}")
    else:
        logger.info(f"Admin user '{admin_email}' đã tồn tại trong collection 'users'.")


async def seed_initial_data(db: AsyncIOMotorDatabase):
    logger.info("Bắt đầu quá trình kiểm tra và khởi tạo dữ liệu ban đầu...")
    try:
        permission_ids_map = await seed_permissions(db)
        
        # Kiểm tra lại các permissions cần thiết cho roles
        # (Copy logic kiểm tra từ seed_roles để đảm bảo an toàn)
        default_roles_data_template_check = [ 
            {"permission_names": list(ALL_DEFAULT_PERMISSION_NAMES)}, 
            {"permission_names": ["user:read", "user:update"]}, 
            {"permission_names": ["user:read"]}
        ]
        required_permission_names_for_default_roles_check: Set[str] = set()
        for role_template in default_roles_data_template_check:
            for perm_name in role_template.get("permission_names", []):
                required_permission_names_for_default_roles_check.add(perm_name)

        missing_perms_for_roles_check = {
            p_name for p_name in required_permission_names_for_default_roles_check if p_name not in permission_ids_map
        }

        if missing_perms_for_roles_check:
            logger.error(
                f"Không phải tất cả permissions mặc định cần cho roles đều được tải vào map. "
                f"Các permissions bị thiếu: {missing_perms_for_roles_check}. "
                f"Huỷ bỏ việc seeding roles và admin user."
            )
            return

        role_ids_map = await seed_roles(db, permission_ids_map)

        if role_ids_map is None:
            logger.error("Quá trình seeding roles đã bị hủy. Seeding admin user cũng sẽ bị hủy.")
            return
        elif "admin" not in role_ids_map: # Kiểm tra xem role admin có trong map không
            logger.error("Role 'admin' không được seed hoặc không tìm thấy sau khi seed roles. Không thể tạo admin user.")
            return

        await seed_admin_user(db, role_ids_map)

        logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu.")
    except Exception as e:
        logger.error(f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True)

