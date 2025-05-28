# finext-fastapi/app/core/seeding.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set

from bson import ObjectId

from app.schemas.permissions import PermissionCreate
from app.schemas.users import (
    UserCreate,
)  # Bỏ LicenseInfo vì không dùng trực tiếp ở UserCreate nữa
from app.schemas.features import FeatureCreate
from app.schemas.licenses import LicenseCreate
from app.schemas.subscriptions import (
    SubscriptionBase,
)  # Dùng SubscriptionBase để tạo sub_doc
from app.utils.security import get_password_hash
from app.utils.types import PyObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from .config import ADMIN_EMAIL, ADMIN_PWD, BROKER_EMAIL, USER_EMAIL

logger = logging.getLogger(__name__)

DEFAULT_PERMISSIONS_DATA = [
    # User Management
    {
        "name": "user:create",
        "description": "Quyền tạo người dùng mới (ví dụ: bởi admin).",
    },
    {"name": "user:list", "description": "Quyền xem danh sách tất cả người dùng."},
    {
        "name": "user:read_any",
        "description": "Quyền xem thông tin chi tiết của bất kỳ người dùng nào.",
    },
    {
        "name": "user:update_self",
        "description": "Quyền tự cập nhật thông tin cá nhân của mình.",
    },
    {
        "name": "user:update_any",
        "description": "Quyền cập nhật thông tin của bất kỳ người dùng nào (admin).",
    },
    {
        "name": "user:delete_any",
        "description": "Quyền xóa bất kỳ người dùng nào (admin).",
    },
    {
        "name": "user:manage_roles",
        "description": "Quyền gán/thu hồi vai trò cho người dùng.",
    },
    # Role Management
    {"name": "role:create", "description": "Quyền tạo vai trò mới."},
    {"name": "role:list", "description": "Quyền xem danh sách vai trò."},
    {"name": "role:read_any", "description": "Quyền xem chi tiết vai trò."},
    {"name": "role:update_any", "description": "Quyền cập nhật vai trò."},
    {"name": "role:delete_any", "description": "Quyền xóa vai trò."},
    # Session Management
    {
        "name": "session:list_self",
        "description": "Quyền xem danh sách các session đang hoạt động của chính mình.",
    },
    {
        "name": "session:list_any",
        "description": "Quyền xem danh sách tất cả các session đang hoạt động của mọi người dùng (admin).",
    },
    {
        "name": "session:delete_self",
        "description": "Quyền tự xóa một session đang hoạt động của mình.",
    },
    {
        "name": "session:delete_any",
        "description": "Quyền xóa bất kỳ session nào đang hoạt động (admin).",
    },
    # Feature & License Management (Admin only)
    {"name": "feature:manage", "description": "Quyền quản lý (CRUD) các features."},
    {"name": "license:manage", "description": "Quyền quản lý (CRUD) các licenses."},
    # Subscription Management
    {"name": "subscription:create", "description": "Quyền tạo subscription mới."},
    {
        "name": "subscription:read_own",
        "description": "Quyền xem subscription của chính mình.",
    },
    {
        "name": "subscription:read_any",
        "description": "Quyền xem subscription của bất kỳ ai.",
    },
    {
        "name": "subscription:update_any",
        "description": "Quyền cập nhật subscription của bất kỳ ai.",
    },
    {
        "name": "subscription:deactivate_any",
        "description": "Quyền hủy kích hoạt subscription của bất kỳ ai.",
    },
        # Transaction Management
    {
        "name": "transaction:create_any", # Admin tạo cho user bất kỳ
        "description": "Quyền tạo giao dịch mới cho bất kỳ người dùng nào (admin).",
    },
    {
        "name": "transaction:create_own", # User tự tạo cho mình
        "description": "Quyền tự tạo đơn hàng/giao dịch mới cho chính mình.",
    },
    {
        "name": "transaction:read_any",
        "description": "Quyền xem tất cả giao dịch (admin).",
    },
    {
        "name": "transaction:update_details_any", 
        "description": "Quyền cập nhật chi tiết giao dịch đang chờ xử lý của bất kỳ ai (admin).",
    },
    {
        "name": "transaction:confirm_payment_any",
        "description": "Quyền xác nhận thanh toán thành công cho giao dịch của bất kỳ ai (admin).",
    },
    {
        "name": "transaction:cancel_any",
        "description": "Quyền hủy giao dịch của bất kỳ ai (admin).",
    },
    {
        "name": "transaction:read_own",
        "description": "Quyền xem lịch sử giao dịch của chính mình.",
    },
]

ALL_DEFAULT_PERMISSION_NAMES: Set[str] = {p["name"] for p in DEFAULT_PERMISSIONS_DATA}

DEFAULT_FEATURES_DATA = [
    {
        "key": "view_basic_chart",
        "name": "Xem Biểu đồ Cơ bản",
        "description": "Xem biểu đồ giá cơ bản.",
    },
    {
        "key": "view_advanced_chart",
        "name": "Xem Biểu đồ Nâng cao",
        "description": "Xem biểu đồ với các chỉ báo nâng cao.",
    },
    {
        "key": "export_data",
        "name": "Xuất Dữ liệu",
        "description": "Cho phép xuất dữ liệu ra file CSV/Excel.",
    },
    {
        "key": "enable_pro_indicator",
        "name": "Bật Chỉ báo Pro",
        "description": "Sử dụng các chỉ báo độc quyền.",
    },
    {
        "key": "api_access",
        "name": "Truy cập API",
        "description": "Sử dụng API để lấy dữ liệu.",
    },
    {
        "key": "sse_access",
        "name": "Truy cập SSE",
        "description": "Sử dụng SSE để nhận dữ liệu real-time.",
    },
]
ALL_DEFAULT_FEATURE_KEYS: Set[str] = {f["key"] for f in DEFAULT_FEATURES_DATA}


async def seed_permissions(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    permissions_collection = db.get_collection("permissions")
    created_permission_ids: Dict[str, PyObjectId] = {}  # name -> str(ObjectId)

    existing_permissions_names: Set[str] = set()
    async for perm_doc in permissions_collection.find({}, {"name": 1}):
        existing_permissions_names.add(perm_doc["name"])

    permissions_to_add = [
        p
        for p in DEFAULT_PERMISSIONS_DATA
        if p["name"] not in existing_permissions_names
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
                    "updated_at": dt_now,
                }
            )  # MongoDB sẽ tự tạo _id là ObjectId
            logger.info(
                f"Đã tạo permission: {perm_data['name']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có permissions mới nào cần seed.")

    async for perm_doc in permissions_collection.find(
        {"name": {"$in": list(ALL_DEFAULT_PERMISSION_NAMES)}}
    ):
        if perm_doc["name"] in ALL_DEFAULT_PERMISSION_NAMES:
            created_permission_ids[perm_doc["name"]] = str(
                perm_doc["_id"]
            )  # Lưu str(ObjectId)
    return created_permission_ids


async def seed_features(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    features_collection = db.get_collection("features")
    created_feature_ids: Dict[str, PyObjectId] = {}  # key -> str(ObjectId)

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
                    "updated_at": dt_now,
                }
            )
            logger.info(
                f"Đã tạo feature: {feature_data['key']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có features mới nào cần seed.")

    async for feature_doc in features_collection.find(
        {"key": {"$in": list(ALL_DEFAULT_FEATURE_KEYS)}}
    ):
        if feature_doc["key"] in ALL_DEFAULT_FEATURE_KEYS:
            created_feature_ids[feature_doc["key"]] = str(
                feature_doc["_id"]
            )  # Lưu str(ObjectId)
    return created_feature_ids


async def seed_roles(
    db: AsyncIOMotorDatabase, permission_ids_map: Dict[str, PyObjectId]
) -> Optional[Dict[str, PyObjectId]]:
    roles_collection = db.get_collection("roles")
    created_role_ids: Dict[str, PyObjectId] = {}  # name -> str(ObjectId)

    # ... (default_roles_data_template và logic kiểm tra missing_permissions_for_roles giữ nguyên)
    default_roles_data_template = [
        {
            "name": "admin",
            "description": "Quản trị viên hệ thống, có tất cả quyền.",
            "permission_names": list(ALL_DEFAULT_PERMISSION_NAMES),
        },
        {
            "name": "user",
            "description": "Người dùng thông thường.",
            "permission_names": [
                "user:update_self",
                "session:list_self",
                "session:delete_self",
                "subscription:read_own",
            ],
        },
        {
            "name": "broker",
            "description": "Nhà môi giới.",
            "permission_names": [
                "user:update_self",
                "session:list_self",
                "session:delete_self",
                "subscription:read_own",
            ],
        },
    ]

    required_permission_names_for_default_roles: Set[str] = set()
    for role_template in default_roles_data_template:
        for perm_name in role_template.get("permission_names", []):
            required_permission_names_for_default_roles.add(perm_name)

    missing_permissions_for_roles: Set[str] = {
        perm_name
        for perm_name in required_permission_names_for_default_roles
        if perm_name not in permission_ids_map
    }
    if missing_permissions_for_roles:
        logger.error(
            f"Không thể seeding roles do thiếu các permissions ID trong map: {missing_permissions_for_roles}."
        )

    existing_roles_names: Set[str] = set()
    async for role_doc in roles_collection.find({}, {"name": 1}):
        existing_roles_names.add(role_doc["name"])

    roles_to_seed_data = [
        role_data
        for role_data in default_roles_data_template
        if role_data["name"] not in existing_roles_names
    ]

    if roles_to_seed_data:
        logger.info(f"Bắt đầu seeding {len(roles_to_seed_data)} roles mới...")
        for role_data_template in roles_to_seed_data:
            # Chuyển permission_names thành List[ObjectId] để lưu vào DB
            current_role_permission_obj_ids: List[ObjectId] = []
            for perm_name in role_data_template.get("permission_names", []):
                perm_id_str = permission_ids_map.get(
                    perm_name
                )  # perm_id_str là str(ObjectId)
                if perm_id_str and ObjectId.is_valid(perm_id_str):
                    current_role_permission_obj_ids.append(ObjectId(perm_id_str))
                elif (
                    perm_id_str
                ):  # Có trong map nhưng không valid (ít xảy ra nếu map được tạo đúng)
                    logger.warning(
                        f"Permission ID '{perm_id_str}' (từ map cho '{perm_name}') không hợp lệ. Bỏ qua cho role '{role_data_template['name']}'."
                    )
                # Nếu không có trong map, đã log ở trên (missing_permissions_for_roles)

            # Dữ liệu để insert vào DB
            role_doc_to_insert = {
                "name": role_data_template["name"],
                "description": role_data_template.get("description"),
                "permission_ids": current_role_permission_obj_ids,  # Đây là List[ObjectId]
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            result = await roles_collection.insert_one(role_doc_to_insert)
            logger.info(
                f"Đã tạo role: {role_data_template['name']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có roles mới nào cần seed dựa trên template.")

    async for role_doc in roles_collection.find(
        {"name": {"$in": [r["name"] for r in default_roles_data_template]}}
    ):
        created_role_ids[role_doc["name"]] = str(role_doc["_id"])  # Lưu str(ObjectId)
    return created_role_ids


async def seed_licenses(db: AsyncIOMotorDatabase) -> Dict[str, PyObjectId]:
    # ... (Giữ nguyên như phiên bản đã sửa lỗi TypeError trước đó)
    licenses_collection = db.get_collection("licenses")
    created_license_ids: Dict[str, PyObjectId] = {}  # key -> str(ObjectId)

    default_licenses_data = [
        {
            "key": "free",
            "name": "Gói Miễn Phí",
            "price": 0.0,
            "duration_days": 99999,
            "feature_keys": ["view_basic_chart", "sse_access"],
        },
        {
            "key": "admin_license",
            "name": "License Quản Trị Viên",
            "price": 0.0,
            "duration_days": 99999,
            "feature_keys": list(ALL_DEFAULT_FEATURE_KEYS),
        },
        {
            "key": "broker_license",
            "name": "License Nhà Môi Giới",
            "price": 0.0,
            "duration_days": 99999,
            "feature_keys": [
                "view_basic_chart",
                "view_advanced_chart",
                "export_data",
                "sse_access",
            ],
        },
        {
            "key": "pro",
            "name": "Gói Chuyên Nghiệp",
            "price": 99.0,
            "duration_days": 30,
            "feature_keys": [
                "view_advanced_chart",
                "export_data",
                "enable_pro_indicator",
                "sse_access",
            ],
        },
        {
            "key": "premium",
            "name": "Gói Cao Cấp",
            "price": 199.0,
            "duration_days": 30,
            "feature_keys": [
                "view_advanced_chart",
                "export_data",
                "enable_pro_indicator",
                "api_access",
                "sse_access",
            ],
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
            valid_feature_keys_for_license = []
            for f_key in lic_data.get("feature_keys", []):
                feature_exists = await db.features.find_one({"key": f_key})
                if feature_exists:
                    valid_feature_keys_for_license.append(f_key)
                else:
                    logger.warning(
                        f"Feature key '{f_key}' cho license '{lic_data['key']}' không tồn tại trong DB. Bỏ qua."
                    )

            license_to_create = LicenseCreate(
                key=lic_data["key"],
                name=lic_data["name"],
                price=lic_data["price"],
                duration_days=lic_data["duration_days"],
                feature_keys=valid_feature_keys_for_license,
            )
            dt_now = datetime.now(timezone.utc)
            result = await licenses_collection.insert_one(
                {
                    **license_to_create.model_dump(),
                    "created_at": dt_now,
                    "updated_at": dt_now,
                }
            )
            logger.info(
                f"Đã tạo license: {lic_data['key']} với ID: {result.inserted_id}"
            )
    else:
        logger.info("Không có licenses mới nào cần seed.")

    async for lic_doc in licenses_collection.find(
        {"key": {"$in": [d["key"] for d in default_licenses_data]}}
    ):
        created_license_ids[lic_doc["key"]] = str(lic_doc["_id"])  # Lưu str(ObjectId)
    return created_license_ids


async def seed_users(
    db: AsyncIOMotorDatabase, role_ids_map: Optional[Dict[str, PyObjectId]]
) -> Dict[str, PyObjectId]:
    created_user_ids: Dict[str, PyObjectId] = {}  # email -> str(ObjectId)
    if not role_ids_map:
        logger.warning("role_ids_map không tồn tại. Bỏ qua việc tạo sample users.")
        return created_user_ids

    users_collection = db.get_collection("users")

    admin_role_id_str = role_ids_map.get("admin")
    broker_role_id_str = role_ids_map.get("broker")
    user_role_id_str = role_ids_map.get("user")

    sample_users_data_dicts = []
    # ... (Giữ nguyên logic tạo sample_users_data_dicts)
    if ADMIN_EMAIL and ADMIN_PWD and admin_role_id_str:
        sample_users_data_dicts.append(
            {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PWD,
                "full_name": "System Administrator",
                "phone_number": "0000000000",
                "role_ids_str": [admin_role_id_str, broker_role_id_str, user_role_id_str],
                "is_active": True,  # Đổi tên thành role_ids_str
            }
        )
    if BROKER_EMAIL and ADMIN_PWD and broker_role_id_str and user_role_id_str:
        sample_users_data_dicts.append(
            {
                "email": BROKER_EMAIL,
                "password": ADMIN_PWD,
                "full_name": "Default Broker",
                "phone_number": "0111111111",
                "role_ids_str": [broker_role_id_str, user_role_id_str],
                "is_active": True,
            }
        )
    if USER_EMAIL and ADMIN_PWD and user_role_id_str:
        sample_users_data_dicts.append(
            {
                "email": USER_EMAIL,
                "password": ADMIN_PWD,
                "full_name": "Default User",
                "phone_number": "0999999999",
                "role_ids_str": [user_role_id_str],
                "is_active": True,
            }
        )

    for user_data_dict in sample_users_data_dicts:
        existing_user = await users_collection.find_one(
            {"email": user_data_dict["email"]}
        )
        if existing_user is None:
            # UserCreate mong đợi role_ids là List[PyObjectId] (List[str])
            user_create_instance = UserCreate(
                email=user_data_dict["email"],
                full_name=user_data_dict["full_name"],
                phone_number=user_data_dict["phone_number"],
                password=user_data_dict["password"],
                is_active=user_data_dict["is_active"],
                role_ids=user_data_dict["role_ids_str"],  # Truyền List[str]
                subscription_id=None,
            )

            user_document_for_db = user_create_instance.model_dump(
                exclude={"password", "role_ids"}
            )
            user_document_for_db["hashed_password"] = get_password_hash(
                user_create_instance.password
            )

            # Chuyển đổi role_ids_str thành List[ObjectId] để lưu vào DB
            role_obj_ids_for_db = []
            for r_id_str in (
                user_create_instance.role_ids
            ):  # user_create_instance.role_ids là List[str]
                if ObjectId.is_valid(r_id_str):
                    role_obj_ids_for_db.append(ObjectId(r_id_str))
            user_document_for_db["role_ids"] = role_obj_ids_for_db  # Lưu List[ObjectId]

            result = await users_collection.insert_one(user_document_for_db)
            logger.info(
                f"Đã tạo user: {user_data_dict['email']} với ID: {result.inserted_id}"
            )
            created_user_ids[user_data_dict["email"]] = str(result.inserted_id)
        else:
            logger.info(f"User '{user_data_dict['email']}' đã tồn tại.")
            created_user_ids[user_data_dict["email"]] = str(existing_user["_id"])
    return created_user_ids


async def seed_subscriptions(
    db: AsyncIOMotorDatabase,
    user_ids_map: Dict[str, PyObjectId],
    license_ids_map: Dict[str, PyObjectId],
):
    # ... (Giữ nguyên như phiên bản trước đó, vì nó đã lưu user_id và license_id là ObjectId)
    subscriptions_collection = db.get_collection("subscriptions")
    users_collection = db.get_collection("users")
    licenses_collection = db.get_collection("licenses")

    subs_to_create_map = {
        ADMIN_EMAIL: "admin_license",
        BROKER_EMAIL: "broker_license",
        USER_EMAIL: "free",
    }
    now = datetime.now(timezone.utc)

    for email, license_key in subs_to_create_map.items():
        if not email:
            continue

        user_id_str = user_ids_map.get(email)  # email -> str(ObjectId)
        license_id_str_from_map = license_ids_map.get(
            license_key
        )  # key -> str(ObjectId)

        if not user_id_str or not license_id_str_from_map:
            logger.warning(
                f"Bỏ qua seeding subscription cho {email} do thiếu User ID (str: {user_id_str}) hoặc License ID (str: {license_id_str_from_map})."
            )
            continue

        license_doc = await licenses_collection.find_one(
            {"_id": ObjectId(license_id_str_from_map)}
        )
        if not license_doc:
            logger.warning(
                f"License document for ID {license_id_str_from_map} (key: {license_key}) not found. Skipping subscription for {email}."
            )
            continue

        user_obj_id_for_sub = ObjectId(user_id_str)
        license_obj_id_for_sub = ObjectId(license_id_str_from_map)

        user_current_doc = await users_collection.find_one({"_id": user_obj_id_for_sub})
        if not user_current_doc:
            logger.warning(
                f"User document for ID {user_id_str} not found. Skipping subscription seeding for {email}."
            )
            continue

        create_new_sub = True
        if user_current_doc.get("subscription_id"):
            current_sub_id_in_user = user_current_doc.get(
                "subscription_id"
            )  # Đây là ObjectId
            if current_sub_id_in_user:  # Kiểm tra không phải None
                active_sub_check = await subscriptions_collection.find_one(
                    {
                        "_id": current_sub_id_in_user,  # So sánh ObjectId
                        "is_active": True,
                        "expiry_date": {"$gt": now},
                    }
                )
                if active_sub_check:
                    logger.info(
                        f"User {email} đã có active subscription ({str(current_sub_id_in_user)}). Bỏ qua seeding."
                    )
                    create_new_sub = False

        if create_new_sub:
            logger.info(f"Seeding subscription '{license_key}' cho user '{email}'...")
            duration_days = license_doc.get("duration_days", 99999)
            expiry_date = now + timedelta(days=duration_days)

            sub_base_payload = SubscriptionBase(
                user_id=user_id_str,  # Cho Pydantic là str
                user_email=email,
                license_id=license_id_str_from_map,  # Cho Pydantic là str
                license_key=license_key,
                is_active=True,
                start_date=now,
                expiry_date=expiry_date,
            )
            sub_doc_to_insert = {
                **sub_base_payload.model_dump(),
                "created_at": now,
                "updated_at": now,
            }
            sub_doc_to_insert["user_id"] = user_obj_id_for_sub  # Lưu ObjectId
            sub_doc_to_insert["license_id"] = license_obj_id_for_sub  # Lưu ObjectId

            try:
                result = await subscriptions_collection.insert_one(sub_doc_to_insert)
                if result.inserted_id:
                    await users_collection.update_one(
                        {"_id": user_obj_id_for_sub},
                        {
                            "$set": {
                                "subscription_id": result.inserted_id,
                                "updated_at": now,
                            }
                        },  # result.inserted_id là ObjectId
                    )
                    logger.info(
                        f"Đã tạo subscription ID {result.inserted_id} và cập nhật cho user {email}."
                    )
                else:
                    logger.error(f"Không thể tạo subscription cho {email}.")
            except Exception as e_insert_sub:
                logger.error(
                    f"Lỗi khi insert subscription cho {email}: {e_insert_sub}",
                    exc_info=True,
                )


async def seed_initial_data(db: AsyncIOMotorDatabase):
    logger.info("Bắt đầu quá trình kiểm tra và khởi tạo dữ liệu ban đầu...")
    try:
        permission_ids_map = await seed_permissions(db)
        await seed_features(db)
        license_ids_map = await seed_licenses(db)
        role_ids_map = await seed_roles(db, permission_ids_map)
        user_ids_map = await seed_users(db, role_ids_map)
        await seed_subscriptions(db, user_ids_map, license_ids_map)

        logger.info("Hoàn tất quá trình kiểm tra và khởi tạo dữ liệu ban đầu.")
    except Exception as e:
        logger.error(
            f"Lỗi nghiêm trọng trong quá trình khởi tạo dữ liệu: {e}", exc_info=True
        )
