# finext-fastapi/app/utils/response_wrapper.py
import functools
import logging
from typing import TypeVar, Generic, Optional, Any, Callable, Awaitable, List, Dict

from fastapi import HTTPException
from fastapi import status as http_status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

# Assuming COOKIE_DOMAIN is defined in your app.core.config
# If not, you might need a more robust way to handle cookie domain for deletion
try:
    from app.core.config import COOKIE_DOMAIN
except ImportError:
    COOKIE_DOMAIN = None # Fallback if not defined, but deletion might be affected


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
                # The 'request: Request' argument is injected by FastAPI if the decorated function has it.
                # We don't need to explicitly handle it here unless we want to log its details,
                # which can be done in a middleware or directly in the endpoint if needed.
                result = await func(*args, **kwargs)

                cookies_to_set: Optional[List[Dict[str, Any]]] = None
                cookies_to_delete: Optional[List[str]] = None # List of cookie names to delete
                data_to_return: Any = result

                # Enhanced cookie handling: expecting (data, cookies_to_set_list, cookies_to_delete_list)
                if isinstance(result, tuple):
                    if len(result) == 3:
                         data_to_return, cookies_to_set, cookies_to_delete = result
                    elif len(result) == 2: # Backwards compatibility for (data, cookies_set)
                         data_to_return, cookies_to_set = result
                    # If only data is returned, cookies_to_set and cookies_to_delete remain None


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
                        # Use .model_dump(mode="json") for Pydantic v2
                        content=response_payload.model_dump(mode="json", exclude_none=False),
                    )

                if cookies_to_set:
                    for cookie_params in cookies_to_set:
                        response.set_cookie(**cookie_params)

                if cookies_to_delete:
                    for cookie_name in cookies_to_delete:
                         # Ensure domain and path are specified if they were during cookie creation
                         response.delete_cookie(
                             cookie_name,
                             domain=COOKIE_DOMAIN, # Use imported or configured domain
                             path="/" # Common path, adjust if needed
                         )
                return response

            except HTTPException as he:
                logger.warning(
                    f"Xử lý HTTPException trong {func.__name__}: {he.status_code} - {he.detail}"
                )
                error_response_payload = StandardApiResponse[Any](
                    status=he.status_code,
                    message=str(he.detail), # Specific message from HTTPException
                    data=getattr(he, "data", None), # Include extra data if HTTPException has it
                )
                response = JSONResponse(
                    status_code=he.status_code,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                    headers=getattr(he, "headers", None), # Preserve headers from HTTPException
                )
                # Example for deleting a specific cookie on auth failure, if needed
                # if he.status_code == http_status.HTTP_401_UNAUTHORIZED and 'refresh' in str(he.detail).lower():
                #     from app.core.config import REFRESH_TOKEN_COOKIE_NAME # Ensure import
                #     response.delete_cookie(REFRESH_TOKEN_COOKIE_NAME, domain=COOKIE_DOMAIN, path="/")
                return response

            except ValueError as ve:
                logger.warning(f"Xử lý ValueError trong {func.__name__}: {str(ve)}", exc_info=True)
                error_response_payload = StandardApiResponse[Any](
                    status=http_status.HTTP_400_BAD_REQUEST, # Or a more appropriate status
                    message=str(ve), # Use the specific message from ValueError
                    data=None,
                )
                return JSONResponse(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                )

            except Exception as e:
                logger.error(
                    f"Exception không được xử lý (ngoài HTTPEx & ValueErr) trong {func.__name__}: {str(e)}", exc_info=True
                )
                error_response_payload = StandardApiResponse[Any](
                    status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message=f"Lỗi máy chủ nội bộ: {str(e)}", # Return specific exception message
                    data=None,
                )
                return JSONResponse(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content=error_response_payload.model_dump(mode="json", exclude_none=False),
                )
        return wrapper
    return decorator