from fastapi import APIRouter

router = APIRouter()

@router.get("/{item_id}")
async def read_item(item_id: int, query_param: str | None = None):
    """
    Đọc một item dựa trên item_id.
    Bạn cũng có thể truyền một query_param tùy chọn.
    """
    return {"item_id": item_id, "query_param": query_param}

# Bạn có thể thêm các endpoint khác liên quan đến items ở đây
# Ví dụ:
# @router.post("/")
# async def create_item(item: dict): # Nên sử dụng Pydantic model ở đây
#     return {"message": "Item created successfully", "item_data": item}
