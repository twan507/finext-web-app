# finext-fastapi/app/utils/response_wrapper.py
import functools
import logging
from typing import TypeVar, Generic, Optional, Any, Callable, Awaitable, Tuple, List, Dict

from fastapi import HTTPException, Request  # Thêm Request
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
        async def wrapper(request: Request, *args, **kwargs) -> Response: # Thêm request vào wrapper
            try:
                # Lọc ra request nếu nó có trong kwargs, để không truyền 2 lần
                func_kwargs = kwargs.copy()
                if 'request' in func_kwargs:
                     del func_kwargs['request']

                # Truyền request vào hàm gốc nếu nó chấp nhận
                # Điều này không bắt buộc, nhưng hữu ích nếu hàm gốc cần request
                # Tuy nhiên, cách an toàn nhất là không truyền trừ khi biết chắc
                # Thay vào đó, chúng ta sẽ cần request để xử lý exception.

                result = await func(*args, **kwargs)

                cookies_to_set: Optional[List[Dict[str, Any]]] = None
                data_to_return: Any = result

                # Kiểm tra nếu kết quả trả về là tuple (data, cookies)
                if isinstance(result, tuple) and len(result) == 2 and (result[1] is None or isinstance(result[1], list)):
                    data_to_return = result[0]
                    cookies_to_set = result[1]

                if success_status_code == http_status.HTTP_204_NO_CONTENT:
                    response = Response(status_code=http_status.HTTP_204_NO_CONTENT)
                    # Vẫn có thể set cookie cho 204 nếu cần (ví dụ: logout)
                    if cookies_to_set:
                        for cookie_params in cookies_to_set:
                            response.set_cookie(**cookie_params)
                    return response

                response_payload = StandardApiResponse(
                    status=success_status_code,
                    message=default_success_message,
                    data=data_to_return,
                )
                
                response = JSONResponse(
                    status_code=success_status_code,
                    content=response_payload.model_dump(mode="json", exclude_none=False),
                )

                # Set cookies nếu có
                if cookies_to_set:
                    for cookie_params in cookies_to_set:
                        response.set_cookie(**cookie_params)
                
                return response

            except HTTPException as he:
                logger.warning( # Đổi thành warning hoặc info
                    f"Xử lý HTTPException trong {func.__name__}: {he.status_code} - {he.detail} cho request: {request.method} {request.url}"
                )
                error_response_payload = StandardApiResponse[Any](
                    status=he.status_code,
                    message=str(he.detail),
                    data=None,
                )
                response = JSONResponse(
                    status_code=he.status_code,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                )
                # Kiểm tra xem có cần xóa cookie khi có lỗi 401 không (Tùy chọn)
                # if he.status_code == http_status.HTTP_401_UNAUTHORIZED and 'refresh' in str(he.detail).lower():
                #    response.delete_cookie(REFRESH_TOKEN_COOKIE_NAME, ...)
                return response
                
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
        
        # Sửa lại wrapper để chấp nhận `request`
        # Cần đảm bảo rằng khi gọi wrapper, FastAPI có thể inject `request`
        # Điều này thường tự động xảy ra nếu decorator được áp dụng cho route handler
        # Nhưng chúng ta cần đảm bảo wrapper có `request` trong signature.
        # Tuy nhiên, việc thay đổi signature của wrapper có thể phức tạp.
        # Cách tiếp cận đơn giản hơn là *không* thêm `request` vào wrapper
        # và chỉ xử lý exception như hiện tại.
        # Chúng ta sẽ giữ nguyên signature hiện tại và *không* thêm request.
        # Wrapper sẽ *không* log request URL, nhưng sẽ xử lý cookie.

        @functools.wraps(func)
        async def wrapper_without_request(*args, **kwargs) -> Response: # Giữ signature cũ
            try:
                result = await func(*args, **kwargs)

                cookies_to_set: Optional[List[Dict[str, Any]]] = None
                cookies_to_delete: Optional[List[str]] = None
                data_to_return: Any = result

                # Kiểm tra tuple (data, cookies_set, cookies_delete)
                if isinstance(result, tuple):
                    if len(result) == 3:
                         data_to_return, cookies_to_set, cookies_to_delete = result
                    elif len(result) == 2:
                         data_to_return, cookies_to_set = result


                if success_status_code == http_status.HTTP_204_NO_CONTENT:
                    response = Response(status_code=http_status.HTTP_204_NO_CONTENT)
                else:
                    response_payload = StandardApiResponse(
                        status=success_status_code,
                        message=default_success_message,
                        data=data_to_return,
                    )
                    response = JSONResponse(
                        status_code=success_status_code,
                        content=response_payload.model_dump(mode="json", exclude_none=False),
                    )

                if cookies_to_set:
                    for cookie_params in cookies_to_set:
                        response.set_cookie(**cookie_params)
                
                if cookies_to_delete:
                    for cookie_name in cookies_to_delete:
                         # Cần cung cấp domain và path nếu chúng được set lúc tạo
                         from app.core.config import COOKIE_DOMAIN
                         response.delete_cookie(cookie_name, domain=COOKIE_DOMAIN, path="/")


                return response

            except HTTPException as he:
                logger.warning(f"Xử lý HTTPException trong {func.__name__}: {he.status_code} - {he.detail}")
                error_response_payload = StandardApiResponse[Any](
                    status=he.status_code,
                    message=str(he.detail),
                    data=None,
                )
                response = JSONResponse(
                    status_code=he.status_code,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                )
                return response
            except Exception as e:
                logger.error(f"Exception không được xử lý trong {func.__name__}: {e}", exc_info=True)
                error_response_payload = StandardApiResponse[Any](
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message="Đã xảy ra lỗi máy chủ nội bộ.",
                    data=None,
                )
                return JSONResponse(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                )
        return wrapper_without_request
    return decorator