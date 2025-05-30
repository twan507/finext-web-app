# finext-fastapi/app/routers/users.py
import logging
from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.access import require_permission
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database

from app.crud.users import (
    assign_roles_to_user,
    create_user_db,
    get_user_by_email_db,
    get_user_by_id_db,
    revoke_roles_from_user,
)
import app.crud.brokers as crud_brokers
import app.crud.subscriptions as crud_subscriptions

from app.schemas.users import UserCreate, UserPublic, UserRoleModificationRequest, UserUpdate, UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId
from app.core.config import PROTECTED_USER_EMAILS, ADMIN_EMAIL, BROKER_EMAIL_1, BROKER_EMAIL_2

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=StandardApiResponse[UserPublic],
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
        created_user = await create_user_db(db, user_create_data=user_data)
        if not created_user:
            if await get_user_by_email_db(db, user_data.email):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Người dùng với email '{user_data.email}' đã tồn tại.",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo người dùng do lỗi máy chủ hoặc referral_code không hợp lệ.",
            )
        return UserPublic.model_validate(created_user)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/{user_id}",
    response_model=StandardApiResponse[UserPublic],
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
    return UserPublic.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=StandardApiResponse[UserPublic],
    summary="Cập nhật thông tin người dùng (yêu cầu quyền user:update_own hoặc user:update_any)",
    dependencies=[Depends(require_permission("user", "update"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Cập nhật người dùng thành công.")
async def update_user_info_endpoint(
    user_id: PyObjectId,
    user_update_data: UserUpdate, # UserUpdate now includes avatar_url
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user_from_token: UserInDB = Depends(get_current_active_user),
):
    users_collection = db.get_collection("users")

    target_user = await get_user_by_id_db(db, str(user_id))
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")

    update_dict = user_update_data.model_dump(exclude_unset=True)

    if target_user.email in PROTECTED_USER_EMAILS: #
        if "email" in update_dict and update_dict["email"] != target_user.email:
            if str(current_user_from_token.id) != str(target_user.id) or True:
                logger.warning(
                    f"Attempt to change email for protected user {target_user.email} by {current_user_from_token.email}. Denied."
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail=f"Cannot change email for protected user '{target_user.email}'."
                )
        # NEW: Prevent changing avatar_url of protected users directly via this endpoint
        # Avatar for protected users should ideally be managed via a specific internal process or seeding.
        # Or, if they are allowed to change their own avatar, it should be through the /uploads/image endpoint.
        if "avatar_url" in update_dict and str(current_user_from_token.id) != str(target_user.id) :
             logger.warning(
                f"Attempt to change avatar_url for protected user {target_user.email} by admin {current_user_from_token.email} via user update endpoint. Denied."
            )
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"Avatar for protected user '{target_user.email}' cannot be changed directly here. Use the upload feature."
            )


    update_data_dict = user_update_data.model_dump(exclude_unset=True)

    if not update_data_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không có dữ liệu nào được cung cấp để cập nhật.")

    # Handle referral_code as before
    if "referral_code" in update_data_dict:
        new_ref_code = update_data_dict["referral_code"]
        if new_ref_code is not None and new_ref_code != "":
            is_valid_ref_code = await crud_brokers.is_broker_code_valid_and_active(db, new_ref_code)
            if not is_valid_ref_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mã giới thiệu '{new_ref_code}' không hợp lệ hoặc không hoạt động.",
                )
            update_data_dict["referral_code"] = new_ref_code.upper()
        elif new_ref_code == "" or new_ref_code is None:
            update_data_dict["referral_code"] = None

    # Handle email change check as before
    if "email" in update_data_dict and update_data_dict["email"] != target_user.email:
        existing_user_with_new_email = await users_collection.find_one(
            {"email": update_data_dict["email"], "_id": {"$ne": ObjectId(user_id)}}
        )
        if existing_user_with_new_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{update_data_dict['email']}' đã được sử dụng bởi người dùng khác.",
            )
    
    # Handle avatar_url: if explicitly set to null or empty string, it means remove avatar.
    # The upload endpoint is the primary way to SET an avatar. This endpoint can be used to CLEAR it.
    if "avatar_url" in update_data_dict and (update_data_dict["avatar_url"] == "" or update_data_dict["avatar_url"] is None):
        update_data_dict["avatar_url"] = None # Ensure it's stored as null if cleared

    update_data_dict["updated_at"] = datetime.now(timezone.utc)

    updated_result = await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data_dict})

    if updated_result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found for update.",
        )

    updated_user_doc = await get_user_by_id_db(db, user_id=str(user_id))
    if not updated_user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found after update attempt.",
        )
    return UserPublic.model_validate(updated_user_doc)


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

    # Use PROTECTED_USER_EMAILS from config
    if user_to_delete.email in PROTECTED_USER_EMAILS:
        logger.warning(f"Attempt to delete protected user: {user_to_delete.email} by {current_admin.email}. Deletion denied.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Không thể xóa người dùng được bảo vệ: '{user_to_delete.email}'.",
        )

    broker_info = await crud_brokers.get_broker_by_user_id(db, user_to_delete.id)
    if broker_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Người dùng '{user_to_delete.email}' hiện là một Đối tác. Vui lòng hủy tư cách Đối tác trước khi xóa người dùng.",
        )

    await crud_subscriptions.deactivate_all_active_subscriptions_for_user(db, ObjectId(user_to_delete.id))
    await db.subscriptions.delete_many({"user_id": ObjectId(user_to_delete.id)})
    logger.info(f"Đã xóa tất cả subscriptions của user {user_to_delete.email} (ID: {user_id}).")

    await db.sessions.delete_many({"user_id": ObjectId(user_to_delete.id)})
    logger.info(f"Đã xóa tất cả sessions của user {user_to_delete.email} (ID: {user_id}).")

    users_collection = db.get_collection("users")
    delete_result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể xóa người dùng sau khi kiểm tra.")

    logger.info(f"Admin {current_admin.email} đã xóa user {user_to_delete.email} (ID: {user_id}).")
    return None


@router.get(
    "/",
    response_model=StandardApiResponse[List[UserPublic]],
    summary="Lấy danh sách người dùng (phân trang, yêu cầu quyền user:list)",
    dependencies=[Depends(require_permission("user", "list"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy danh sách người dùng thành công.")
async def read_all_users_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    users_collection = db.get_collection("users")
    user_docs_cursor = users_collection.find().skip(skip).limit(limit).sort("_id", -1)
    user_docs = await user_docs_cursor.to_list(length=limit)
    return [UserPublic.model_validate(doc) for doc in user_docs]


@router.post(
    "/{user_id}/roles",
    response_model=StandardApiResponse[UserPublic],
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy hoặc vai trò không hợp lệ.")
    return UserPublic.model_validate(updated_user)


@router.delete(
    "/{user_id}/roles",
    response_model=StandardApiResponse[UserPublic],
    summary="Thu hồi một hoặc nhiều vai trò từ người dùng",
    dependencies=[Depends(require_permission("user", "manage_roles"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Thu hồi vai trò từ người dùng thành công.")
async def revoke_roles_from_user_endpoint(
    user_id: PyObjectId,
    request_body: UserRoleModificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),  # Để kiểm tra logic phức tạp hơn nếu cần
):
    target_user = await get_user_by_id_db(db, str(user_id))
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy.")

    # Prevent revoking 'admin' or 'user' role from protected users if they only have that one role left
    # Or prevent revoking 'admin' from the last admin etc. (More complex logic)
    # For now, basic revocation:

    # If trying to revoke 'admin' role from one of the PROTECTED_USER_EMAILS (who should remain admin)
    admin_role_doc = await db.roles.find_one({"name": "admin"})
    if admin_role_doc and str(admin_role_doc["_id"]) in request_body.role_ids:
        if target_user.email in PROTECTED_USER_EMAILS and target_user.email == ADMIN_EMAIL:  # Cụ thể là ADMIN_EMAIL
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Không thể thu hồi vai trò 'admin' từ người dùng quản trị viên mặc định '{target_user.email}'.",
            )

    # Prevent revoking 'broker' role from seeded brokers
    broker_role_doc = await db.roles.find_one({"name": "broker"})
    if broker_role_doc and str(broker_role_doc["_id"]) in request_body.role_ids:
        if target_user.email in [BROKER_EMAIL_1, BROKER_EMAIL_2] and target_user.email is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Không thể thu hồi vai trò 'broker' từ người dùng đối tác mặc định '{target_user.email}'. Hãy hủy tư cách đối tác trước.",
            )

    updated_user = await revoke_roles_from_user(db, user_id, request_body.role_ids)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy sau khi thu hồi.")
    return UserPublic.model_validate(updated_user)
