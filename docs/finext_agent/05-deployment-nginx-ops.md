# 05 — Bước 5: Deploy · Nginx · Vận Hành

> **Vai trò trong lộ trình:** đưa agent vào hạ tầng production hiện có mà **không thêm container, không thêm process thường trực** — ràng buộc cứng của VPS 8GB (Mongo ~1.5-2G + MSSQL 1.5G + OS ~1G + web ~3.3G).
> **Phụ thuộc:** bước 2 chạy được ở dev. Nginx làm được ngay từ pha skeleton.
> **Snapshot as-built 2026-07-21:** Nginx block `/api/v1/chat/`, `agent_db` connection, config env và KB trong image đều đã có trong repo. Phần chưa thể xác nhận từ code là deploy/curl production, alert budget và retention job.

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| Nginx block `/api/v1/chat/`: no-buffer/no-cache/no-gzip/read timeout 10m | ✅ Đã có trong `nginx/nginx.conf` |
| Quy ước env 2 tier (`.env.development` / `.env.production` root) | ✅ |
| `core/database.py` connect `user_db`, `stock_db`, `agent_db` | ✅ |
| Config `LLM_*`, gateway, quota/price + pack trong image | ✅ |
| Alert budget 70% / prune quota 90 ngày | ❌ Chưa có code |

## 2. Nginx — cấu hình hiện hành

`location /api/v1/chat/` đã nằm trước `/api/v1/`: `proxy_buffering off` · `proxy_cache off` · `gzip off` · `chunked_transfer_encoding off` · `proxy_read_timeout 10m`; bao cả SSE và REST chat. Backend cũng set `X-Accel-Buffering: no` + `Cache-Control: no-cache` cho stream.

- `proxy_read_timeout` tính theo **khoảng lặng giữa 2 lần đọc**, không phải tổng thời gian stream — heartbeat 10s đã trị tận gốc; 10m là belt-and-suspenders.
- Backend vẫn set `X-Accel-Buffering: no` + `Cache-Control: no-cache` trên response (như `sse.py`) — phòng mọi lớp proxy ở giữa, kể cả khi ai đó sau này sửa nginx config.

## 3. Env vars đúng theo `core/config.py`

| Biến | Ví dụ | Ghi chú |
|---|---|---|
| `LLM_MODEL` | repo `.env.production`: `MiniMax-M3` | bắt buộc; code không có default; không chứng minh deploy live |
| `LLM_API_KEY` | `sk-...` | chỉ FastAPI dùng trong code, nhưng Compose hiện nạp chung `.env.production` vào cả FastAPI, Next.js và nginx nên secret đang hiện diện thừa trong env của hai container kia; không được expose ra browser |
| `LLM_BASE_URL` | repo `.env.production`: `https://api.minimax.io/v1` | bắt buộc; không phải default code |
| `LLM_API_STYLE` | `openai` (default) \| `anthropic` | chọn adapter/wire |
| `LLM_TEMPERATURE` | unset | optional; unset = không gửi |
| `LLM_MAX_OUTPUT_TOKENS` | unset → 64000 trong loop | hard-coded fallback, không phải 1200 |
| `LLM_THINKING` | `disabled` default | router override `adaptive`/`disabled` theo toggle mỗi lượt |
| `LLM_REASONING_EFFORT` | `high` default | dùng khi adapter hỗ trợ thinking enabled |
| `AGENT_GATEWAY` | `mongo` default \| `fixture` | fixture chỉ log warning, **chưa có guard production** |
| `GATEWAY_EXPLAIN_MODE` | `off` default \| `on` | bật explain/COLLSCAN check cho collection lớn |
| `AGENT_PACK_DIR` | unset | đã khai báo nhưng runtime hiện chưa đọc biến này |
| `CHAT_MAX_CONVERSATIONS` | `50` | số hội thoại không-ghim giữ lại/user |
| `AGENT_TOKENS_5H` / `AGENT_TOKENS_WEEK` | 4.000.000 / 40.000.000 | đơn vị quy đổi standard |
| `AGENT_ADVANCED_MULT` | `5` | advanced multiplier |
| `AGENT_ADVANCED_LICENSES` | `PATRON,PARTNER` | default |
| `AGENT_UNLIMITED_LICENSES` | `MANAGER,ADMIN` | default |
| `AGENT_SESSION_HOURS` / `AGENT_WEEK_DAYS` | `5` / `7` | độ dài cửa sổ anchored |
| `AGENT_DAILY_TOKEN_BUDGET` | `0` | ≤0 = tắt global kill-switch |
| `LLM_PRICE_INPUT/CACHED/OUTPUT` | 0,30 / 0,06 / 1,20 | USD/MTok để quy đổi quota |

Không có `LLM_PROVIDER`, `AGENT_MAX_ITERS` hay `AGENT_DAILY_MSG_LIMIT`; `MAX_ITERS=10` nằm hard-coded trong loop. Thiếu base URL/key/model không làm app crash lúc startup; request chat mở SSE rồi `_produce()` bắt lỗi `build_adapter()` và phát event `error` in-band — **không phải 503 trước stream**.

## 4. Knowledge Pack trong container — as-built

Dockerfile `COPY ./app /code/app`, vì vậy `app/agent/kb/` đi cùng code/image và rollback image cũng rollback pack. Đây là phương án đang chạy; không có submodule, volume hay collection Mongo cho pack. `AGENT_PACK_DIR` chưa được nối vào `context.py`.

### Các options lịch sử (không phải cả ba đều đã triển khai)

| | Option A (khuyến nghị) | Option B | Option C |
|---|---|---|---|
| Cách | **Copy vào image lúc build** (`COPY agent_pack/ /app/agent_pack/`) — pack sync vào repo web bằng script/submodule trước khi build | Volume mount từ host | Đọc từ Mongo (collection `agent_pack`) |
| Ưu | Version pack gắn chặt version image — rollback image là rollback pack | Đổi pack không cần rebuild | Đổi pack không cần đụng host |
| Nhược | Đổi pack = rebuild+redeploy (~vài phút) | Version trôi khỏi git image; quên mount là chết | Thêm 1 nơi giữ sự thật, ngược triết lý "pack versioned theo git" |
| Chọn khi | Mặc định | Giai đoạn tinh chỉnh prompt dày đặc (eval tuần đầu) — mount tạm rồi quay về A | Không khuyến nghị |

## 5. Tải & RAM — vì sao yên tâm, và ngưỡng phải để mắt

- Agent sống trong container fastapi: mỗi stream ~vài chục KB state + 1 HTTPS outbound; LLM là I/O — không chiếm worker (async bắt buộc, file 02).
- Mongo: gateway chỉ cho các read đã whitelist/bounded trên `agent_db` ~285MB+ dataSize (33 collections — agent_db_v2 §1), nhưng không phải mọi call đều là indexed point-read: surface có aggregate và một số collection nhỏ cho phép đọc không filter. Các collection history lớn bị ép filter khoá + `$slice`; IXSCAN/COLLSCAN chỉ được kiểm bằng `explain()` khi `GATEWAY_EXPLAIN_MODE=on` (default `off`).
- **Ngưỡng cảnh giác:** nếu container fastapi vượt ~1.2G RSS (limit 1.5G) sau khi bật agent → nghi leak ở SDK/httpx connection pool; xử lý: giới hạn pool size + restart định kỳ là băng cứu thương, tìm leak là việc thật. Nếu VPS tổng thể căng → phương án cuối: tách gateway thành service trên VPS phụ (chính là nâng lên Option B của file 01 — kiến trúc đã chừa đường).

## 6. Observability — tối thiểu nhưng đủ điều tra

- **Log hygiene hiện hành:** không log nội dung hội thoại hoặc full filter/query ở INFO. Router log kết thúc stream với `request_id`/`user_id`; gateway log collection, thời gian, kích thước/trạng thái; loop log các nhánh lỗi/giới hạn. Usage được emit trong event `done` và lưu vào DB, **không được ghi vào Docker log**.
- Gateway dùng cùng `request_id`, nên log vẫn nối được stream với các query gateway mà không lộ nội dung câu hỏi.
- Từ `docker compose logs` hiện có thể đếm gần đúng lượt stream, xem query gateway/reject/error và lần chạm `MAX_ITERS`. Token in/out theo ngày, tỷ lệ `tool_end`, p95 end-to-end và chi phí cần đọc DB hoặc bổ sung metrics/log có cấu trúc; repo chưa có Prometheus/dashboard cho các số này.
- Alert budget 70% mới là đề xuất; hiện không có job APScheduler nào đọc `chat_quota`. Tương tự, policy privacy nói retention usage 90 ngày nhưng chưa có prune job quota.

## 7. Rủi Ro Vận Hành & Xử Lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | Deploy nginx sai → stream bị buffer (chữ ra thành cục) | test bằng `curl -N` qua nginx dev TRƯỚC khi code FE; đây là verify của pha skeleton |
| R2 | fnx05 ghi DB đúng lúc user chat (torn-read) | pipeline giảm rủi ro bằng temp→rename atomic per-collection, index trên temp, `core` ghi cuối và phase mirror. Runtime web hiện chưa trích/so sánh mốc giữa các tool result; SSE `meta.as_of` luôn null nên agent/FE chưa tự chú thích staleness. Muốn cảnh báo đầy đủ phải bổ sung propagation + comparison như file 01 R3 |
| R3 | Provider outage | đổi base URL/model/style/key sang nhà dự phòng đã qua eval. Repo chưa có feature flag trả 503 sạch; nếu cần tắt khẩn cấp phải ẩn UI và chặn route ở edge/deploy, còn bỏ key chỉ tạo SSE `error` in-band |
| R4 | Restart container giữa stream | assistant chỉ persist sau `done`, nên partial mất; user message đã lưu trước stream vẫn còn để retry. Deploy giờ thấp điểm. |
| R5 | Key API rò rỉ | code chỉ dùng key ở FastAPI, nhưng shared `env_file` hiện đưa key vào cả ba container. Rotate key = đổi env + restart; khi harden nên tách env theo service. Kill-switch global chỉ giảm thiệt hại nếu được bật (>0), hiện default tắt. |

## 8. Điều Kiện Hoàn Thành Bước 5

- [x] Nginx block chat no-buffer/no-gzip/read-timeout 10m có trong repo; backend heartbeat 10 giây.
- [x] Thiếu LLM config không làm app chết startup; chat phát lỗi in-band, route khác không phụ thuộc LLM.
- [x] Pack nằm trong image tại `app/agent/kb`; đổi pack cần rebuild/redeploy image.
- [ ] `curl -N` qua nginx production + kiểm heartbeat/provider cần chạy sau deploy.
- [ ] `AGENT_PACK_DIR` chưa hoạt động; không ghi nó như một deployment option hiện hữu.
- [ ] Alert budget 70% và prune quota 90 ngày chưa có.
- [ ] Chưa có dedicated feature kill-switch để trả 503 sạch khi tắt AI; bỏ key chỉ tạo SSE error in-band.
