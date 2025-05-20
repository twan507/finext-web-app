from fastapi import FastAPI

# Tạo một instance của FastAPI
app = FastAPI()

# Định nghĩa một route cơ bản
@app.get("/")
async def read_root():
    return {"message": "Xin chào, đây là dự án FastAPI đầu tiên của tôi!"}

@app.get("/items/{item_id}")
async def read_item(item_id: int, query_param: str | None = None):
    return {"item_id": item_id, "query_param": query_param}