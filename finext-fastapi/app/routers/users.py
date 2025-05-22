# app/routers/users.py
import logging
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.users import UserCreate, UserInDB, UserPublic, UserUpdate
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user

from app.crud.users import create_user_db, get_user_by_email_db, get_user_by_id_db

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/",
    response_model=StandardApiResponse[UserPublic],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo người dùng mới",
    tags=["users"],
)
@api_response_wrapper(
    default_success_message="Người dùng được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_user_endpoint( # Đổi tên để tránh trùng với helper
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    created_user = await create_user_db(db, user_create_data=user_data)
    if not created_user:
        # Phân biệt lỗi email tồn tại
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
    summary="Lấy thông tin người dùng theo ID",
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy thông tin người dùng thành công.")
async def read_user_endpoint( # Đổi tên
    user_id: PyObjectId, # Sử dụng PyObjectId để FastAPI validate ObjectId string
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user: UserInDB = Depends(get_current_active_user) # Bảo vệ endpoint
):
    user = await get_user_by_id_db(db, user_id=user_id) # user_id đã là string
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    return UserPublic.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=StandardApiResponse[UserPublic],
    summary="Cập nhật thông tin người dùng",
    tags=["users"],
)
@api_response_wrapper(default_success_message="Cập nhật người dùng thành công.")
async def update_user_info_endpoint(
    user_id: PyObjectId,
    user_update_data: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user: UserInDB = Depends(get_current_active_user) # Bảo vệ endpoint
):

    users_collection = db.get_collection("users")
    update_data = user_update_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided."
        )

    if "email" in update_data:
        existing_user_with_new_email = await users_collection.find_one(
            {"email": update_data["email"], "_id": {"$ne": ObjectId(user_id)}}
        )
        if existing_user_with_new_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{update_data['email']}' is already in use by another user.",
            )
    
    # Cập nhật trường updated_at
    update_data["updated_at"] = datetime.now()

    updated_result = await users_collection.update_one(
        {"_id": ObjectId(user_id)}, {"$set": update_data}
    )

    if updated_result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found for update.",
        )
    
    updated_user_doc = await get_user_by_id_db(db, user_id=user_id)
    if not updated_user_doc:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, # Hoặc 500 nếu không mong đợi
            detail=f"User with ID {user_id} not found after update attempt.",
        )
    return UserPublic.model_validate(updated_user_doc)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa người dùng theo ID",
    tags=["users"],
)
@api_response_wrapper(
    success_status_code=status.HTTP_204_NO_CONTENT
)
async def delete_user_by_id_endpoint(
    user_id: PyObjectId, 
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user: UserInDB = Depends(get_current_active_user) # Bảo vệ endpoint, chỉ admin mới được xóa
):
    # Thêm logic kiểm tra quyền hạn ở đây nếu cần
    users_collection = db.get_collection("users")
    delete_result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    if delete_result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found for deletion.",
        )
    return None


@router.get(
    "/",
    response_model=StandardApiResponse[List[UserPublic]],
    summary="Lấy danh sách người dùng (phân trang)",
    tags=["users"],
)
@api_response_wrapper(default_success_message="Lấy danh sách người dùng thành công.")
async def read_all_users_endpoint(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user: UserInDB = Depends(get_current_active_user) # Bảo vệ endpoint
):
    users_collection = db.get_collection("users")
    user_docs_cursor = users_collection.find().skip(skip).limit(limit)
    user_docs = await user_docs_cursor.to_list(length=limit)
    return [UserPublic.model_validate(doc) for doc in user_docs]

