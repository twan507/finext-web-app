import uuid
import io
from typing import Annotated  # Make sure Annotated is imported

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from PIL import Image
from bson import ObjectId
from app.core.database import get_database
from app.auth.dependencies import get_current_active_user
from app.schemas.users import UserPublic  # Changed from UserInDB to UserPublic as per get_current_active_user
from app.schemas.uploads import UploadCreate, UploadInDB, UploadPublic, UploadKey
from app.utils.storage import upload_file_to_r2
from app.auth.access import require_permission
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
import app.crud.users as crud_users  # IMPORT USER CRUD
import logging  # IMPORT LOGGING

logger = logging.getLogger(__name__)  # INITIALIZE LOGGER
router = APIRouter()

# Định nghĩa kích thước file tối đa cho ảnh đầu vào (5MB)
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
# Kích thước file sau khi nén (1MB)
TARGET_COMPRESSED_SIZE = 1 * 1024 * 1024  # 1 MB

# Chỉ cho phép các loại file ảnh
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]


def compress_image(image_bytes: bytes, content_type: str, target_size: int = TARGET_COMPRESSED_SIZE) -> tuple[bytes, str]:
    """
    Nén ảnh để đạt kích thước mục tiêu.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            background.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
            image = background
        elif image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        original_width, original_height = image.size

        for quality in [95, 85, 75, 65, 55, 45, 35, 25]:
            scale_factor = min(1.0, (quality / 100) * 1.5)
            new_width = int(original_width * scale_factor)
            new_height = int(original_height * scale_factor)

            if scale_factor < 1.0:
                resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            else:
                resized_image = image

            output_buffer = io.BytesIO()
            resized_image.save(output_buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
            compressed_bytes = output_buffer.getvalue()
            if len(compressed_bytes) <= target_size:
                return compressed_bytes, "image/jpeg"

        for scale in [0.8, 0.6, 0.4, 0.3, 0.2]:
            new_width = int(original_width * scale)
            new_height = int(original_height * scale)
            resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            output_buffer = io.BytesIO()
            resized_image.save(output_buffer, format="JPEG", quality=25, optimize=True, progressive=True)
            compressed_bytes = output_buffer.getvalue()
            if len(compressed_bytes) <= target_size:
                return compressed_bytes, "image/jpeg"

        final_image = image.resize((200, 200), Image.Resampling.LANCZOS)
        output_buffer = io.BytesIO()
        final_image.save(output_buffer, format="JPEG", quality=20, optimize=True)
        return output_buffer.getvalue(), "image/jpeg"

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Failed to process image: {str(e)}")


@router.post(
    "/image",
    summary="Upload image",
    description="Uploads an image file to Cloudflare R2 storage. Images are automatically compressed to under 1MB. If 'upload_key' is 'avatars', the user's avatar_url will be updated.",
    response_model=StandardApiResponse[UploadPublic],
    dependencies=[Depends(require_permission("upload", "create"))],
)
@api_response_wrapper(default_success_message="Tải ảnh lên thành công và đã được tối ưu kích thước")
async def upload_image(
    current_user: Annotated[UserPublic, Depends(get_current_active_user)],
    upload_key: UploadKey,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    file: UploadFile = File(...),
):
    if file.size is not None and file.size > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds the limit of {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)}MB.",
        )
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Only image files are allowed: {', '.join(ALLOWED_IMAGE_TYPES)}.",
        )

    try:
        original_image_bytes = await file.read()

        compressed_image_bytes, final_content_type = compress_image(original_image_bytes, file.content_type or "image/jpeg")
        compressed_size = len(compressed_image_bytes)

        object_name = f"images/{upload_key.value}/{current_user.id}/{uuid.uuid4()}.jpg"

        compressed_file_obj = io.BytesIO(compressed_image_bytes)
        public_url = await upload_file_to_r2(file_object=compressed_file_obj, object_name=object_name, acl="public-read")

        upload_data = UploadCreate(
            user_id=current_user.id, upload_key=upload_key, file_url=public_url, size=compressed_size, object_name=object_name
        )
        upload_in_db = UploadInDB(**upload_data.model_dump())
        upload_dict = upload_in_db.model_dump(by_alias=True, exclude={"id"})
        upload_dict["user_id"] = ObjectId(current_user.id)
        result = await db.uploads.insert_one(upload_dict)
        created_upload_doc = await db.uploads.find_one({"_id": result.inserted_id})

        if not created_upload_doc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve uploaded file information")

        # Update user's avatar_url if upload_key is AVATARS
        if upload_key == UploadKey.AVATARS:
            avatar_updated = await crud_users.set_user_avatar(db, user_id=current_user.id, avatar_url=public_url)
            if not avatar_updated:
                logger.warning(f"Image uploaded to R2 for user {current_user.id} but failed to update user's avatar_url in DB.")

        response_data = UploadPublic(**created_upload_doc)
        return response_data

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error during image upload for user {current_user.email}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred while uploading image: {str(e)}"
        )
    finally:
        await file.close()
