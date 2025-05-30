# Finext Web Application

Dự án Finext là một ứng dụng web full-stack với backend được xây dựng bằng FastAPI và frontend sử dụng Next.js.

## Công Nghệ Sử Dụng

### Backend (`finext-fastapi`)
* **Framework**: FastAPI
* **Ngôn ngữ**: Python 3.7+
* **Cơ sở dữ liệu**: MongoDB (với Motor cho thao tác bất đồng bộ)
* **Xác thực**: JWT (Access Token và Refresh Token qua HttpOnly Cookie)
* **Quản lý môi trường**: `venv`, `python-dotenv`

### Frontend (`finext-nextjs`)
* **Framework**: Next.js 15 (App Router)
* **Ngôn ngữ**: TypeScript
* **UI**: Material UI (MUI)
* **Quản lý theme**: `next-themes`
* **Định dạng code**: Prettier

---
## Hướng Dẫn Kích Hoạt

### Yêu Cầu
* Node.js và npm
* Python 3.7+ và pip
* MongoDB instance
* Docker và Docker Compose (tùy chọn)

### Backend (`finext-fastapi`)
1.  **Thiết lập môi trường ảo và cài đặt dependencies (dành cho lần đàu tiên):**
    - Tạo thư mục môi trường ảo (nếu chưa có)
    ```bash
    python -m venv venv
    ```
    - Kích hoạt môi trường ảo
    ```bash
    .\venv\Scripts\activate
    ```
    - Cài đặt các thư viện cần thiết
    ```bash
    pip install -r requirements.txt
    ```

    - Chạy ứng dụng
    ```bash
    uvicorn app.main:app --reload --env-file .\.env.development
    ```

    - Thoát môi trường ảo
    ```bash
    deactivate
    ```
   
2.  **Cập nhật `requirements.txt` (nếu có thay đổi thư viện):**
    Sau khi cài đặt hoặc gỡ bỏ các gói, bạn có thể cập nhật lại file `requirements.txt`:
    ```bash
    pip freeze > requirements.txt
    ```
   
3.  **Cấu hình biến môi trường:** Sao chép `finext-fastapi/.env.example` thành `finext-fastapi/.env` và cập nhật.

4.  **Chạy server (Từ lần thứ 2 trở đi):**
    ```bash
    python main.py              # Chạy server
    python main.py run          # Chạy server
    python main.py venv         # Tạo môi trường ảo
    python main.py install      # Cài đặt dependencies
    ```

    Server chạy tại `http://127.0.0.1:8000`.

### Frontend (`finext-nextjs`)
1.  **Cài đặt dependencies:**
    ```bash
    npm install
    ```
   
2.  **Cấu hình biến môi trường:** Tạo `finext-nextjs/.env` với `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`.
3.  **Chạy server development:**
    ```bash
    npm run dev
    ```
   
    Ứng dụng chạy tại `http://localhost:3000`.

### Docker (Tùy chọn)
1.  **Cấu hình biến môi trường:** Tạo file `.env.production` ở thư mục gốc của dự án (nơi chứa `docker-compose.yml`).
2.  **Build và chạy container:**
    ```bash
    docker-compose up --build
    ```
   

---
## Tài Liệu API (Backend)

Khi backend FastAPI đang chạy, tài liệu API tự động có sẵn tại:

* **Swagger UI**: `http://127.0.0.1:8000/api/v1/docs`

## DeepWiki
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/twan507/finext-web-app)