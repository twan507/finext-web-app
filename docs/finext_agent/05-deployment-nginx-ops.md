# 05 — Bước 5: Deploy · Nginx · Vận Hành

> **Vai trò trong lộ trình:** đưa agent vào hạ tầng production hiện có mà **không thêm container, không thêm process thường trực** — ràng buộc cứng của VPS 8GB (Mongo ~1.5-2G + MSSQL 1.5G + OS ~1G + web ~3.3G).
> **Phụ thuộc:** bước 2 chạy được ở dev. Nginx làm được ngay từ pha skeleton.

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| Nginx block SSE mẫu (`location /api/v1/sse/`: no-buffer, no-gzip, timeout dài) | ✅ copy đổi path |
| Quy ước env 2 tier (`.env.development` / `.env.production` root) | ✅ |
| `database.py` connect nhiều db | ✅ thêm `agent_db` |
| Nginx block `/api/v1/chat/` · env `LLM_*`/`AGENT_*` · cách sync pack vào image | ❌ chưa có |

## 2. Nginx — copy block SSE, đổi path

Thêm `location /api/v1/chat/` cạnh block SSE: `proxy_buffering off` · `proxy_cache off` · `gzip off` · `chunked_transfer_encoding off` · `proxy_read_timeout 10m` · giữ nguyên bộ header như block SSE hiện có. Hai fact đã kiểm chứng từ spec cũ (vẫn đúng):

- `proxy_read_timeout` tính theo **khoảng lặng giữa 2 lần đọc**, không phải tổng thời gian stream — heartbeat 10s đã trị tận gốc; 10m là belt-and-suspenders.
- Backend vẫn set `X-Accel-Buffering: no` + `Cache-Control: no-cache` trên response (như `sse.py`) — phòng mọi lớp proxy ở giữa, kể cả khi ai đó sau này sửa nginx config.

## 3. Env Vars Mới (khai báo trong `core/config.py`, pydantic-settings)

| Biến | Ví dụ | Ghi chú |
|---|---|---|
| `LLM_PROVIDER` | `openai_compat` (mặc định — adapter duy nhất v1) | chừa chỗ cho adapter native tương lai |
| `LLM_MODEL` | model id theo provider (`deepseek-chat` / `gpt-…` / `claude-…` / model self-host) | đổi nhà = đổi 3 biến này, không sửa code |
| `LLM_API_KEY` | `sk-...` | secret — CHỈ backend, không bao giờ chạm FE/nextjs |
| `LLM_BASE_URL` | URL endpoint OpenAI-compat của nhà đã chọn | **bắt buộc** với openai_compat |
| `LLM_MAX_OUTPUT_TOKENS` | `1200` | |
| `AGENT_MAX_ITERS` | `8` | |
| `AGENT_DAILY_MSG_LIMIT` | `60` | per user |
| `AGENT_DAILY_TOKEN_BUDGET` | `4000000` | kill-switch fail-closed (file 03 §5) |
| `AGENT_GATEWAY` | `mongo` \| `fixture` | fixture bị refuse nếu ENV=production |
| `GATEWAY_EXPLAIN_MODE` | `on` \| `off` | công tắc heuristic (file 01 R2) |
| `AGENT_PACK_DIR` | `/app/agent_pack` | thư mục pack đã build |

Thiếu `LLM_API_KEY` lúc startup → router chat tự disable (trả 503 "chưa cấu hình") thay vì crash app — web chính không được chết vì agent.

## 4. Đưa Knowledge Pack Vào Container — Options

| | Option A (khuyến nghị) | Option B | Option C |
|---|---|---|---|
| Cách | **Copy vào image lúc build** (`COPY agent_pack/ /app/agent_pack/`) — pack sync vào repo web bằng script/submodule trước khi build | Volume mount từ host | Đọc từ Mongo (collection `agent_pack`) |
| Ưu | Version pack gắn chặt version image — rollback image là rollback pack | Đổi pack không cần rebuild | Đổi pack không cần đụng host |
| Nhược | Đổi pack = rebuild+redeploy (~vài phút) | Version trôi khỏi git image; quên mount là chết | Thêm 1 nơi giữ sự thật, ngược triết lý "pack versioned theo git" |
| Chọn khi | Mặc định | Giai đoạn tinh chỉnh prompt dày đặc (eval tuần đầu) — mount tạm rồi quay về A | Không khuyến nghị |

## 5. Tải & RAM — vì sao yên tâm, và ngưỡng phải để mắt

- Agent sống trong container fastapi: mỗi stream ~vài chục KB state + 1 HTTPS outbound; LLM là I/O — không chiếm worker (async bắt buộc, file 02).
- Mongo: mọi query gateway là indexed point-read trên `agent_db` ~285MB dataSize (31 collections — agent_db_v2 §1); phần NÓNG thực tế (snapshot/briefing/phase/news gần đây) nhỏ hơn nhiều và nằm gọn WiredTiger cache — khối `history_*` chiếm phần lớn dung lượng nhưng chỉ bị chạm theo point-read có `$slice`. Ca nặng nhất (doc history 488KB + `$slice`) vẫn 1-doc read.
- **Ngưỡng cảnh giác:** nếu container fastapi vượt ~1.2G RSS (limit 1.5G) sau khi bật agent → nghi leak ở SDK/httpx connection pool; xử lý: giới hạn pool size + restart định kỳ là băng cứu thương, tìm leak là việc thật. Nếu VPS tổng thể căng → phương án cuối: tách gateway thành service trên VPS phụ (chính là nâng lên Option B của file 01 — kiến trúc đã chừa đường).

## 6. Observability — tối thiểu nhưng đủ điều tra

- **Log hygiene (điều kiện cứng):** KHÔNG log nội dung hội thoại ở INFO — chỉ `{request_id, user_id, msg_count, usage, tool_names/collections, ms, error_type}`. Nội dung nằm trong `chat_messages` có access control, không nằm trong docker logs.
- Gateway log mỗi query (file 01) cùng `request_id` → trace được 1 lượt chat xuyên router → loop → gateway.
- Metrics tối thiểu (log-based, chưa cần Prometheus): lượt/ngày · token in/out/ngày (so budget) · tỷ lệ `tool_end ok=false` · tỷ lệ chạm MAX_ITERS · p95 thời gian lượt. Xem bằng `docker compose logs` + grep là đủ cho quy mô nhóm.
- Alert thô: cron nội bộ (APScheduler sẵn có, gated fcntl) mỗi giờ check budget ngày ≥70% → gửi mail owner (hạ tầng mail sẵn).

## 7. Rủi Ro Vận Hành & Xử Lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | Deploy nginx sai → stream bị buffer (chữ ra thành cục) | test bằng `curl -N` qua nginx dev TRƯỚC khi code FE; đây là verify của pha skeleton |
| R2 | fnx05 ghi DB đúng lúc user chat (torn-read) | pipeline đã chống (as-built, v2 §2): temp→rename atomic per-collection, index tạo trên temp, doc `core` ghi CUỐI làm commit marker, phase mirror giữ bản cũ khi nguồn thiếu + agent chú thích staleness. Web KHÔNG cần làm gì thêm ngoài truyền `as_of` |
| R3 | Provider outage | đổi 3 env vars sang **nhà dự phòng ĐÃ QUA EVAL** (danh sách 1 chính + 1 dự phòng, file 07 §5); hoặc tắt tạm router (503) — web chính không ảnh hưởng |
| R4 | Restart container giữa các stream đang chạy | message partial đã lưu (file 03) — chấp nhận, FE có "Thử lại". Deploy giờ thấp điểm |
| R5 | Key API rò rỉ | key chỉ ở env backend; thiệt hại chặn bằng kill-switch budget; rotate key = đổi env + restart |

## 8. Điều Kiện Hoàn Thành Bước 5

- [ ] `curl -N` qua nginx (dev + prod) thấy token nhả từng dòng, heartbeat khi im lặng.
- [ ] Thiếu `LLM_API_KEY` → app vẫn lên, `/api/v1/chat/*` trả 503, mọi route khác bình thường.
- [ ] Pack nằm trong image, `AGENT_PACK_DIR` đọc được; đổi pack + rebuild có version mới trong log startup.
- [ ] Alert budget 70% test được (hạ budget → nhận mail).
- [ ] Grep log 1 `request_id` ra được chuỗi đầy đủ: router → loop → từng query gateway → done.
