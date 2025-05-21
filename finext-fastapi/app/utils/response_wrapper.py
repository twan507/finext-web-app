import functools
import logging
from typing import TypeVar, Generic, Optional, Any, Callable, Awaitable

from fastapi import HTTPException
from fastapi import status as http_status # Giữ nguyên alias này
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DataT = TypeVar('DataT')

class StandardApiResponse(BaseModel, Generic[DataT]):
    """
    Mô hình response API chuẩn.
    """
    # THAY ĐỔI: Bỏ 'success', thêm 'status'
    status: int = Field(..., description="HTTP status code của response.")
    message: Optional[str] = Field(None, description="Một thông điệp mô tả về kết quả.")
    data: Optional[DataT] = Field(None, description="Payload dữ liệu thực tế cho các yêu cầu thành công.")
    # error_code: Optional[str] = Field(None, description="Mã lỗi cụ thể, nếu có.")

def api_response_wrapper(
    default_success_message: Optional[str] = "Thao tác thành công.",
    success_status_code: int = http_status.HTTP_200_OK
):
    """
    Decorator để chuẩn hóa response của API.

    Args:
        default_success_message: Thông điệp mặc định khi thành công.
        success_status_code: HTTP status code cho response thành công.
    """
    def decorator(func: Callable[..., Awaitable[Any]]):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Response:
            try:
                result_data = await func(*args, **kwargs)

                if isinstance(result_data, Response):
                    return result_data
                
                if success_status_code == http_status.HTTP_204_NO_CONTENT:
                    return Response(status_code=http_status.HTTP_204_NO_CONTENT)

                response_payload = StandardApiResponse(
                    # THAY ĐỔI: Sử dụng success_status_code cho trường 'status'
                    status=success_status_code,
                    message=default_success_message,
                    data=result_data
                )
                return JSONResponse(
                    status_code=success_status_code, # HTTP status của response vẫn là success_status_code
                    content=response_payload.model_dump(mode='json', exclude_none=True)
                )

            except HTTPException as he:
                logger.info(f"Xử lý HTTPException trong {func.__name__}: {he.status_code} - {he.detail}")
                error_response_payload = StandardApiResponse[Any](
                    # THAY ĐỔI: Sử dụng he.status_code cho trường 'status'
                    status=he.status_code,
                    message=str(he.detail),
                    data=None
                )
                return JSONResponse(
                    status_code=he.status_code, # HTTP status của response là status_code của HTTPException
                    content=error_response_payload.model_dump(mode='json', exclude_none=True)
                )
            except Exception as e:
                logger.error(f"Exception không được xử lý trong {func.__name__}: {e}", exc_info=True)
                exception_message = "Đã xảy ra lỗi máy chủ nội bộ."
                # if settings.DEBUG:
                #    exception_message = f"Lỗi máy chủ nội bộ: {str(e)}"

                error_response_payload = StandardApiResponse[Any](
                    # THAY ĐỔI: Sử dụng HTTP_500_INTERNAL_SERVER_ERROR cho trường 'status'
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message=exception_message,
                    data=None
                )
                return JSONResponse(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, # HTTP status của response là 500
                    content=error_response_payload.model_dump(mode='json', exclude_none=True)
                )
        return wrapper
    return decorator