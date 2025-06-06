# finext-fastapi/app/crud/users.py
import logging
from typing import Optional, List, Tuple # Thêm Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.users import UserCreate, UserInDB, GoogleUserSchema # Thêm UserUpdate nếu có
from app.utils.security import get_password_hash
from datetime import datetime, timezone
from app.utils.types import PyObjectId
import app.crud.brokers as crud_brokers
import app.crud.subscriptions as crud_subscriptions 
import secrets
import string

logger = logging.getLogger(__name__)
USERS_COLLECTION = "users" # Định nghĩa tên collection


def generate_random_strong_password(length: int = 16) -> str:
    """Tạo mật khẩu ngẫu nhiên mạnh."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    while True:
        password = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in password)
                and any(c.isupper() for c in password)
                and any(c.isdigit() for c in password)
                and any(c in string.punctuation for c in password)):
            break
    return password

async def get_user_by_google_id_db(db: AsyncIOMotorDatabase, google_id: str) -> Optional[UserInDB]:
    user_doc = await db[USERS_COLLECTION].find_one({"google_id": google_id})
    if user_doc:
        # Helper to convert ObjectIds to str for Pydantic
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"] and isinstance(user_doc["subscription_id"], ObjectId):
            user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def get_user_by_email_db(db: AsyncIOMotorDatabase, email: str) -> Optional[UserInDB]:
    user_doc = await db[USERS_COLLECTION].find_one({"email": email})
    if user_doc:
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"] and isinstance(user_doc["subscription_id"], ObjectId):
            user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def get_user_by_id_db(db: AsyncIOMotorDatabase, user_id: str) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id):
        return None
    user_doc = await db[USERS_COLLECTION].find_one({"_id": ObjectId(user_id)})
    if user_doc:
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"] and isinstance(user_doc["subscription_id"], ObjectId):
            user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def create_user_db(
    db: AsyncIOMotorDatabase,
    user_create_data: UserCreate,
    set_active_on_create: bool = False
) -> Optional[UserInDB]:
    existing_user = await get_user_by_email_db(db, email=user_create_data.email)
    if existing_user:
        if existing_user.is_active:
            logger.warning(f"Email {user_create_data.email} đã tồn tại và đã được kích hoạt.")
            raise ValueError(f"Email '{user_create_data.email}' đã được đăng ký và kích hoạt.")
        else:
            logger.warning(f"Email {user_create_data.email} đã tồn tại nhưng chưa kích hoạt. Cân nhắc cho phép xác thực lại.")
            raise ValueError(f"Email '{user_create_data.email}' đã được đăng ký nhưng chưa kích hoạt. Vui lòng kiểm tra email để xác thực hoặc liên hệ hỗ trợ.")

    if user_create_data.password is None: # Mật khẩu có thể None nếu tạo qua Google, nhưng hàm này dùng cho tạo truyền thống
        raise ValueError("Mật khẩu là bắt buộc khi tạo người dùng theo cách này.")
    hashed_password = get_password_hash(user_create_data.password)

    user_document_to_insert = user_create_data.model_dump(exclude={"password"})
    user_document_to_insert["hashed_password"] = hashed_password
    user_document_to_insert["is_active"] = set_active_on_create # Sẽ là False nếu cần OTP
    user_document_to_insert["created_at"] = datetime.now(timezone.utc)
    user_document_to_insert["updated_at"] = datetime.now(timezone.utc)
    user_document_to_insert["subscription_id"] = None 
    user_document_to_insert["google_id"] = user_create_data.google_id # Thêm google_id nếu có từ UserCreate

    if user_create_data.referral_code:
        is_valid_ref_code = await crud_brokers.is_broker_code_valid_and_active(db, user_create_data.referral_code)
        if is_valid_ref_code:
            user_document_to_insert["referral_code"] = user_create_data.referral_code.upper()
        else:
            logger.warning(f"Mã giới thiệu '{user_create_data.referral_code}' không hợp lệ. User '{user_create_data.email}' sẽ được tạo không có mã giới thiệu.")
            user_document_to_insert["referral_code"] = None # Hoặc raise ValueError
    else:
        user_document_to_insert["referral_code"] = None

    role_object_ids = []
    user_role_doc = await db.roles.find_one({"name": "user"})
    if user_role_doc and "_id" in user_role_doc:
        role_object_ids.append(user_role_doc["_id"])
    else:
        logger.error("QUAN TRỌNG: Không tìm thấy vai trò 'user' mặc định trong database. User mới sẽ không có vai trò nào được gán.")
        raise Exception("Lỗi hệ thống: Không tìm thấy vai trò 'user' mặc định.")
    user_document_to_insert["role_ids"] = role_object_ids

    try:
        insert_result = await db[USERS_COLLECTION].insert_one(user_document_to_insert)
        if insert_result.inserted_id:
            await crud_subscriptions.assign_free_subscription_if_needed(db, insert_result.inserted_id)
            created_user_doc_after_sub = await db[USERS_COLLECTION].find_one({"_id": insert_result.inserted_id}) # Re-fetch
            if not created_user_doc_after_sub : 
                logger.error(f"Failed to re-fetch user {insert_result.inserted_id} after attempting to assign FREE sub.")
                created_user_doc_after_sub = user_document_to_insert # Fallback
                created_user_doc_after_sub["_id"] = insert_result.inserted_id # Ensure _id is present

            return await get_user_by_id_db(db, str(insert_result.inserted_id)) # Use existing helper for conversion
        logger.error(f"Không thể tạo người dùng với email: {user_create_data.email}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo người dùng {user_create_data.email}: {e}", exc_info=True)
        return None


async def get_or_create_user_from_google_sub_email(db: AsyncIOMotorDatabase, google_user_data: GoogleUserSchema) -> Optional[UserInDB]:
    user_by_google_id = await get_user_by_google_id_db(db, google_id=google_user_data.id)
    if user_by_google_id:
        logger.info(f"Tìm thấy user bằng Google ID: {google_user_data.id} cho email {google_user_data.email}. Đăng nhập lại.")
        if google_user_data.verified_email and not user_by_google_id.is_active:
            await db[USERS_COLLECTION].update_one(
                {"_id": ObjectId(user_by_google_id.id)},
                {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"Kích hoạt user {user_by_google_id.email} dựa trên Google email_verified.")
            return await get_user_by_id_db(db, str(user_by_google_id.id))
        return user_by_google_id

    user_by_email = await get_user_by_email_db(db, email=google_user_data.email)

    if user_by_email:
        if user_by_email.google_id:
            if user_by_email.google_id == google_user_data.id:
                logger.info(f"User với email {google_user_data.email} đã có google_id khớp. Đăng nhập lại.")
                return user_by_email
            else:
                logger.error(
                    f"Email {google_user_data.email} đã được liên kết với một tài khoản Google khác (DB Google ID: {user_by_email.google_id}, Request Google ID: {google_user_data.id}). "
                )
                raise ValueError(
                    f"Email {google_user_data.email} đã được sử dụng với một tài khoản Google khác. "
                    "Vui lòng đăng nhập bằng tài khoản Google đã liên kết trước đó hoặc sử dụng email khác."
                )
        else: # User tồn tại với email này nhưng chưa có google_id
            if not google_user_data.verified_email:
                logger.warning(
                    f"Email {google_user_data.email} tồn tại trong Finext nhưng email từ Google chưa được xác thực. Không thể tự động liên kết."
                )
                raise ValueError(
                    "Email của bạn từ Google chưa được xác thực. Vui lòng xác thực email với Google trước khi liên kết."
                )

            logger.info(f"Email {google_user_data.email} tồn tại, google_id trống. Tiến hành liên kết với Google ID: {google_user_data.id}")
            update_fields = {
                "google_id": google_user_data.id,
                "updated_at": datetime.now(timezone.utc)
            }
            if not user_by_email.is_active: # Kích hoạt user nếu chưa active
                update_fields["is_active"] = True
                logger.info(f"Kích hoạt user {user_by_email.email} trong quá trình liên kết tài khoản Google.")

            if google_user_data.picture and (not user_by_email.avatar_url or user_by_email.avatar_url != google_user_data.picture):
                update_fields["avatar_url"] = google_user_data.picture

            await db[USERS_COLLECTION].update_one({"_id": ObjectId(user_by_email.id)}, {"$set": update_fields})
            return await get_user_by_id_db(db, str(user_by_email.id))
    else: # Tạo user mới hoàn toàn từ thông tin Google
        if not google_user_data.verified_email:
            logger.warning(
                f"Email {google_user_data.email} là mới nhưng chưa được xác thực bởi Google. Không tạo tài khoản."
            )
            raise ValueError("Email của bạn từ Google chưa được xác thực. Không thể tạo tài khoản Finext.")

        logger.info(f"Tạo tài khoản Finext mới cho người dùng Google: {google_user_data.email} với Google ID: {google_user_data.id}")
        random_password = generate_random_strong_password() # User sẽ không biết mật khẩu này
        hashed_password = get_password_hash(random_password)

        new_user_data = {
            "full_name": google_user_data.name or google_user_data.email.split('@')[0],
            "email": google_user_data.email,
            "phone_number": None, # Google không cung cấp phone number qua id_token
            "hashed_password": hashed_password,
            "is_active": True, # Kích hoạt ngay vì email Google đã verified
            "google_id": google_user_data.id,
            "avatar_url": google_user_data.picture,
            "referral_code": None, 
            "subscription_id": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        role_object_ids = []
        user_role_doc = await db.roles.find_one({"name": "user"})
        if user_role_doc and "_id" in user_role_doc:
            role_object_ids.append(user_role_doc["_id"])
        else:
            logger.error("QUAN TRỌNG: Không tìm thấy vai trò 'user' mặc định khi tạo user qua Google.")
            raise Exception("Lỗi hệ thống: Vai trò 'user' mặc định không được cấu hình.")
        new_user_data["role_ids"] = role_object_ids

        try:
            result = await db[USERS_COLLECTION].insert_one(new_user_data)
            if result.inserted_id:
                await crud_subscriptions.assign_free_subscription_if_needed(db, result.inserted_id)
                return await get_user_by_id_db(db, str(result.inserted_id))
            logger.error(f"Không thể tạo người dùng mới từ Google cho email: {google_user_data.email} sau khi insert.")
            return None
        except Exception as e:
            logger.error(f"Lỗi khi insert người dùng mới từ Google cho {google_user_data.email}: {e}", exc_info=True)
            return None


async def set_user_avatar(db: AsyncIOMotorDatabase, user_id: PyObjectId, avatar_url: Optional[str]) -> bool:
    if not ObjectId.is_valid(user_id):
        logger.error(f"Invalid user_id format for updating avatar: {user_id}")
        return False

    user_obj_id = ObjectId(user_id)
    update_result = await db[USERS_COLLECTION].update_one(
        {"_id": user_obj_id},
        {"$set": {"avatar_url": avatar_url, "updated_at": datetime.now(timezone.utc)}}
    )
    if update_result.modified_count > 0:
        logger.info(f"Avatar updated for user {user_id}. New URL: {avatar_url}")
        return True
    elif update_result.matched_count > 0 and update_result.modified_count == 0:
        logger.info(f"Avatar URL for user {user_id} is already '{avatar_url}'. No update needed.")
        return True

    logger.warning(f"Failed to update avatar for user {user_id} or user not found.")
    return False

async def assign_roles_to_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId, role_ids_to_assign_str: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"User ID không hợp lệ khi gán role: {user_id_str}")
        return None

    user_obj_id = ObjectId(user_id_str)
    user = await db[USERS_COLLECTION].find_one({"_id": user_obj_id})
    if not user:
        logger.error(f"User với ID {user_id_str} không tìm thấy để gán role.")
        return None

    current_role_obj_ids_set = set(user.get("role_ids", []))
    valid_role_obj_ids_to_add: List[ObjectId] = []
    if role_ids_to_assign_str:
        for r_id_str in role_ids_to_assign_str:
            if ObjectId.is_valid(r_id_str):
                role_obj_id_to_add = ObjectId(r_id_str)
                role_exists = await db.roles.find_one({"_id": role_obj_id_to_add})
                if role_exists:
                    valid_role_obj_ids_to_add.append(role_obj_id_to_add)
                else:
                    logger.warning(f"Role ID '{r_id_str}' không tồn tại. Bỏ qua khi gán role cho user.")
            else:
                logger.warning(f"Định dạng ObjectId không hợp lệ cho Role ID '{r_id_str}'. Bỏ qua.")

    if not valid_role_obj_ids_to_add and role_ids_to_assign_str: # Nếu có gửi role_ids nhưng không có cái nào hợp lệ
        raise ValueError("Không có vai trò hợp lệ nào được cung cấp để gán hoặc tất cả vai trò cung cấp không tồn tại.")


    for role_obj_id in valid_role_obj_ids_to_add:
        current_role_obj_ids_set.add(role_obj_id)

    updated_role_obj_ids_list = list(current_role_obj_ids_set)
    await db[USERS_COLLECTION].update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": updated_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)

async def revoke_roles_from_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId, role_ids_to_revoke_str: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"User ID không hợp lệ khi thu hồi role: {user_id_str}")
        return None

    user_obj_id = ObjectId(user_id_str)
    user = await db[USERS_COLLECTION].find_one({"_id": user_obj_id})
    if not user:
        logger.error(f"User với ID {user_id_str} không tìm thấy để thu hồi role.")
        return None

    current_role_obj_ids_set = set(user.get("role_ids", []))
    role_obj_ids_to_revoke_set = set()
    if role_ids_to_revoke_str:
        for r_id_str in role_ids_to_revoke_str:
            if ObjectId.is_valid(r_id_str):
                role_obj_ids_to_revoke_set.add(ObjectId(r_id_str))
            else:
                logger.warning(f"Định dạng ObjectId không hợp lệ cho Role ID '{r_id_str}' cần thu hồi. Bỏ qua.")

    remaining_role_obj_ids_list = list(current_role_obj_ids_set - role_obj_ids_to_revoke_set)
    await db[USERS_COLLECTION].update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": remaining_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)

async def update_user_password(db: AsyncIOMotorDatabase, user_id: PyObjectId, new_password: str) -> bool:
    user_doc = await get_user_by_id_db(db, user_id=str(user_id)) # get_user_by_id_db đã handle str conversion
    if not user_doc:
        logger.error(f"Không tìm thấy user với ID {user_id} để cập nhật mật khẩu.")
        return False
    if not user_doc.is_active:
        logger.warning(f"Tài khoản {user_doc.email} không hoạt động, không cho phép đổi mật khẩu.")
        return False # Hoặc raise ValueError

    new_hashed_password = get_password_hash(new_password)
    update_result = await db[USERS_COLLECTION].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"hashed_password": new_hashed_password, "updated_at": datetime.now(timezone.utc)}}
    )
    return update_result.modified_count > 0

async def update_user_db( # Hàm này được gọi từ router users.py, user_id_to_update_str là PyObjectId (str)
    db: AsyncIOMotorDatabase,
    user_id_to_update_str: PyObjectId, 
    user_update_data: dict # Dữ liệu đã được model_dump(exclude_unset=True) từ UserUpdate
) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_to_update_str):
        logger.error(f"User ID không hợp lệ để cập nhật: {user_id_to_update_str}")
        return None

    user_obj_id = ObjectId(user_id_to_update_str)

    # Kiểm tra xem email mới (nếu có) có bị trùng không
    if "email" in user_update_data:
        new_email = user_update_data["email"]
        existing_user_with_new_email = await db[USERS_COLLECTION].find_one(
            {"email": new_email, "_id": {"$ne": user_obj_id}}
        )
        if existing_user_with_new_email:
            raise ValueError(f"Email '{new_email}' đã được sử dụng bởi người dùng khác.")

    # Kiểm tra referral_code mới (nếu có)
    if "referral_code" in user_update_data:
        new_ref_code = user_update_data["referral_code"]
        if new_ref_code is not None and new_ref_code != "":
            is_valid_ref = await crud_brokers.is_broker_code_valid_and_active(db, new_ref_code)
            if not is_valid_ref:
                raise ValueError(f"Mã giới thiệu '{new_ref_code}' không hợp lệ hoặc không hoạt động.")
            user_update_data["referral_code"] = new_ref_code.upper()
        elif new_ref_code == "" or new_ref_code is None: # Cho phép xóa referral code
            user_update_data["referral_code"] = None


    if not user_update_data: # Nếu không có gì để cập nhật
        return await get_user_by_id_db(db, user_id_to_update_str)

    user_update_data["updated_at"] = datetime.now(timezone.utc)

    update_result = await db[USERS_COLLECTION].update_one(
        {"_id": user_obj_id},
        {"$set": user_update_data}
    )

    if update_result.matched_count > 0:
        return await get_user_by_id_db(db, user_id_to_update_str) # Trả về user đã cập nhật
    
    # Nếu không matched_count (user_id không tồn tại)
    logger.warning(f"Không tìm thấy user với ID {user_id_to_update_str} để cập nhật.")
    return None


# <<<< PHẦN BỔ SUNG MỚI >>>>
async def get_all_users_paginated(
    db: AsyncIOMotorDatabase, 
    skip: int = 0, 
    limit: int = 100,
    # Thêm các tham số filter nếu cần, ví dụ:
    # email_filter: Optional[str] = None,
    # is_active_filter: Optional[bool] = None,
) -> Tuple[List[UserInDB], int]:
    """
    Lấy danh sách tất cả người dùng với phân trang và trả về tổng số lượng.
    """
    query = {}
    # if email_filter:
    #     query["email"] = {"$regex": email_filter, "$options": "i"}
    # if is_active_filter is not None:
    #     query["is_active"] = is_active_filter
    
    total_count = await db[USERS_COLLECTION].count_documents(query)
    
    users_cursor = (
        db[USERS_COLLECTION]
        .find(query)
        .sort("created_at", -1) # Sắp xếp theo ngày tạo mới nhất
        .skip(skip)
        .limit(limit)
    )
    user_docs = await users_cursor.to_list(length=limit)
    
    results: List[UserInDB] = []
    for doc in user_docs:
        # Chuyển đổi các ObjectId liên quan sang string nếu cần trước khi parse Pydantic
        if "role_ids" in doc and doc["role_ids"]:
            doc["role_ids"] = [str(r_id) for r_id in doc["role_ids"]]
        if "subscription_id" in doc and doc["subscription_id"] and isinstance(doc["subscription_id"], ObjectId):
            doc["subscription_id"] = str(doc["subscription_id"])
        results.append(UserInDB(**doc))
        
    return results, total_count
# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>