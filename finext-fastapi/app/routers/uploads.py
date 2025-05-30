import uuid
import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from PIL import Image
from bson import ObjectId 
from app.core.database import get_database
from app.auth.dependencies import get_current_active_user
from app.schemas.users import UserPublic
from app.schemas.uploads import UploadCreate, UploadInDB, UploadResponse, UploadPublic, UploadKey
from app.utils.storage import upload_file_to_r2
from app.auth.access import require_permission
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper

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
    
    Args:
        image_bytes: Dữ liệu ảnh gốc
        content_type: MIME type của ảnh
        target_size: Kích thước mục tiêu (bytes)
    
    Returns:
        tuple: (compressed_image_bytes, final_content_type)
    """
    try:
        # Mở ảnh bằng PIL
        image = Image.open(io.BytesIO(image_bytes))
        
        # Chuyển đổi RGBA sang RGB nếu cần (cho JPEG)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Tạo background trắng cho ảnh có transparency
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        elif image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')
        
        # Kích thước gốc
        original_width, original_height = image.size
        
        # Thử nén với chất lượng khác nhau
        for quality in [95, 85, 75, 65, 55, 45, 35, 25]:
            # Tính toán kích thước mới dựa trên chất lượng
            scale_factor = min(1.0, (quality / 100) * 1.5)  # Giảm kích thước khi chất lượng thấp
            new_width = int(original_width * scale_factor)
            new_height = int(original_height * scale_factor)
            
            # Resize ảnh nếu cần
            if scale_factor < 1.0:
                resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            else:
                resized_image = image
            
            # Nén ảnh
            output_buffer = io.BytesIO()
            
            # Luôn save dưới dạng JPEG để có kích thước nhỏ nhất
            resized_image.save(
                output_buffer, 
                format='JPEG', 
                quality=quality,
                optimize=True,
                progressive=True
            )
            
            compressed_bytes = output_buffer.getvalue()
            
            # Kiểm tra kích thước
            if len(compressed_bytes) <= target_size:
                return compressed_bytes, "image/jpeg"
        
        # Nếu vẫn không đạt được kích thước mục tiêu, giảm resolution nhiều hơn
        for scale in [0.8, 0.6, 0.4, 0.3, 0.2]:
            new_width = int(original_width * scale)
            new_height = int(original_height * scale)
            
            resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            output_buffer = io.BytesIO()
            resized_image.save(
                output_buffer, 
                format='JPEG', 
                quality=25,
                optimize=True,
                progressive=True
            )
            
            compressed_bytes = output_buffer.getvalue()
            
            if len(compressed_bytes) <= target_size:
                return compressed_bytes, "image/jpeg"
        
        # Trường hợp cuối cùng: trả về ảnh đã nén tối đa
        final_image = image.resize((200, 200), Image.Resampling.LANCZOS)
        output_buffer = io.BytesIO()
        final_image.save(
            output_buffer, 
            format='JPEG', 
            quality=20,
            optimize=True
        )
        
        return output_buffer.getvalue(), "image/jpeg"
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process image: {str(e)}"
        )

@router.post(
    "/image",
    summary="Upload image",
    description="Uploads an image file to Cloudflare R2 storage. Images are automatically compressed to under 1MB.",
    response_model=StandardApiResponse[UploadResponse],
    dependencies=[Depends(require_permission("upload", "create"))]
)
@api_response_wrapper(default_success_message="Tải ảnh lên thành công")
async def upload_image(
    current_user: Annotated[UserPublic, Depends(get_current_active_user)],
    upload_key: UploadKey,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    file: UploadFile = File(...)
):
    """
    Handles image file uploads with automatic compression.

    - Validates file size (max 5MB input) and type (images only).
    - Automatically compresses images to under 1MB.
    - Generates a unique filename.
    - Uploads the compressed file to Cloudflare R2.
    - Saves upload info to database.
    - Returns the public URL of the uploaded image.
    """
    # 1. Kiểm tra kích thước file đầu vào
    if file.size is not None and file.size > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds the limit of {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)}MB."
        )

    # 2. Kiểm tra loại file - chỉ cho phép ảnh
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Only image files are allowed: {', '.join(ALLOWED_IMAGE_TYPES)}."
        )

    try:
        # 3. Đọc dữ liệu ảnh gốc
        original_image_bytes = await file.read()
        original_size = len(original_image_bytes)
        
        # 4. Nén ảnh
        compressed_image_bytes, final_content_type = compress_image(
            original_image_bytes, 
            file.content_type or "image/jpeg"
        )
        compressed_size = len(compressed_image_bytes)
        
        # 5. Tạo tên file duy nhất
        object_name = f"images/{upload_key.value}/{uuid.uuid4()}"
        
        # 6. Upload file đã nén lên R2
        compressed_file_obj = io.BytesIO(compressed_image_bytes)
        public_url = await upload_file_to_r2(
            file_object=compressed_file_obj,
            object_name=object_name,
            acl="public-read"
        )

        # 7. Lưu thông tin upload vào database
        upload_data = UploadCreate(
            user_id=current_user.id,
            upload_key=upload_key,
            file_url=public_url,
            size=compressed_size,
            object_name=object_name
        )

        upload_in_db = UploadInDB(**upload_data.model_dump())
        
        # Chuyển đổi user_id thành ObjectId khi insert vào MongoDB
        upload_dict = upload_in_db.model_dump(by_alias=True, exclude={"id"})
        upload_dict["user_id"] = ObjectId(current_user.id)  # Chuyển đổi ở đây
        
        result = await db.uploads.insert_one(upload_dict)  # Sử dụng upload_dict thay vì upload_in_db.model_dump()
        
        # Lấy document vừa tạo
        created_upload = await db.uploads.find_one({"_id": result.inserted_id})
        if not created_upload:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve uploaded file information"
            )

        # 8. Trả về response với thông tin nén
        response_data = UploadPublic(**created_upload)
        
        return UploadResponse(
            data=response_data,
            message=f"Image uploaded and compressed successfully. Original: {original_size // 1024}KB, Compressed: {compressed_size // 1024}KB"
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while uploading image: {str(e)}"
        )
    finally:
        await file.close()