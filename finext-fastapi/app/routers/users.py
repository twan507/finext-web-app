import logging
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext

from ..core.database import get_database
from ..schemas.users import UserCreate, UserPublic, UserUpdate
from ..utils.response_wrapper import StandardApiResponse, api_response_wrapper

logger = logging.getLogger(__name__)
router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


@router.post(
    "/",
    response_model=StandardApiResponse[UserPublic],  # Giữ nguyên cho OpenAPI
    status_code=status.HTTP_201_CREATED,  # Giữ nguyên cho OpenAPI
    summary="Create a new user",
    tags=["users"],
)
@api_response_wrapper(  # THÊM decorator này
    default_success_message="Người dùng được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_user(
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    users_collection = db.get_collection("users")

    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Người dùng với email '{user_data.email}' đã tồn tại.",
        )

    hashed_password = get_password_hash(user_data.password)
    user_document_to_insert = user_data.model_dump(exclude={"password"})
    user_document_to_insert["hashed_password"] = hashed_password

    try:
        insert_result = await users_collection.insert_one(user_document_to_insert)
        created_user_doc = await users_collection.find_one(
            {"_id": insert_result.inserted_id}
        )

        if not created_user_doc:
            logger.error(
                f"Không thể truy xuất người dùng sau khi chèn cho ID {insert_result.inserted_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể truy xuất người dùng sau khi tạo.",
            )
        # THAY ĐỔI: Trả về instance UserPublic, wrapper sẽ xử lý việc đóng gói
        return UserPublic.model_validate(created_user_doc)
    except Exception as e:
        logger.error(
            f"Lỗi không mong muốn trong quá trình chèn người dùng cho {user_data.email}: {e}",
            exc_info=True,
        )
        # Ném lại HTTPException để wrapper có thể định dạng nó
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Đã xảy ra lỗi không mong muốn trong quá trình tạo người dùng.",
        )


# Read a single user by ID
@router.get(
    "/{user_id}",
    response_model=UserPublic,
    summary="Read a single user by ID",
    tags=["users"],
)
async def read_user(
    user_id: str, db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db"))
):
    users_collection = db.get_collection("users")

    user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )

    return user_doc


# Update a user by ID
@router.put(  # Or @router.patch for partial updates
    "/{user_id}",
    response_model=UserPublic,
    summary="Update a user by ID",
    tags=["users"],
)
async def update_user(
    user_id: str,
    user_update_data: UserUpdate,  # Assumes UserUpdate schema is defined and imported
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    users_collection = db.get_collection("users")

    # Get data to update, excluding unset fields to allow partial updates
    update_data = user_update_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided."
        )

    # If email is being updated, check for duplicates
    if "email" in update_data:
        existing_user_with_new_email = await users_collection.find_one(
            {"email": update_data["email"], "_id": {"$ne": ObjectId(user_id)}}
        )
        if existing_user_with_new_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{update_data['email']}' is already in use by another user.",
            )

    updated_result = await users_collection.update_one(
        {"_id": ObjectId(user_id)}, {"$set": update_data}
    )

    updated_user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
    if (updated_user_doc is None) or (updated_result.matched_count == 0):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )

    return updated_user_doc


# Delete a user by ID
@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a user by ID",
    tags=["users"],
)
async def delete_user(
    user_id: str, db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db"))
):
    users_collection = db.get_collection("users")

    delete_result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    if delete_result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )

    return None


# Read multiple users
@router.get(
    "/",
    response_model=List[UserPublic],  # Response will be a list of UserPublic objects
    summary="Read multiple users",
    tags=["users"],
)
async def read_users(
    skip: int = 0,  # Query parameter for pagination: number of records to skip
    limit: int = 100,  # Query parameter for pagination: maximum number of records to return
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    users_collection = db.get_collection("users")

    # Fetch users with skip and limit for pagination
    user_docs_cursor = users_collection.find().skip(skip).limit(limit)
    user_docs = await user_docs_cursor.to_list(length=limit)  # Convert cursor to list

    processed_users = []
    for doc in user_docs:
        processed_users.append(doc)

    return processed_users
