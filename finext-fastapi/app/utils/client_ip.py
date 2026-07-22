# finext-fastapi/app/utils/client_ip.py
"""Xác định IP client khi đứng sau nginx, chống spoof qua header."""

from fastapi import Request


def get_client_ip(request: Request) -> str:
    """Lấy IP thực của client khi đứng sau nginx/proxy.

    Ưu tiên X-Real-IP: nginx GHI ĐÈ header này bằng $remote_addr ở mọi location
    nên client không giả được. X-Forwarded-For dùng $proxy_add_x_forwarded_for
    (append) nên phần tử ĐẦU là do client tự gửi — không được tin. Chỉ đọc phần
    tử CUỐI của XFF khi thiếu X-Real-IP, vì đó là IP do proxy tin cậy thêm vào.
    Trả "Unknown" nếu không xác định được.

    Lưu ý: request.client.host KHÔNG đáng tin ở đây — uvicorn chạy với
    --forwarded-allow-ips "*" nên nó đã bị ghi đè bằng XFF[0] do client gửi.
    """
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "Unknown"
