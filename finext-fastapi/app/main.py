from fastapi import FastAPI
from .routers import items, auth  # Import the auth router

# Tạo một instance của FastAPI
app = FastAPI()

app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(auth.router, prefix="/auth", tags=["authentication"])  # Add the auth router

# Định nghĩa một route cơ bản
@app.get("/")
async def read_root():
    return {"message": "Xin chào, đây là dự án FastAPI đầu tiên của tôi!"}