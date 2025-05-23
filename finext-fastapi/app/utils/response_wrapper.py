# finext-fastapi/app/utils/response_wrapper.py
import functools
import logging
from typing import TypeVar, Generic, Optional, Any, Callable, Awaitable

from fastapi import HTTPException
from fastapi import status as http_status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DataT = TypeVar("DataT")


class StandardApiResponse(BaseModel, Generic[DataT]):
    status: int = Field(..., description="HTTP status code của response.")
    message: Optional[str] = Field(None, description="Một thông điệp mô tả về kết quả.")
    data: Optional[DataT] = Field(None, description="Payload dữ liệu thực tế cho các yêu cầu thành công.")


def api_response_wrapper(
    default_success_message: Optional[str] = "Thao tác thành công.",
    success_status_code: int = http_status.HTTP_200_OK,
):
    def decorator(func: Callable[..., Awaitable[Any]]):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Response:
            try:
                result_data = await func(*args, **kwargs)

                if isinstance(result_data, Response):
                    # Nếu hàm đã trả về một đối tượng Response hoàn chỉnh, dùng luôn nó
                    return result_data
                
                # SỬA ĐỔI QUAN TRỌNG Ở ĐÂY:
                # Chỉ trả về Response trống nếu success_status_code là HTTP_204_NO_CONTENT
                if success_status_code == http_status.HTTP_204_NO_CONTENT:
                    # Đối với 204, không nên có body, kể cả khi result_data là None
                    # và không cần default_success_message.
                    return Response(status_code=http_status.HTTP_204_NO_CONTENT)

                # Đối với các status code khác (bao gồm 200 OK),
                # tạo payload JSON chuẩn ngay cả khi result_data là None.
                response_payload = StandardApiResponse(
                    status=success_status_code,
                    message=default_success_message,
                    data=result_data  # data có thể là None, và sẽ bị bỏ qua nếu exclude_none=True
                )
                return JSONResponse(
                    status_code=success_status_code,
                    content=response_payload.model_dump(mode="json", exclude_none=False),
                )

            except HTTPException as he:
                logger.info(
                    f"Xử lý HTTPException trong {func.__name__}: {he.status_code} - {he.detail}"
                )
                error_response_payload = StandardApiResponse[Any](
                    status=he.status_code,
                    message=str(he.detail),
                    data=None,
                )
                return JSONResponse(
                    status_code=he.status_code,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                )
            except Exception as e:
                logger.error(
                    f"Exception không được xử lý trong {func.__name__}: {e}", exc_info=True
                )
                exception_message = "Đã xảy ra lỗi máy chủ nội bộ."
                error_response_payload = StandardApiResponse[Any](
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message=exception_message,
                    data=None,
                )
                return JSONResponse(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                )
        return wrapper
    return decorator