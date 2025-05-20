# Finext - Dự Án FastAPI

Đây là một dự án API được xây dựng bằng FastAPI.

## Mục lục

- [Yêu cầu](#yêu-cầu)
- [Hướng dẫn Bắt đầu](#hướng-dẫn-bắt-đầu)
  - [1. Thiết lập Môi trường Ảo](#1-thiết-lập-môi-trường-ảo)
  - [2. Kích hoạt Môi trường Ảo](#2-kích-hoạt-môi-trường-ảo)
  - [3. Cài đặt các Gói Phụ thuộc](#3-cài-đặt-các-gói-phụ-thuộc)
- [Cấu trúc Dự án](#cấu-trúc-dự-án)
- [Chạy Ứng dụng](#chạy-ứng-dụng)
- [Truy cập API](#truy-cập-api)
- [Dừng Ứng dụng](#dừng-ứng-dụng)
- [Thoát Môi trường Ảo](#thoát-môi-trường-ảo)
- [Cấu hình Biến Môi trường](#cấu-hình-biến-môi-trường)


## Yêu cầu

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt:

- Python 3.7+
- `pip` (thường đi kèm với Python)
- `venv` (thường đi kèm với Python)
- `python-dotenv` (để quản lý biến môi trường)
- `pymongo[srv]` (driver MongoDB)

## Hướng dẫn Bắt đầu

### 1\. Thiết lập Môi trường Ảo

Chúng tôi khuyến khích sử dụng môi trường ảo để quản lý các gói phụ thuộc một cách riêng biệt cho dự án. Trong thư mục gốc của dự án, chạy lệnh sau để tạo một môi trường ảo có tên là `venv`:

```bash
python -m venv venv
```

### 2\. Kích hoạt Môi trường Ảo

Sau khi tạo, bạn cần kích hoạt môi trường ảo:

```bash
.\venv\Scripts\activate
```

*Lưu ý:* Nếu bạn gặp lỗi về Execution Policy trên PowerShell, hãy thử chạy lệnh `Set-ExecutionPolicy Unrestricted -Scope Process` trong PowerShell đó trước, sau đó thử kích hoạt lại.

Sau khi kích hoạt thành công, bạn sẽ thấy tên môi trường ảo (ví dụ: `(venv)`) xuất hiện ở đầu dòng lệnh của bạn.

### 3\. Cài đặt các Gói Phụ thuộc

Khi môi trường ảo đã được kích hoạt, hãy cài đặt các gói cần thiết (nếu cần):

```bash
pip install fastapi uvicorn[standard] python-dotenv pymongo[srv]
```

Sau đó tạo/cập nhật tệp `requirements.txt`:
```bash
pip freeze > requirements.txt
```

Nếu bạn clone dự án đã có sẵn tệp `requirements.txt`, bạn chỉ cần chạy lệnh sau để cài đặt tất cả các gói phụ thuộc:
```bash
pip install -r requirements.txt
```

## Cấu trúc Dự án

Dự án được cấu trúc như sau để dễ dàng quản lý và mở rộng:

```
finext-fastapi/
├── app/
│   ├── __init__.py
│   ├── main.py           # Điểm khởi tạo ứng dụng FastAPI chính
│   ├── core/             # Các module cốt lõi (cấu hình, db, v.v.)
│   │   ├── __init__.py
│   │   ├── config.py     # Tải và quản lý cấu hình/biến môi trường
│   │   └── database.py   # Logic kết nối và tương tác với MongoDB
│   ├── routers/          # Chứa các modules router cho các nhóm API
│   │   ├── __init__.py
│   │   ├── items.py      # Ví dụ: router cho các API liên quan đến 'items'
│   │   └── auth.py       # Router cho các API liên quan đến xác thực
│   └── schemas/          # Chứa các Pydantic models (data shapes)
│       ├── __init__.py
│       └── auth.py       # Schemas liên quan đến xác thực
├── venv/                 # Thư mục môi trường ảo (được gitignore)
├── .env                  # File chứa biến môi trường (được gitignore)
├── .env.example          # File ví dụ cho .env
├── .gitignore            # Chỉ định các file/thư mục bỏ qua bởi Git
├── requirements.txt      # Danh sách các gói phụ thuộc
└── readme.md             # Tài liệu hướng dẫn này
```

## Chạy Ứng dụng

Đầu tiên cần kích hoạt môi trường ảo

```bash
.\venv\Scripts\activate
```

Sau đó reload ứng dụng

```bash
uvicorn app.main:app --reload
```

  - `app.main`: Chỉ đến tệp `main.py` trong thư mục `app`.
  - `app`: Tên của đối tượng FastAPI instance trong tệp `main.py`.
  - `--reload`: Tự động tải lại máy chủ khi có thay đổi trong mã nguồn (rất hữu ích trong quá trình phát triển).

Máy chủ sẽ khởi động, thường là trên `http://127.0.0.1:8000`.
Khi khởi động, ứng dụng sẽ cố gắng kết nối tới MongoDB dựa trên cấu hình trong tệp `.env`.

## Truy cập API

Khi máy chủ đang chạy, bạn có thể truy cập các điểm cuối sau qua trình duyệt web hoặc công cụ API (như Postman, Insomnia):

  - **Ứng dụng gốc:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
  - **API Items (ví dụ):** [http://127.0.0.1:8000/items/1](http://127.0.0.1:8000/items/1)
  - **API Xác thực (NextAuth Callback):** `POST` [http://127.0.0.1:8000/auth/login/nextauth-callback](http://127.0.0.1:8000/auth/login/nextauth-callback)
    - Endpoint này được thiết kế để NextAuth gọi sau khi xác thực người dùng thành công qua `CredentialsProvider`.
    - Body yêu cầu (JSON):
      ```json
      {
        "userId": "string",
        "email": "user@example.com (optional)",
        "name": "string (optional)"
      }
      ```
    - Phản hồi thành công (JSON):
      ```json
      {
        "access_token": "string (FastAPI JWT)",
        "token_type": "bearer",
        "user_info": {
          "userId": "string",
          "email": "user@example.com (optional)",
          "name": "string (optional)"
        }
      }
      ```
  - **Tài liệu API tương tác (Swagger UI):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
  - **Tài liệu API thay thế (ReDoc):** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## Dừng Ứng dụng

Để dừng máy chủ phát triển Uvicorn, quay lại cửa sổ terminal nơi máy chủ đang chạy và nhấn:

`CTRL+C`

## Thoát Môi trường Ảo

Khi bạn làm việc xong với dự án, bạn có thể thoát khỏi môi trường ảo bằng cách chạy lệnh sau trong terminal:

```bash
deactivate
```

## Cấu hình Biến Môi trường

Dự án này sử dụng tệp `.env` để quản lý các biến môi trường. Điều này giúp giữ cho các thông tin nhạy cảm (như chuỗi kết nối cơ sở dữ liệu) không bị đưa vào mã nguồn.

1.  **Tạo tệp `.env`**:
    Sao chép tệp `.env.example` và đổi tên thành `.env` trong thư mục gốc của dự án.
    ```bash
    cp .env.example .env
    ```
    (Hoặc tạo thủ công tệp `.env`)

2.  **Cấu hình `MONGODB_CONNECTION_STRING`**:
    Mở tệp `.env` và cập nhật giá trị của `MONGODB_CONNECTION_STRING` bằng chuỗi kết nối MongoDB của bạn.
    Ví dụ:
    ```
    MONGODB_CONNECTION_STRING="mongodb://localhost:27017/mydatabase"
    ```
    Hoặc nếu sử dụng MongoDB Atlas:
    ```
    MONGODB_CONNECTION_STRING="mongodb+srv://<username>:<password>@<cluster-url>/<database_name>?retryWrites=true&w=majority"
    ```

Tệp `.env` đã được thêm vào `.gitignore` để đảm bảo nó không được commit lên repository.