import boto3
from botocore.client import Config as BotoConfig, BaseClient
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
import logging
from typing import IO, Optional, Any

# Import các biến cấu hình trực tiếp từ module config của bạn
from app.core import config

# Khởi tạo logger
logger = logging.getLogger(__name__)

# Biến global để giữ S3 client, được khởi tạo một lần
_s3_client: Optional[BaseClient] = None

def init_s3_client():
    """
    Khởi tạo S3 client nếu chưa có.
    Hàm này sẽ được gọi khi module được load hoặc khi get_s3_client được gọi lần đầu.
    """
    global _s3_client
    if _s3_client is not None:
        return

    # Kiểm tra xem tất cả các biến cấu hình R2 cần thiết đã được thiết lập chưa
    if not all([config.R2_ENDPOINT_URL, config.R2_ACCESS_KEY_ID, config.R2_SECRET_ACCESS_KEY, config.R2_BUCKET_NAME, config.R2_PUBLIC_URL_BASE]):
        logger.error(
            "Cloudflare R2 settings are not fully configured. "
            "Please check R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "
            "R2_BUCKET_NAME, and R2_PUBLIC_URL_BASE in your environment variables or .env file."
        )
        _s3_client = None # Đảm bảo client là None nếu thiếu config
        return

    try:
        _s3_client = boto3.client(
            service_name="s3",
            endpoint_url=config.R2_ENDPOINT_URL,
            aws_access_key_id=config.R2_ACCESS_KEY_ID,
            aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
            region_name="auto",  # Đối với R2, 'auto' thường được sử dụng
            config=BotoConfig(signature_version='s3v4') # Quan trọng cho nhiều S3 compatible storages
        )
        logger.info("S3 client for Cloudflare R2 initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize S3 client for R2: {e}")
        _s3_client = None # Đảm bảo client là None nếu có lỗi khởi tạo

# Gọi hàm khởi tạo khi module này được import lần đầu
init_s3_client()

def get_s3_client() -> BaseClient:
    """
    Trả về S3 client đã được khởi tạo.
    Dùng làm FastAPI dependency.
    """
    global _s3_client # Cần khai báo global để có thể gán lại nếu cần
    if _s3_client is None:
        logger.warning("S3 client was not initialized. Attempting re-initialization.")
        init_s3_client() # Thử khởi tạo lại
        if _s3_client is None: # Nếu vẫn là None sau khi thử lại
            logger.error("S3 client could not be initialized. Storage operations will fail.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage service is not available due to configuration or connection error."
            )
    return _s3_client

async def upload_file_to_r2(
    file_object: IO[bytes],
    object_name: str,
    content_type: Optional[str] = None,
    acl: str = "public-read"
) -> str:
    """
    Tải một đối tượng file lên R2 bucket và trả về URL công khai.

    :param file_object: Đối tượng file (ví dụ: await UploadFile.read() hoặc file.file).
    :param object_name: Tên mong muốn của object trong R2 (bao gồm cả đường dẫn).
    :param content_type: Kiểu MIME của file.
    :param acl: ACL cho object (ví dụ: 'public-read').
    :return: URL công khai của file đã tải lên.
    :raises HTTPException: Nếu việc tải lên thất bại.
    """
    s3 = get_s3_client() # Lấy client

    extra_args: dict[str, Any] = {}
    if content_type:
        extra_args['ContentType'] = content_type
    
    if acl:
        extra_args['ACL'] = acl

    try:
        # Đảm bảo con trỏ file ở đầu, đặc biệt quan trọng nếu file_object là UploadFile.file
        if hasattr(file_object, 'seek') and callable(file_object.seek):
            file_object.seek(0)

        s3.upload_fileobj(
            Fileobj=file_object,
            Bucket=config.R2_BUCKET_NAME, # Sử dụng biến config trực tiếp
            Key=object_name,
            ExtraArgs=extra_args
        )
        logger.info(f"File {object_name} uploaded successfully to bucket {config.R2_BUCKET_NAME}.")
        
        # Xây dựng URL công khai
        # The S3 client initialization logic in get_s3_client() should ensure R2_PUBLIC_URL_BASE is set.
        # This assertion helps the type checker and guards against unexpected None values.
        assert config.R2_PUBLIC_URL_BASE is not None, \
            "R2_PUBLIC_URL_BASE must be configured if S3 client initialization succeeded."
        public_url_base = config.R2_PUBLIC_URL_BASE.rstrip('/')
        clean_object_name = object_name.lstrip('/')
        public_url = f"{public_url_base}/{clean_object_name}"
        return public_url
        
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        error_message = e.response.get("Error", {}).get("Message", str(e))
        logger.error(f"Failed to upload {object_name} to R2. Error Code: {error_code}. Message: {error_message}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not upload file to R2: {error_message}"
        )
    except Exception as e:
        logger.error(f"An unexpected error occurred during R2 upload of {object_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while uploading the file."
        )

