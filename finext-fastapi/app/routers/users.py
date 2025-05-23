# finext-fastapi/app/routers/users.py
import logging
from datetime import datetime, timezone  # Đảm bảo timezone được import
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.access import require_permission
from app.core.database import get_database

# Thay đổi ở đây: Import trực tiếp các hàm cần thiết từ app.crud.users
from app.crud.users import (
    assign_roles_to_user,  # Import hàm mới
    create_user_db,
    get_user_by_email_db,
    get_user_by_id_db,
    revoke_roles_from_user,  # Import hàm mới
)
from app.schemas.users import (
    UserCreate,
    UserPublic,
    UserRoleModificationRequest,
    UserUpdate,
)
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId
from app.core.config import ADMIN_EMAIL, BROKER_EMAIL, USER_EMAIL

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=StandardApiResponse[UserPublic],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo người dùng mới (yêu cầu quyền user:create)",
    dependencies=[Depends(require_permission("user", "create"))],  # Thêm kiểm tra quyền
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
    # Logic tạo user không thay đổi
    created_user = await create_user_db(db, user_create_data=user_data)
    if not created_user:
        if await get_user_by_email_db(db, user_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Người dùng với email '{user_data.email}' đã tồn tại.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tạo người dùng do lỗi máy chủ.",
        )
    return UserPublic.model_validate(created_user)


@router.get(
    "/{user_id}",
    response_model=StandardApiResponse[UserPublic],
    summary="Lấy thông tin người dùng theo ID (yêu cầu quyền user:read_any)",
    dependencies=[
        Depends(require_permission("user", "read_any")),
    ],  # Thay đổi action cho phù hợp
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy thông tin người dùng thành công.")
async def read_user_endpoint(
    user_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user = await get_user_by_id_db(
        db, user_id=str(user_id)
    )  # Đảm bảo user_id là string
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    return UserPublic.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=StandardApiResponse[UserPublic],
    summary="Cập nhật thông tin người dùng (yêu cầu quyền user:update_self hoặc user:update_any)",
    dependencies=[Depends(require_permission("user", "update"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Cập nhật người dùng thành công.")
async def update_user_info_endpoint(
    user_id: PyObjectId,  # PyObjectId đã validate là string hợp lệ cho ObjectId
    user_update_data: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    users_collection = db.get_collection("users")
    update_data = user_update_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided."
        )

    # Kiểm tra email mới có bị trùng không (ngoại trừ user hiện tại)
    if "email" in update_data:
        # user_id là string, _id trong DB là ObjectId
        existing_user_with_new_email = await users_collection.find_one(
            {"email": update_data["email"], "_id": {"$ne": ObjectId(user_id)}}
        )
        if existing_user_with_new_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{update_data['email']}' is already in use by another user.",
            )

    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_result = await users_collection.update_one(
        {"_id": ObjectId(user_id)}, {"$set": update_data}
    )

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
    response_model=StandardApiResponse[
        None
    ],  # Giữ nguyên nếu bạn muốn response có message
    status_code=status.HTTP_200_OK,  # Đã thay đổi để có body message
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
):
    # Lấy thông tin user trước khi xóa để kiểm tra email
    user_to_delete = await get_user_by_id_db(db, user_id=str(user_id))

    if user_to_delete is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found for deletion.",
        )

    # Danh sách các email hệ thống không được phép xóa
    # Đảm bảo các biến ADMIN_EMAIL, BROKER_EMAIL, USER_EMAIL đã được import từ app.core.config
    # và chúng không phải là None
    protected_emails = []
    if ADMIN_EMAIL:
        protected_emails.append(ADMIN_EMAIL)
    if BROKER_EMAIL:
        protected_emails.append(BROKER_EMAIL)
    if USER_EMAIL:
        protected_emails.append(USER_EMAIL)

    # Chuyển thành set để kiểm tra hiệu quả hơn (tùy chọn với list nhỏ)
    # protected_emails_set = set(filter(None, [ADMIN_EMAIL, BROKER_EMAIL, USER_EMAIL]))

    if user_to_delete.email in protected_emails:
        logger.warning(
            f"Attempt to delete protected system user: {user_to_delete.email} (ID: {user_id})"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,  # Hoặc 400 Bad Request
            detail=f"Không thể xóa tài khoản hệ thống: {user_to_delete.email}.",
        )

    # Nếu không phải tài khoản bảo vệ, tiến hành xóa
    users_collection = db.get_collection("users")
    delete_result = await users_collection.delete_one({"_id": ObjectId(user_id)})

    # delete_result.deleted_count sẽ là 0 nếu user_to_delete tồn tại nhưng delete_one không tìm thấy
    # (trường hợp này ít xảy ra nếu get_user_by_id_db hoạt động đúng)
    # Tuy nhiên, kiểm tra deleted_count vẫn là một lớp bảo vệ tốt.
    if delete_result.deleted_count == 0:
        # Điều này không nên xảy ra nếu user_to_delete được tìm thấy ở trên.
        # Nhưng để an toàn, vẫn kiểm tra.
        logger.error(
            f"User {user_to_delete.email} (ID: {user_id}) found but delete_one failed."
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể xóa người dùng với ID {user_id} sau khi kiểm tra.",
        )

    return None  # Wrapper sẽ tạo response với message thành công


@router.get(
    "/",
    response_model=StandardApiResponse[List[UserPublic]],
    summary="Lấy danh sách người dùng (phân trang, yêu cầu quyền user:list)",
    dependencies=[Depends(require_permission("user", "list"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy danh sách người dùng thành công.")
async def read_all_users_endpoint(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    users_collection = db.get_collection("users")
    user_docs_cursor = users_collection.find().skip(skip).limit(limit)
    user_docs = await user_docs_cursor.to_list(
        length=limit
    )  # Explicitly provide length to to_list
    return [UserPublic.model_validate(doc) for doc in user_docs]


@router.post(
    "/{user_id}/roles",
    response_model=StandardApiResponse[UserPublic],
    summary="Gán một hoặc nhiều vai trò cho người dùng",
    dependencies=[Depends(require_permission("user", "manage_roles"))],
    tags=["users", "user_roles"],
)
@api_response_wrapper(default_success_message="Gán vai trò cho người dùng thành công.")
async def assign_roles_to_user_endpoint(
    user_id: PyObjectId,
    request_body: UserRoleModificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        # Gọi trực tiếp hàm đã import
        updated_user = await assign_roles_to_user(db, user_id, request_body.role_ids)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Người dùng với ID {user_id} không tìm thấy hoặc không thể gán vai trò.",
        )
    return UserPublic.model_validate(updated_user)


@router.delete(
    "/{user_id}/roles",
    response_model=StandardApiResponse[UserPublic],
    summary="Thu hồi một hoặc nhiều vai trò từ người dùng",
    dependencies=[Depends(require_permission("user", "manage_roles"))],
    tags=["users", "user_roles"],
)
@api_response_wrapper(
    default_success_message="Thu hồi vai trò từ người dùng thành công."
)
async def revoke_roles_from_user_endpoint(
    user_id: PyObjectId,
    request_body: UserRoleModificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Gọi trực tiếp hàm đã import
    updated_user = await revoke_roles_from_user(db, user_id, request_body.role_ids)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Người dùng với ID {user_id} không tìm thấy hoặc không thể thu hồi vai trò.",
        )
    return UserPublic.model_validate(updated_user)
