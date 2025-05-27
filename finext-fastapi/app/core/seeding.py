# finext-fastapi/app/core/seeding.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set

from app.schemas.permissions import PermissionCreate
from app.schemas.roles import RoleCreate
from app.schemas.users import UserCreate, LicenseInfo
from app.schemas.features import FeatureCreate
from app.schemas.licenses import LicenseCreate
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
    {"name": "user:manage_licenses", "description": "Quyền gán/cập nhật license cho người dùng."},

    # Role Management
    {"name": "role:create", "description": "Quyền tạo vai trò mới."},
    {"name": "role:list", "description": "Quyền xem danh sách vai trò."},
    {"name": "role:read_any", "description": "Quyền xem chi tiết vai trò."},
    {"name": "role:update_any", "description": "Quyền cập nhật vai trò."},
    {"name": "role:delete_any", "description": "Quyền xóa vai trò."},

    # Session Management
    {"name": "session:list_self", "description": "Quyền xem danh sách các session đang hoạt động của chính mình."},
    {"name": "session:list_any", "description": "Quyền xem danh sách tất cả các session đang hoạt động của mọi người dùng (admin)."},
    {"name": "session:delete_self", "description": "Quyền tự xóa một session đang hoạt động của mình."},
    {"name": "session:delete_any", "description": "Quyền xóa bất kỳ session nào đang hoạt động (admin)."},

    # Feature & License Management (Admin only)
    {"name": "feature:manage", "description": "Quyền quản lý (CRUD) các features."},
    {"name": "license:manage", "description": "Quyền quản lý (CRUD) các licenses."},
]

ALL_DEFAULT_PERMISSION_NAMES: Set[str] = {p["name"] for p in DEFAULT_PERMISSIONS_DATA}

DEFAULT_FEATURES_DATA = [
    {"key": "view_basic_chart", "name": "Xem Biểu đồ Cơ bản", "description": "Xem biểu đồ giá cơ bản."},
    {"key": "view_advanced_chart", "name": "Xem Biểu đồ Nâng cao", "description": "Xem biểu đồ với các chỉ báo nâng cao."},
    {"key": "export_data", "name": "Xuất Dữ liệu", "description": "Cho phép xuất dữ liệu ra file CSV/Excel."},
    {"key": "enable_pro_indicator", "name": "Bật Chỉ báo Pro", "description": "Sử dụng các chỉ báo độc quyền."},
    {"key": "api_access", "name": "Truy cập API", "description": "Sử dụng API để lấy dữ liệu."},
    {"key": "sse_access", "name": "Truy cập SSE", "description": "Sử dụng SSE để nhận dữ liệu real-time."},
]
ALL_DEFAULT_FEATURE_KEYS: Set[str] = {f["key"] for f in DEFAULT_FEATURES_DATA}


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

    async for perm_doc in permissions_collection.find({"name": {"$in": list(ALL_DEFAULT_PERMISSION_NAMES)}}):
        if perm_doc["name"] in ALL_DEFAULT_PERMISSION_NAMES:
            created_permission_ids[perm_doc["name"]] = str(perm_doc["_id"])

    logger.info(f"Đã tải {len(created_permission_ids)} permissions mặc định vào map.")
    return created_permission_ids


async def seed_features(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    features_collection = db.get_collection("features")
    created_feature_ids: Dict[str, PyObjectId] = {} # Sẽ lưu feature_key -> feature_id

    existing_feature_keys: Set[str] = set()
    async for feature_doc in features_collection.find({}, {"key": 1}):
        existing_feature_keys.add(feature_doc["key"])

    features_to_add = [
        f for f in DEFAULT_FEATURES_DATA if f["key"] not in existing_feature_keys
    ]

    if features_to_add:
        logger.info(f"Tìm thấy {len(features_to_add)} features mới cần seed...")
        for feature_data in features_to_add:
            feature_to_create = FeatureCreate(**feature_data)
            dt_now = datetime.now(timezone.utc)
            result = await features_collection.insert_one(
                {
                    **feature_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now
                }
            )
            logger.info(f"Đã tạo feature: {feature_data['key']} với ID: {result.inserted_id}")
    else:
        logger.info("Không có features mới nào cần seed.")

    # Sau khi seed, lấy lại tất cả feature_ids và map chúng với key
    async for feature_doc in features_collection.find({"key": {"$in": list(ALL_DEFAULT_FEATURE_KEYS)}}):
         if feature_doc["key"] in ALL_DEFAULT_FEATURE_KEYS:
            created_feature_ids[feature_doc["key"]] = str(feature_doc["_id"])

    logger.info(f"Đã tải {len(created_feature_ids)} features mặc định (ID theo key) vào map.")
    return created_feature_ids


async def seed_roles(db: AsyncIOMotorDatabase, permission_ids_map: Dict[str, PyObjectId]) -> Optional[Dict[str, PyObjectId]]:
    roles_collection = db.get_collection("roles")
    created_role_ids: Dict[str, PyObjectId] = {}

    default_roles_data_template = [
        {
            "name": "admin",
            "description": "Quản trị viên hệ thống, có tất cả quyền.",
            "permission_names": list(ALL_DEFAULT_PERMISSION_NAMES) # Admin có tất cả quyền
        },
        {
            "name": "user",
            "description": "Người dùng thông thường.",
            "permission_names": [
                "user:update_self",
                "session:list_self",
                "session:delete_self"
            ]
        },
        {
            "name": "broker",
            "description": "Nhà môi giới.",
            "permission_names": [
                "user:update_self",
                "session:list_self",
                "session:delete_self",
                # Có thể thêm các quyền khác cho broker nếu cần
            ]
        },
    ]

    required_permission_names_for_default_roles: Set[str] = set()
    for role_template in default_roles_data_template:
        for perm_name in role_template.get("permission_names", []):
            required_permission_names_for_default_roles.add(perm_name)

    missing_permissions_for_roles: Set[str] = {
        perm_name for perm_name in required_permission_names_for_default_roles if perm_name not in permission_ids_map
    }

    if missing_permissions_for_roles:
        logger.error(
            f"Không thể seeding roles do thiếu các permissions cần thiết trong map: {missing_permissions_for_roles}."
        )

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

            role_specific_missing_perms = {
                p_name for p_name in role_data_template.get("permission_names", []) if p_name not in permission_ids_map
            }
            if role_specific_missing_perms:
                logger.warning(f"Skipping role '{role_data_template['name']}' due to missing permissions in map: {role_specific_missing_perms}")
                continue

            for perm_name in role_data_template.get("permission_names", []):
                perm_id_str = permission_ids_map.get(perm_name)
                current_role_permission_ids_str.append(perm_id_str) # type: ignore

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

    async for role_doc in roles_collection.find({"name": {"$in": [r["name"] for r in default_roles_data_template]}}):
        created_role_ids[role_doc["name"]] = str(role_doc["_id"])

    logger.info(f"Đã tải {len(created_role_ids)} roles mặc định (từ template) vào map.")

    if "admin" not in created_role_ids and not missing_permissions_for_roles:
        logger.error("Role 'admin' không được tạo hoặc không tải được vào map. Việc tạo admin user có thể thất bại.")

    return created_role_ids


async def seed_licenses(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    licenses_collection = db.get_collection("licenses")
    created_license_ids: Dict[str, PyObjectId] = {} # Lưu license_key -> license_id

    # Danh sách các feature keys, chúng ta sẽ dùng ALL_DEFAULT_FEATURE_KEYS đã định nghĩa ở trên
    # features_map = await seed_features(db) # Không cần gọi lại seed_features ở đây
                                             # nếu nó đã được gọi trước trong seed_initial_data

    default_licenses_data = [
        {
            "key": "free",
            "name": "Gói Miễn Phí",
            "price": 0.0,
            "duration_days": 99999, # Gói free thường không hết hạn hoặc thời hạn rất dài
            "feature_keys": ["view_basic_chart", "sse_access"] # Ví dụ: user free có thể xem chart cơ bản và sse
        },
        {
            "key": "admin_license", # License đặc biệt cho admin
            "name": "License Quản Trị Viên",
            "price": 0.0, # Admin không trả tiền
            "duration_days": 99999, # Vô thời hạn
            "feature_keys": list(ALL_DEFAULT_FEATURE_KEYS) # Admin có tất cả features
        },
        {
            "key": "broker_license", # License cho broker
            "name": "License Nhà Môi Giới",
            "price": 0.0, # Broker có thể không trả tiền trực tiếp cho license này
            "duration_days": 99999, # Vô thời hạn
            "feature_keys": [
                "view_basic_chart",
                "view_advanced_chart",
                "export_data",
                "sse_access"
                # Bỏ "enable_pro_indicator", "api_access" cho broker ví dụ
            ]
        },
        {
            "key": "pro", # Gói Pro thông thường cho user
            "name": "Gói Chuyên Nghiệp",
            "price": 99.0,
            "duration_days": 30,
            "feature_keys": ["view_advanced_chart", "export_data", "enable_pro_indicator", "sse_access"]
        },
        {
            "key": "premium", # Gói Premium cho user
            "name": "Gói Cao Cấp",
            "price": 199.0,
            "duration_days": 30,
            "feature_keys": ["view_advanced_chart", "export_data", "enable_pro_indicator", "api_access", "sse_access"]
        },
    ]

    existing_license_keys: Set[str] = set()
    async for lic_doc in licenses_collection.find({}, {"key": 1}):
        existing_license_keys.add(lic_doc["key"])

    licenses_to_add = [
        lic for lic in default_licenses_data if lic["key"] not in existing_license_keys
    ]

    if licenses_to_add:
        logger.info(f"Tìm thấy {len(licenses_to_add)} licenses mới cần seed...")
        for lic_data in licenses_to_add:
            all_keys_exist = True
            for f_key in lic_data["feature_keys"]:
                if not await db.features.find_one({"key": f_key}):
                    logger.warning(f"Feature key '{f_key}' cho license '{lic_data['key']}' không tồn tại trong DB. License này có thể không được tạo hoặc thiếu feature.")
                    all_keys_exist = False # Quyết định: có thể bỏ qua feature này hoặc không tạo license
                                            # Hiện tại: vẫn tạo license với các feature key có sẵn
            
            # Lọc lại feature_keys chỉ bao gồm những key thực sự tồn tại trong DEFAULT_FEATURES_DATA
            # Điều này đảm bảo tính nhất quán, mặc dù ở trên đã check với DB
            valid_feature_keys_for_license = [fk for fk in lic_data["feature_keys"] if fk in ALL_DEFAULT_FEATURE_KEYS]
            if len(valid_feature_keys_for_license) != len(lic_data["feature_keys"]):
                logger.warning(f"Một số feature_keys cho license '{lic_data['key']}' không có trong DEFAULT_FEATURES_DATA và sẽ bị bỏ qua.")


            license_to_create = LicenseCreate(
                key=lic_data["key"],
                name=lic_data["name"],
                price=lic_data["price"],
                duration_days=lic_data["duration_days"],
                feature_keys=valid_feature_keys_for_license # Sử dụng danh sách đã lọc
            )
            dt_now = datetime.now(timezone.utc)
            result = await licenses_collection.insert_one(
                {
                    **license_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now
                }
            )
            logger.info(f"Đã tạo license: {lic_data['key']} với ID: {result.inserted_id}")
    else:
        logger.info("Không có licenses mới nào cần seed.")

    async for lic_doc in licenses_collection.find({"key": {"$in": [l["key"] for l in default_licenses_data]}}):
        created_license_ids[lic_doc["key"]] = str(lic_doc["_id"])

    logger.info(f"Đã tải {len(created_license_ids)} licenses mặc định (ID theo key) vào map.")
    return created_license_ids


async def seed_users(db: AsyncIOMotorDatabase, role_ids_map: Optional[Dict[str, PyObjectId]], license_ids_map: Optional[Dict[str, PyObjectId]]):
    if not role_ids_map or not license_ids_map:
        logger.warning("role_ids_map hoặc license_ids_map không tồn tại. Bỏ qua việc tạo sample users.")
        return

    users_collection = db.get_collection("users")

    admin_role_id_str = role_ids_map.get("admin")
    broker_role_id_str = role_ids_map.get("broker")
    user_role_id_str = role_ids_map.get("user")

    admin_license_id_str = license_ids_map.get("admin_license")
    broker_license_id_str = license_ids_map.get("broker_license")
    free_license_id_str = license_ids_map.get("free")

    # Kiểm tra các ID cần thiết có tồn tại không
    if not all([admin_role_id_str, broker_role_id_str, user_role_id_str, 
                admin_license_id_str, broker_license_id_str, free_license_id_str]):
        logger.error(
            "Một hoặc nhiều role/license ID quan trọng ('admin', 'broker', 'user' roles; "
            "'admin_license', 'broker_license', 'free' licenses) không tìm thấy trong map. "
            "Việc tạo user mẫu có thể không đầy đủ hoặc thất bại."
        )
        # Quyết định có nên return sớm hay không. Hiện tại sẽ cố gắng tạo user với những gì có.

    now = datetime.now(timezone.utc)
    # Thời gian hết hạn "vô thời hạn" (một số ngày rất lớn)
    infinite_expiry_days = 99999
    infinite_expiry_date = now + timedelta(days=infinite_expiry_days)

    sample_users_data = []

    if ADMIN_EMAIL and ADMIN_PWD and admin_role_id_str and admin_license_id_str:
        sample_users_data.append({
            "email": ADMIN_EMAIL, "password": ADMIN_PWD, "full_name": "System Administrator",
            "phone_number": "0000000000",
            "role_ids": [admin_role_id_str],
            "license_info": LicenseInfo(active_license_id=admin_license_id_str, license_start_date=now, license_expiry_date=infinite_expiry_date),
            "is_active": True
        })

    if BROKER_EMAIL and ADMIN_PWD and broker_role_id_str and user_role_id_str and broker_license_id_str:
         sample_users_data.append({
            "email": BROKER_EMAIL, "password": ADMIN_PWD, "full_name": "Default Broker",
            "phone_number": "0111111111",
            "role_ids": [broker_role_id_str, user_role_id_str], # Broker cũng là user
            "license_info": LicenseInfo(active_license_id=broker_license_id_str, license_start_date=now, license_expiry_date=infinite_expiry_date),
            "is_active": True
        })

    if USER_EMAIL and ADMIN_PWD and user_role_id_str and free_license_id_str:
        sample_users_data.append({
            "email": USER_EMAIL, "password": ADMIN_PWD, "full_name": "Default User",
            "phone_number": "0999999999",
            "role_ids": [user_role_id_str],
            "license_info": LicenseInfo(active_license_id=free_license_id_str, license_start_date=now, license_expiry_date=infinite_expiry_date),
            "is_active": True
        })

    for user_data_dict in sample_users_data:
        existing_user = await users_collection.find_one({"email": user_data_dict["email"]})

        if existing_user is None:
            logger.info(f"User '{user_data_dict['email']}' chưa tồn tại. Bắt đầu tạo user...")

            valid_role_ids = [r_id for r_id in user_data_dict["role_ids"] if r_id is not None]
            
            current_license_info = user_data_dict.get("license_info")
            if not current_license_info or not current_license_info.active_license_id:
                logger.warning(f"User '{user_data_dict['email']}' không có active_license_id hợp lệ. Sẽ thử gán 'free' license nếu có.")
                default_free_lic_id = license_ids_map.get("free")
                if default_free_lic_id:
                    current_license_info = LicenseInfo(
                        active_license_id=default_free_lic_id,
                        license_start_date=now,
                        license_expiry_date=infinite_expiry_date
                    )
                else: # Không có free license thì để None
                    current_license_info = None
            
            user_create = UserCreate(
                email=user_data_dict["email"],
                full_name=user_data_dict["full_name"],
                phone_number=user_data_dict["phone_number"],
                password=user_data_dict["password"],
                is_active=user_data_dict["is_active"],
                role_ids=valid_role_ids,
                license_info=current_license_info # Gán license_info
            )

            user_document = user_create.model_dump(exclude={"password"})
            user_document["hashed_password"] = get_password_hash(user_create.password)
            user_document["created_at"] = user_create.created_at
            user_document["updated_at"] = user_create.updated_at
            if user_create.license_info:
                 user_document["license_info"] = user_create.license_info.model_dump()
            else:
                 user_document["license_info"] = None # Đảm bảo là null nếu không có

            result = await users_collection.insert_one(user_document)
            logger.info(f"Đã tạo user: {user_data_dict['email']} với ID: {result.inserted_id}")
        else:
            logger.info(f"User '{user_data_dict['email']}' đã tồn tại trong collection 'users'.")


async def seed_initial_data(db: AsyncIOMotorDatabase):
    logger.info("Bắt đầu quá trình kiểm tra và khởi tạo dữ liệu ban đầu...")
    try:
        permission_ids_map = await seed_permissions(db)
        # Đảm bảo features được seed trước licenses vì licenses tham chiếu đến feature_keys
        await seed_features(db)
        license_ids_map = await seed_licenses(db)
        role_ids_map = await seed_roles(db, permission_ids_map)
        # Cuối cùng là seed users, sau khi roles và licenses đã có
        await seed_users(db, role_ids_map, license_ids_map)
        logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu.")
    except Exception as e:
        logger.error(f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True)