# finext-fastapi/app/routers/users.py
import logging

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.access import require_permission
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database

# <<<< PHẦN CẬP NHẬT IMPORT >>>>
from app.crud.users import (
    assign_roles_to_user,
    create_user_db,
    get_user_by_id_db,
    revoke_roles_from_user,
    update_user_db,  # Thêm update_user_db nếu chưa có
    update_user_password,  # Thêm import hàm cập nhật mật khẩu
    get_all_users_paginated,  # Thêm hàm mới
)

# <<<< KẾT THÚC PHẦN CẬP NHẬT IMPORT >>>>
import app.crud.brokers as crud_brokers
import app.crud.subscriptions as crud_subscriptions

from app.schemas.users import UserCreate, UserAdminResponse, UserRoleModificationRequest, UserUpdate, UserInDB
from app.schemas.auth import AdminChangePasswordRequest  # Thêm import schema mới
from app.schemas.common import PaginatedResponse  # <<<< IMPORT SCHEMA PHÂN TRANG >>>>
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId
from app.core.config import PROTECTED_USER_EMAILS, ADMIN_EMAIL, BROKER_EMAIL_1, BROKER_EMAIL_2

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags sẽ được đặt ở main.py


@router.post(
    "/",
    response_model=StandardApiResponse[UserAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo người dùng mới (yêu cầu quyền user:create)",
    dependencies=[Depends(require_permission("user", "create"))],
    tags=["users"],
)
@api_response_wrapper(
    default_success_message="Người dùng được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_user_endpoint(
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        # Admin tạo user nên kích hoạt ngay lập tức (set_active_on_create=True)
        created_user = await create_user_db(db, user_create_data=user_data, set_active_on_create=True)
        if not created_user:  # create_user_db đã raise ValueError nếu email tồn tại hoặc lỗi logic khác
            # Lỗi ở đây có thể là lỗi không mong muốn khi ghi DB
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo người dùng do lỗi máy chủ.",
            )
        return UserAdminResponse.model_validate(created_user)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/protected-emails",
    response_model=StandardApiResponse[list[str]],
    summary="Lấy danh sách email được bảo vệ (yêu cầu quyền user:list)",
    dependencies=[Depends(require_permission("user", "list"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy danh sách email được bảo vệ thành công.")
async def get_protected_emails_endpoint():
    """
    Trả về danh sách các email được bảo vệ trong hệ thống.
    """
    return PROTECTED_USER_EMAILS


@router.get(
    "/{user_id}",
    response_model=StandardApiResponse[UserAdminResponse],
    summary="Lấy thông tin người dùng theo ID (yêu cầu quyền user:read_any)",
    dependencies=[
        Depends(require_permission("user", "read_any")),
    ],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy thông tin người dùng thành công.")
async def read_user_endpoint(
    user_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user = await get_user_by_id_db(db, user_id=str(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    return UserAdminResponse.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=StandardApiResponse[UserAdminResponse],
    summary="Cập nhật thông tin người dùng (yêu cầu quyền user:update_own hoặc user:update_any)",
    dependencies=[Depends(require_permission("user", "update"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Cập nhật người dùng thành công.")
async def update_user_info_endpoint(
    user_id: PyObjectId,
    user_update_data: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user_from_token: UserInDB = Depends(get_current_active_user),
):
    target_user = await get_user_by_id_db(db, str(user_id))
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")

    # Bảo vệ việc thay đổi email và avatar của user protected
    if target_user.email in PROTECTED_USER_EMAILS:
        if "email" in user_update_data.model_dump(exclude_unset=True) and user_update_data.email != target_user.email:
            # Chỉ admin hoặc chính user đó mới được thử đổi email (và sẽ bị chặn nếu là protected)
            # Logic này có thể cần xem xét lại nếu admin được phép đổi email user protected trong một số trường hợp
            logger.warning(f"Attempt to change email for protected user {target_user.email} by {current_user_from_token.email}. Denied.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"Cannot change email for protected user '{target_user.email}'."
            )
        if "avatar_url" in user_update_data.model_dump(exclude_unset=True) and str(current_user_from_token.id) != str(target_user.id):
            logger.warning(
                f"Attempt to change avatar_url for protected user {target_user.email} by admin {current_user_from_token.email} via user update endpoint. Denied."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Avatar for protected user '{target_user.email}' cannot be changed directly here. Use the upload feature.",
            )

    update_dict_for_crud = user_update_data.model_dump(exclude_unset=True)
    if not update_dict_for_crud:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không có dữ liệu nào được cung cấp để cập nhật.")

    try:
        updated_user_doc = await update_user_db(db, user_id_to_update_str=user_id, user_update_data=update_dict_for_crud)
        if not updated_user_doc:
            # update_user_db trả về None nếu user không tìm thấy hoặc lỗi logic khác không phải ValueError
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,  # Hoặc 500 tùy thuộc nguyên nhân
                detail=f"User with ID {user_id} not found for update or update failed.",
            )
        return UserAdminResponse.model_validate(updated_user_doc)
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ: email trùng, ref_code không hợp lệ)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


async def _get_user_role_names(db: AsyncIOMotorDatabase, user_id_obj: ObjectId) -> set[str]:
    """Helper function to get role names for a user."""
    user_doc = await db.users.find_one({"_id": user_id_obj}, {"role_ids": 1})
    if not user_doc or not user_doc.get("role_ids"):
        return set()

    role_object_ids_from_user = user_doc.get("role_ids", [])
    if not role_object_ids_from_user:
        return set()

    roles_cursor = db.roles.find({"_id": {"$in": role_object_ids_from_user}}, {"name": 1})
    role_names = set()
    async for role in roles_cursor:
        if "name" in role:
            role_names.add(role["name"])
    return role_names


@router.delete(
    "/{user_id}",
    response_model=StandardApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Xóa người dùng theo ID (yêu cầu quyền user:delete_any)",
    dependencies=[Depends(require_permission("user", "delete_any"))],
    tags=["users"],
)
@api_response_wrapper(
    default_success_message="Người dùng đã được xóa thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def delete_user_by_id_endpoint(
    user_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    user_to_delete = await get_user_by_id_db(db, user_id=str(user_id))
    if user_to_delete is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")

    if str(user_to_delete.id) == str(current_admin.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin không thể tự xóa chính mình.")

    if user_to_delete.email in PROTECTED_USER_EMAILS:
        logger.warning(f"Attempt to delete protected user: {user_to_delete.email} by {current_admin.email}. Deletion denied.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Không thể xóa người dùng được bảo vệ: '{user_to_delete.email}'.",
        )

    # Check user roles - only allow deletion if user has only "user" role
    user_role_names = await _get_user_role_names(db, ObjectId(user_to_delete.id))
    if not user_role_names:
        logger.warning(f"User {user_to_delete.email} has no roles assigned. Allowing deletion.")
    elif user_role_names != {"user"}:
        # User has roles other than just "user"
        additional_roles = user_role_names - {"user"}
        if additional_roles:
            role_list = ", ".join(sorted(additional_roles))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể xóa người dùng '{user_to_delete.email}' vì còn có các vai trò: {role_list}. Vui lòng thu hồi các vai trò này trước khi xóa người dùng.",
            )

    broker_info = await crud_brokers.get_broker_by_user_id(db, user_to_delete.id)  # type: ignore
    if broker_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Người dùng '{user_to_delete.email}' hiện là một Đối tác. Vui lòng hủy tư cách Đối tác trước khi xóa người dùng.",
        )

    await crud_subscriptions.deactivate_all_active_subscriptions_for_user(db, ObjectId(user_to_delete.id))
    # Cân nhắc xóa hẳn các subscription record thay vì chỉ deactivate, tùy theo yêu cầu nghiệp vụ
    # await db.subscriptions.delete_many({"user_id": ObjectId(user_to_delete.id)})
    logger.info(f"Đã hủy kích hoạt tất cả subscriptions của user {user_to_delete.email} (ID: {user_id}).")

    await db.sessions.delete_many({"user_id": ObjectId(user_to_delete.id)})
    logger.info(f"Đã xóa tất cả sessions của user {user_to_delete.email} (ID: {user_id}).")

    # Xóa watchlists của user
    await db.watchlists.delete_many({"user_id": ObjectId(user_to_delete.id)})
    logger.info(f"Đã xóa tất cả watchlists của user {user_to_delete.email} (ID: {user_id}).")

    # Xóa OTPs của user
    await db.otps.delete_many({"user_id": ObjectId(user_to_delete.id)})
    logger.info(f"Đã xóa tất cả OTPs của user {user_to_delete.email} (ID: {user_id}).")

    # Xóa uploads của user (ví dụ avatar) - cần logic để xóa file trên R2 nếu cần
    # await db.uploads.delete_many({"user_id": ObjectId(user_to_delete.id)})
    # logger.info(f"Đã xóa tất cả uploads của user {user_to_delete.email} (ID: {user_id}). Cần xử lý file trên R2 thủ công hoặc bằng trigger.")

    users_collection = db.get_collection("users")
    delete_result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    if delete_result.deleted_count == 0:
        # Lỗi này không nên xảy ra nếu user_to_delete được tìm thấy trước đó
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể xóa người dùng sau khi kiểm tra.")

    logger.info(f"Admin {current_admin.email} đã xóa user {user_to_delete.email} (ID: {user_id}).")
    return None


# <<<< PHẦN CẬP NHẬT ENDPOINT LIST ALL USERS >>>>
@router.get(
    "/",
    response_model=StandardApiResponse[PaginatedResponse[UserAdminResponse]],  # SỬA RESPONSE MODEL
    summary="Lấy danh sách người dùng (phân trang, yêu cầu quyền user:list)",
    dependencies=[Depends(require_permission("user", "list"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy danh sách người dùng thành công.")
async def read_all_users_endpoint(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số lượng bản ghi tối đa trả về (99999 cho 'All')"),
    # Thêm các filter nếu cần, ví dụ:
    # email_filter: Optional[str] = Query(None, description="Lọc theo email (chứa)"),
    # is_active_filter: Optional[bool] = Query(None, description="Lọc theo trạng thái active"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user_docs, total_count = await get_all_users_paginated(
        db,
        skip=skip,
        limit=limit,
        # email_filter=email_filter, # Truyền các filter vào CRUD
        # is_active_filter=is_active_filter,
    )

    items = [UserAdminResponse.model_validate(doc) for doc in user_docs]
    return PaginatedResponse[UserAdminResponse](items=items, total=total_count)


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


# <<<< PHẦN CẬP NHẬT ENDPOINT ROLE MANAGEMENT >>>>


@router.post(
    "/{user_id}/roles",
    response_model=StandardApiResponse[UserAdminResponse],
    summary="Gán một hoặc nhiều vai trò cho người dùng",
    dependencies=[Depends(require_permission("user", "manage_roles"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Gán vai trò cho người dùng thành công.")
async def assign_roles_to_user_endpoint(
    user_id: PyObjectId,
    request_body: UserRoleModificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_user = await assign_roles_to_user(db, user_id, request_body.role_ids)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    if not updated_user:
        # Lỗi này có thể do user_id không tồn tại, hoặc role_ids không hợp lệ và không có role nào được gán
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy hoặc không có vai trò hợp lệ nào được gán."
        )
    return UserAdminResponse.model_validate(updated_user)


@router.delete(
    "/{user_id}/roles",
    response_model=StandardApiResponse[UserAdminResponse],
    summary="Thu hồi một hoặc nhiều vai trò từ người dùng",
    dependencies=[Depends(require_permission("user", "manage_roles"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Thu hồi vai trò từ người dùng thành công.")
async def revoke_roles_from_user_endpoint(
    user_id: PyObjectId,
    request_body: UserRoleModificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    target_user = await get_user_by_id_db(db, str(user_id))
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy.")

    admin_role_doc = await db.roles.find_one({"name": "admin"})
    if admin_role_doc and str(admin_role_doc["_id"]) in request_body.role_ids:
        if target_user.email in PROTECTED_USER_EMAILS and target_user.email == ADMIN_EMAIL:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Không thể thu hồi vai trò 'admin' từ người dùng quản trị viên mặc định '{target_user.email}'.",
            )

    broker_role_doc = await db.roles.find_one({"name": "broker"})
    if broker_role_doc and str(broker_role_doc["_id"]) in request_body.role_ids:
        if target_user.email in [BROKER_EMAIL_1, BROKER_EMAIL_2] and target_user.email is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Không thể thu hồi vai trò 'broker' từ người dùng đối tác mặc định '{target_user.email}'. Hãy hủy tư cách đối tác trước.",
            )

    updated_user = await revoke_roles_from_user(db, user_id, request_body.role_ids)
    if not updated_user:  # Should not happen if user was found initially
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy sau khi thu hồi vai trò.")
    return UserAdminResponse.model_validate(updated_user)


@router.put(
    "/{user_id}/change-password",
    response_model=StandardApiResponse[None],
    summary="Admin thay đổi mật khẩu cho người dùng (yêu cầu quyền user:change_password_any)",
    dependencies=[Depends(require_permission("user", "change_password_any"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Mật khẩu đã được thay đổi thành công.")
async def admin_change_user_password_endpoint(
    user_id: PyObjectId,
    password_data: AdminChangePasswordRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    """
    API cho admin thay đổi mật khẩu của người dùng mà không cần biết mật khẩu cũ.
    """
    # Kiểm tra user có tồn tại không
    target_user = await get_user_by_id_db(db, str(user_id))
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")

    # Kiểm tra user có đang hoạt động không
    if not target_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change password for inactive user '{target_user.email}'.",
        )

    # Không cho phép admin tự thay đổi mật khẩu của chính mình thông qua endpoint này
    if str(target_user.id) == str(current_admin.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin không thể sử dụng endpoint này để thay đổi mật khẩu của chính mình. Vui lòng sử dụng endpoint 'change-password' thông thường.",
        )

    # Thực hiện cập nhật mật khẩu
    password_updated = await update_user_password(db, user_id=str(user_id), new_password=password_data.new_password)

    if not password_updated:
        logger.error(f"Không thể cập nhật mật khẩu cho user {target_user.email} (ID: {user_id}) bởi admin {current_admin.email}.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể cập nhật mật khẩu. Vui lòng thử lại sau.")

    logger.info(f"Admin {current_admin.email} đã thay đổi mật khẩu cho user {target_user.email} (ID: {user_id}).")
    return None
