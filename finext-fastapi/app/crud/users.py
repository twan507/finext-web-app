# finext-fastapi/app/crud/users.py
import logging
from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

# Sửa lại import UserCreate, UserInDB từ local schemas
from app.schemas.users import UserCreate, UserInDB, GoogleUserSchema # Thêm GoogleUserSchema
from app.utils.security import get_password_hash
from datetime import datetime, timezone
from app.utils.types import PyObjectId
import app.crud.brokers as crud_brokers
import secrets # Thêm
import string # Thêm

logger = logging.getLogger(__name__)

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
    user_doc = await db.users.find_one({"google_id": google_id})
    if user_doc:
        # Chuyển đổi ObjectId sang str cho Pydantic model
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            if isinstance(user_doc["subscription_id"], ObjectId):
                 user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def get_user_by_email_db(db: AsyncIOMotorDatabase, email: str) -> Optional[UserInDB]:
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            if isinstance(user_doc["subscription_id"], ObjectId):
                 user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def get_user_by_id_db(db: AsyncIOMotorDatabase, user_id: str) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id):
        return None
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if user_doc:
        if "role_ids" in user_doc and user_doc["role_ids"]:
            user_doc["role_ids"] = [str(r_id) for r_id in user_doc["role_ids"]]
        if "subscription_id" in user_doc and user_doc["subscription_id"]:
            if isinstance(user_doc["subscription_id"], ObjectId):
                 user_doc["subscription_id"] = str(user_doc["subscription_id"])
        return UserInDB(**user_doc)
    return None

async def create_user_db(
    db: AsyncIOMotorDatabase,
    user_create_data: UserCreate,
    set_active_on_create: bool = False # Mặc định là False cho đăng ký truyền thống (cần OTP)
) -> Optional[UserInDB]:
    existing_user = await get_user_by_email_db(db, email=user_create_data.email)
    if existing_user:
        if existing_user.is_active:
            logger.warning(f"Email {user_create_data.email} đã tồn tại và đã được kích hoạt.")
            raise ValueError(f"Email '{user_create_data.email}' đã được đăng ký và kích hoạt.")
        else:
            # Trường hợp đăng ký lại khi chưa active, có thể cho phép ghi đè hoặc yêu cầu đăng nhập/xác thực lại OTP cũ
            # Hiện tại, để đơn giản, ta vẫn báo lỗi.
            logger.warning(f"Email {user_create_data.email} đã tồn tại nhưng chưa kích hoạt. Cân nhắc cho phép xác thực lại.")
            raise ValueError(f"Email '{user_create_data.email}' đã được đăng ký nhưng chưa kích hoạt. Vui lòng kiểm tra email để xác thực hoặc liên hệ hỗ trợ.")

    if user_create_data.password is None: # Cần mật khẩu nếu không phải tạo qua Google
        raise ValueError("Mật khẩu là bắt buộc khi tạo người dùng theo cách này.")
    hashed_password = get_password_hash(user_create_data.password)

    user_document_to_insert = user_create_data.model_dump(exclude={"password"}) # Loại trừ password đã hash
    user_document_to_insert["hashed_password"] = hashed_password
    user_document_to_insert["is_active"] = set_active_on_create
    user_document_to_insert["created_at"] = datetime.now(timezone.utc)
    user_document_to_insert["updated_at"] = datetime.now(timezone.utc)
    user_document_to_insert["subscription_id"] = None
    user_document_to_insert["google_id"] = None # User tạo truyền thống không có google_id ban đầu

    if user_create_data.referral_code:
        is_valid_ref_code = await crud_brokers.is_broker_code_valid_and_active(db, user_create_data.referral_code)
        if is_valid_ref_code:
            user_document_to_insert["referral_code"] = user_create_data.referral_code.upper()
        else:
            logger.warning(f"Mã giới thiệu '{user_create_data.referral_code}' không hợp lệ. User '{user_create_data.email}' sẽ được tạo không có mã giới thiệu.")
            user_document_to_insert["referral_code"] = None
    else:
        user_document_to_insert["referral_code"] = None

    role_object_ids = []
    user_role_doc = await db.roles.find_one({"name": "user"}) # Gán vai trò "user" mặc định
    if user_role_doc and "_id" in user_role_doc:
        role_object_ids.append(user_role_doc["_id"])
    else:
        logger.error("QUAN TRỌNG: Không tìm thấy vai trò 'user' mặc định trong database. User mới sẽ không có vai trò nào được gán.")
        # Có thể raise Exception ở đây để ngăn việc tạo user không có role
        raise Exception("Lỗi hệ thống: Không tìm thấy vai trò 'user' mặc định.")

    user_document_to_insert["role_ids"] = role_object_ids

    try:
        insert_result = await db.users.insert_one(user_document_to_insert)
        if insert_result.inserted_id:
            # Lấy lại user từ DB để đảm bảo dữ liệu nhất quán và trả về UserInDB
            created_user_doc = await db.users.find_one({"_id": insert_result.inserted_id})
            if created_user_doc:
                # Chuyển đổi lại ObjectId sang str cho Pydantic
                if "role_ids" in created_user_doc and created_user_doc["role_ids"]:
                    created_user_doc["role_ids"] = [str(r_id) for r_id in created_user_doc["role_ids"]]
                if "subscription_id" in created_user_doc and created_user_doc["subscription_id"]:
                     if isinstance(created_user_doc["subscription_id"], ObjectId):
                        created_user_doc["subscription_id"] = str(created_user_doc["subscription_id"])
                return UserInDB(**created_user_doc)
        logger.error(f"Không thể tạo người dùng với email: {user_create_data.email}")
        return None
    except Exception as e:
        logger.error(f"Lỗi khi tạo người dùng {user_create_data.email}: {e}", exc_info=True)
        return None


async def get_or_create_user_from_google_sub_email(db: AsyncIOMotorDatabase, google_user_data: GoogleUserSchema) -> Optional[UserInDB]:
    """
    Lấy hoặc tạo người dùng từ thông tin Google.
    Ưu tiên tìm bằng google_id (sub), sau đó bằng email.
    Tự động tạo/liên kết nếu email_verified là true và các điều kiện khác được đáp ứng.
    """
    # 1. Ưu tiên tìm User bằng google_id (sub)
    user_by_google_id = await get_user_by_google_id_db(db, google_id=google_user_data.id)
    if user_by_google_id:
        logger.info(f"Tìm thấy user bằng Google ID: {google_user_data.id} cho email {google_user_data.email}. Đăng nhập lại.")
        # Kiểm tra và cập nhật is_active nếu Google xác thực email và user đang inactive
        if google_user_data.verified_email and not user_by_google_id.is_active:
            await db.users.update_one(
                {"_id": ObjectId(user_by_google_id.id)},
                {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"Kích hoạt user {user_by_google_id.email} dựa trên Google email_verified.")
            return await get_user_by_id_db(db, str(user_by_google_id.id)) # Lấy lại thông tin mới nhất
        return user_by_google_id

    # 2. Nếu không tìm thấy bằng google_id, tìm User bằng email
    user_by_email = await get_user_by_email_db(db, email=google_user_data.email)

    if user_by_email:
        # Email tồn tại trong user_db
        if user_by_email.google_id:
            # Email này đã được liên kết với một google_id
            if user_by_email.google_id == google_user_data.id:
                # Đây là trường hợp user đã có google_id khớp, nhưng bước 1 không tìm thấy (khó xảy ra nếu DB nhất quán)
                # Có thể coi như đăng nhập lại.
                logger.info(f"User với email {google_user_data.email} đã có google_id khớp. Đăng nhập lại.")
                return user_by_email
            else:
                # Email này đã liên kết với một tài khoản Google khác.
                # Theo yêu cầu: "Bỏ qua việc xử lý xung đột nếu một email đã có google_id nhưng sub từ Google lại khác"
                # Điều này có nghĩa là không cho đăng nhập/liên kết với sub mới này.
                logger.error(
                    f"Email {google_user_data.email} đã được liên kết với một tài khoản Google khác (DB Google ID: {user_by_email.google_id}, Request Google ID: {google_user_data.id}). "
                    f"Không thể tự động liên kết hoặc đăng nhập bằng tài khoản Google này."
                )
                raise ValueError(
                    f"Email {google_user_data.email} đã được sử dụng với một tài khoản Google khác. "
                    "Vui lòng đăng nhập bằng tài khoản Google đã liên kết trước đó hoặc sử dụng email khác."
                )
        else:
            # Email tồn tại nhưng chưa có google_id -> Liên kết tài khoản
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
            # Cập nhật is_active nếu user chưa active và email Google đã verified
            if not user_by_email.is_active: # google_user_data.verified_email đã là true ở đây
                update_fields["is_active"] = True
                logger.info(f"Kích hoạt user {user_by_email.email} trong quá trình liên kết tài khoản Google.")

            # Cập nhật avatar nếu user chưa có hoặc khác với Google
            if google_user_data.picture and (not user_by_email.avatar_url or user_by_email.avatar_url != google_user_data.picture):
                update_fields["avatar_url"] = google_user_data.picture

            await db.users.update_one({"_id": ObjectId(user_by_email.id)}, {"$set": update_fields})
            return await get_user_by_id_db(db, str(user_by_email.id)) # Lấy lại thông tin user đã cập nhật
    else:
        # Người dùng mới hoàn toàn (không tìm thấy google_id, không tìm thấy email)
        if not google_user_data.verified_email:
            logger.warning(
                f"Email {google_user_data.email} là mới nhưng chưa được xác thực bởi Google. Không tạo tài khoản."
            )
            raise ValueError("Email của bạn từ Google chưa được xác thực. Không thể tạo tài khoản Finext.")

        logger.info(f"Tạo tài khoản Finext mới cho người dùng Google: {google_user_data.email} với Google ID: {google_user_data.id}")
        random_password = generate_random_strong_password()
        hashed_password = get_password_hash(random_password) # Hash mật khẩu ngẫu nhiên

        new_user_data = {
            "full_name": google_user_data.name or google_user_data.email.split('@')[0],
            "email": google_user_data.email,
            "phone_number": None, # Google không cung cấp
            "hashed_password": hashed_password, # Lưu mật khẩu đã hash
            "is_active": True, # Vì email_verified là true
            "google_id": google_user_data.id,
            "avatar_url": google_user_data.picture,
            "referral_code": None,
            "subscription_id": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        # Gán vai trò "user" mặc định
        role_object_ids = []
        user_role_doc = await db.roles.find_one({"name": "user"})
        if user_role_doc and "_id" in user_role_doc:
            role_object_ids.append(user_role_doc["_id"])
        else:
            logger.error("QUAN TRỌNG: Không tìm thấy vai trò 'user' mặc định khi tạo user qua Google.")
            # Quyết định: có nên raise Exception không? Hiện tại sẽ tạo user không có role nếu không tìm thấy.
            # Hoặc tốt hơn là raise Exception để admin biết cấu hình thiếu.
            raise Exception("Lỗi hệ thống: Vai trò 'user' mặc định không được cấu hình.")
        new_user_data["role_ids"] = role_object_ids

        try:
            result = await db.users.insert_one(new_user_data)
            if result.inserted_id:
                created_user_doc = await db.users.find_one({"_id": result.inserted_id})
                if created_user_doc:
                    # Chuyển ObjectId sang str cho Pydantic
                    if "role_ids" in created_user_doc and created_user_doc["role_ids"]:
                        created_user_doc["role_ids"] = [str(r_id) for r_id in created_user_doc["role_ids"]]
                    # subscription_id ban đầu là None
                    return UserInDB(**created_user_doc)
            logger.error(f"Không thể tạo người dùng mới từ Google cho email: {google_user_data.email} sau khi insert.")
            return None
        except Exception as e:
            logger.error(f"Lỗi khi insert người dùng mới từ Google cho {google_user_data.email}: {e}", exc_info=True)
            return None

# Các hàm còn lại (assign_roles_to_user, revoke_roles_from_user, update_user_password, set_user_avatar) giữ nguyên
# ... (giữ nguyên các hàm khác)
async def set_user_avatar(db: AsyncIOMotorDatabase, user_id: PyObjectId, avatar_url: Optional[str]) -> bool:
    if not ObjectId.is_valid(user_id):
        logger.error(f"Invalid user_id format for updating avatar: {user_id}")
        return False

    user_obj_id = ObjectId(user_id)
    update_result = await db.users.update_one(
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
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        logger.error(f"User với ID {user_id_str} không tìm thấy để gán role.")
        return None

    current_role_obj_ids_set = set(user.get("role_ids", []))
    valid_role_obj_ids_to_add: List[ObjectId] = []
    if role_ids_to_assign_str: # Check if list is not empty
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

    if not valid_role_obj_ids_to_add and role_ids_to_assign_str: # Nếu có yêu cầu gán nhưng không có role nào hợp lệ
        # Có thể raise ValueError hoặc trả về user hiện tại không thay đổi
        # Để nhất quán, có thể raise lỗi để báo cho admin biết các role_ids không hợp lệ
        raise ValueError("Không có vai trò hợp lệ nào được cung cấp để gán hoặc tất cả vai trò cung cấp không tồn tại.")


    for role_obj_id in valid_role_obj_ids_to_add:
        current_role_obj_ids_set.add(role_obj_id)

    updated_role_obj_ids_list = list(current_role_obj_ids_set)
    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": updated_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)

async def revoke_roles_from_user(db: AsyncIOMotorDatabase, user_id_str: PyObjectId, role_ids_to_revoke_str: List[PyObjectId]) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"User ID không hợp lệ khi thu hồi role: {user_id_str}")
        return None

    user_obj_id = ObjectId(user_id_str)
    user = await db.users.find_one({"_id": user_obj_id})
    if not user:
        logger.error(f"User với ID {user_id_str} không tìm thấy để thu hồi role.")
        return None

    current_role_obj_ids_set = set(user.get("role_ids", []))
    role_obj_ids_to_revoke_set = set()
    if role_ids_to_revoke_str: # Check if list is not empty
        for r_id_str in role_ids_to_revoke_str:
            if ObjectId.is_valid(r_id_str):
                role_obj_ids_to_revoke_set.add(ObjectId(r_id_str))
            else:
                logger.warning(f"Định dạng ObjectId không hợp lệ cho Role ID '{r_id_str}' cần thu hồi. Bỏ qua.")

    remaining_role_obj_ids_list = list(current_role_obj_ids_set - role_obj_ids_to_revoke_set)
    await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"role_ids": remaining_role_obj_ids_list, "updated_at": datetime.now(timezone.utc)}}
    )
    return await get_user_by_id_db(db, user_id_str)

async def update_user_password(db: AsyncIOMotorDatabase, user_id: PyObjectId, new_password: str) -> bool:
    user_doc = await get_user_by_id_db(db, user_id=str(user_id)) # Lấy user để kiểm tra
    if not user_doc:
        logger.error(f"Không tìm thấy user với ID {user_id} để cập nhật mật khẩu.")
        return False
    if not user_doc.is_active:
        logger.warning(f"Tài khoản {user_doc.email} không hoạt động, không cho phép đổi mật khẩu.")
        # Có thể raise lỗi ở đây nếu cần
        return False

    new_hashed_password = get_password_hash(new_password)
    update_result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"hashed_password": new_hashed_password, "updated_at": datetime.now(timezone.utc)}}
    )
    return update_result.modified_count > 0

async def update_user_db(
    db: AsyncIOMotorDatabase,
    user_id_to_update_str: PyObjectId,
    user_update_data: dict # Sẽ là model_dump() từ UserUpdate schema
) -> Optional[UserInDB]:
    if not ObjectId.is_valid(user_id_to_update_str):
        logger.error(f"User ID không hợp lệ để cập nhật: {user_id_to_update_str}")
        return None

    user_obj_id = ObjectId(user_id_to_update_str)
    # Không cần lấy user hiện tại ở đây nữa nếu các kiểm tra phức tạp đã ở router

    if not user_update_data: # Nếu dict rỗng
        return await get_user_by_id_db(db, user_id_to_update_str)

    user_update_data["updated_at"] = datetime.now(timezone.utc)

    update_result = await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": user_update_data}
    )

    if update_result.matched_count > 0:
        return await get_user_by_id_db(db, user_id_to_update_str)
    # User không tìm thấy
    return None