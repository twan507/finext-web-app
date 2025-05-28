# finext-fastapi/app/routers/users.py
import logging
from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Query # Thêm Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.access import require_permission
from app.auth.dependencies import get_current_active_user # Thêm nếu cần cho logic quyền
from app.core.database import get_database

from app.crud.users import (
    assign_roles_to_user,
    create_user_db,
    get_user_by_email_db,
    get_user_by_id_db,
    revoke_roles_from_user,
)
import app.crud.brokers as crud_brokers # Thêm để validate referral_code nếu cần ở router
import app.crud.subscriptions as crud_subscriptions # Thêm để xử lý subscriptions khi xóa user

from app.schemas.users import (
    UserCreate, # Schema này đã có referral_code
    UserPublic,
    UserRoleModificationRequest,
    UserUpdate, # Schema này đã có referral_code
    UserInDB
)
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId
from app.core.config import ADMIN_EMAIL, BROKER_EMAIL, USER_EMAIL

logger = logging.getLogger(__name__)
router = APIRouter() # Không cần prefix và tags ở đây nếu đã có ở main.py

@router.post(
    "/",
    response_model=StandardApiResponse[UserPublic],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo người dùng mới (yêu cầu quyền user:create)",
    dependencies=[Depends(require_permission("user", "create"))],
    tags=["users"], # Giữ tags ở đây để Swagger UI phân nhóm
)
@api_response_wrapper(
    default_success_message="Người dùng được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_user_endpoint(
    user_data: UserCreate, # user_data đã chứa referral_code
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Logic kiểm tra email tồn tại và tạo user (bao gồm xử lý referral_code) đã nằm trong create_user_db
    try:
        created_user = await create_user_db(db, user_create_data=user_data)
        if not created_user:
            # create_user_db có thể trả về None nếu email đã tồn tại hoặc lỗi khác
            # Kiểm tra lại email để đưa ra thông báo cụ thể
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
    except ValueError as ve: # Bắt lỗi từ CRUD (ví dụ referral code không hợp lệ nếu CRUD raise)
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
    user = await get_user_by_id_db(
        db, user_id=str(user_id) # Đảm bảo truyền string
    )
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
    # Dependency require_permission("user", "update") sẽ kiểm tra quyền dựa trên path param user_id
    dependencies=[Depends(require_permission("user", "update"))],
    tags=["users"],
)
@api_response_wrapper(default_success_message="Cập nhật người dùng thành công.")
async def update_user_info_endpoint(
    user_id: PyObjectId,
    user_update_data: UserUpdate, # user_update_data đã chứa referral_code
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    # current_user_from_token: UserInDB = Depends(get_current_active_user) # Lấy user hiện tại để check quyền self
):
    users_collection = db.get_collection("users")
    
    # Logic cập nhật, bao gồm cả referral_code
    update_data_dict = user_update_data.model_dump(exclude_unset=True) # Chỉ lấy các trường được cung cấp

    if not update_data_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Không có dữ liệu nào được cung cấp để cập nhật."
        )

    # Nếu referral_code được cung cấp để cập nhật (kể cả là None để xóa)
    if "referral_code" in update_data_dict:
        new_ref_code = update_data_dict["referral_code"]
        if new_ref_code is not None and new_ref_code != "": # Nếu muốn cập nhật thành một mã mới
            is_valid_ref_code = await crud_brokers.is_broker_code_valid_and_active(db, new_ref_code)
            if not is_valid_ref_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mã giới thiệu '{new_ref_code}' không hợp lệ hoặc không hoạt động.",
                )
            update_data_dict["referral_code"] = new_ref_code.upper() # Chuẩn hóa
        elif new_ref_code == "" or new_ref_code is None: # Nếu muốn xóa mã
             update_data_dict["referral_code"] = None


    # Kiểm tra email nếu được cập nhật
    if "email" in update_data_dict:
        existing_user_with_new_email = await users_collection.find_one(
            {"email": update_data_dict["email"], "_id": {"$ne": ObjectId(user_id)}}
        )
        if existing_user_with_new_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{update_data_dict['email']}' đã được sử dụng bởi người dùng khác.",
            )

    update_data_dict["updated_at"] = datetime.now(timezone.utc)

    updated_result = await users_collection.update_one(
        {"_id": ObjectId(user_id)}, {"$set": update_data_dict}
    )

    if updated_result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found for update.",
        )

    updated_user_doc = await get_user_by_id_db(db, user_id=str(user_id))
    if not updated_user_doc: # Nên luôn tìm thấy nếu matched_count > 0
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
    current_admin: UserInDB = Depends(get_current_active_user), # Để kiểm tra không xóa chính mình
):
    user_to_delete = await get_user_by_id_db(db, user_id=str(user_id))
    if user_to_delete is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found.")

    if str(user_to_delete.id) == str(current_admin.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin không thể tự xóa chính mình.")

    protected_emails = [e for e in [ADMIN_EMAIL, BROKER_EMAIL, USER_EMAIL] if e]
    if user_to_delete.email in protected_emails and user_to_delete.email != current_admin.email: # Cho phép admin xóa các user seed khác nếu cần
        # Kiểm tra thêm nếu user là broker, cần xử lý logic xóa broker trước/sau
        broker_info = await crud_brokers.get_broker_by_user_id(db, user_to_delete.id)
        if broker_info:
             # Cần phải gọi API DELETE /brokers/{broker_id_or_code} thay vì xóa trực tiếp ở đây
             # Hoặc implement logic xóa broker (bao gồm thu hồi role, hủy sub PARTNER) ngay tại đây.
             # Hiện tại, để đơn giản, sẽ báo lỗi.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Người dùng '{user_to_delete.email}' hiện là một Đối tác. Vui lòng xóa tư cách Đối tác trước."
            )
    
    # TODO: Khi xóa user, cần xử lý các dữ liệu liên quan:
    # 1. Xóa/hủy các subscriptions của user này.
    await crud_subscriptions.deactivate_all_active_subscriptions_for_user(db, ObjectId(user_to_delete.id))
    await db.subscriptions.delete_many({"user_id": ObjectId(user_to_delete.id)}) # Xóa hẳn
    logger.info(f"Đã xóa tất cả subscriptions của user {user_to_delete.email} (ID: {user_id}).")

    # 2. Xóa các sessions của user này.
    await db.sessions.delete_many({"user_id": ObjectId(user_to_delete.id)})
    logger.info(f"Đã xóa tất cả sessions của user {user_to_delete.email} (ID: {user_id}).")

    # 3. Xóa các transactions của user này (Tùy chọn, có thể muốn giữ lại để lưu vết)
    # await db.transactions.delete_many({"buyer_user_id": ObjectId(user_to_delete.id)})

    # 4. Nếu user là một Broker, xóa bản ghi Broker của họ
    # Điều này nên được xử lý bởi endpoint DELETE /brokers/{broker_id_or_code}
    # Tuy nhiên, nếu admin xóa user trực tiếp, cần đảm bảo logic này cũng chạy.
    # Hoặc cấm xóa user nếu họ đang là Broker.
    # (Đã thêm check ở trên)


    users_collection = db.get_collection("users")
    delete_result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    if delete_result.deleted_count == 0:
        # Lỗi này không nên xảy ra nếu user_to_delete được tìm thấy
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
    limit: int = Query(100, ge=1, le=200), # Tăng limit tối đa
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    users_collection = db.get_collection("users")
    user_docs_cursor = users_collection.find().skip(skip).limit(limit).sort("_id", -1) # Sắp xếp theo _id giảm dần
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
    if not updated_user: # assign_roles_to_user có thể trả về None nếu user_id không hợp lệ
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy hoặc vai trò không hợp lệ.")
    return UserPublic.model_validate(updated_user)

@router.delete(
    "/{user_id}/roles",
    response_model=StandardApiResponse[UserPublic],
    summary="Thu hồi một hoặc nhiều vai trò từ người dùng",
    dependencies=[Depends(require_permission("user", "manage_roles"))],
    tags=["users"],
)
@api_response_wrapper(
    default_success_message="Thu hồi vai trò từ người dùng thành công."
)
async def revoke_roles_from_user_endpoint(
    user_id: PyObjectId,
    request_body: UserRoleModificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    updated_user = await revoke_roles_from_user(db, user_id, request_body.role_ids)
    if not updated_user: # revoke_roles_from_user có thể trả về None nếu user_id không hợp lệ
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tìm thấy.")
    return UserPublic.model_validate(updated_user)