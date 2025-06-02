# finext-fastapi/app/schemas/common.py
from pydantic import BaseModel
from typing import List, TypeVar, Generic

DataType = TypeVar('DataType')

class PaginatedResponse(BaseModel, Generic[DataType]):
    items: List[DataType]
    total: int

    class Config: # Thêm Config cho Pydantic v1, hoặc model_config cho Pydantic v2
        # Pydantic v1:
        # orm_mode = True 
        # Pydantic v2:
        from_attributes = True # Nếu bạn dùng Pydantic v2 và muốn tạo model từ thuộc tính object

# Ví dụ sử dụng (không cần thêm vào file, chỉ để minh họa):
# from app.schemas.users import UserPublic
# class PaginatedUserResponse(PaginatedResponse[UserPublic]):
#     pass
#
# Hoặc trong router:
# async def list_users() -> PaginatedResponse[UserPublic]:
#    # ... logic
#    return PaginatedResponse[UserPublic](items=user_list, total=total_count)