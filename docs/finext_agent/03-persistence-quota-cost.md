# 03 — Bước 3: Persistence · Quota · Mô Hình Chi Phí

> **Vai trò trong lộ trình:** phần "sổ sách" — lưu hội thoại, đếm tiền, chặn cháy ví. Không có bước này agent vẫn chat được, nhưng **không được phép go-live thiếu nó** (kill-switch là điều kiện cứng).
> **Phụ thuộc:** bước 2 (loop emit usage). Làm song song được với bước 4.
> Giá API verify 2026-07-12 từ [trang pricing chính thức](https://platform.claude.com/docs/en/about-claude/pricing).

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| Pattern per-user data trong `user_db` (watchlists: crud + router + indexes trong `database.py`) | ✅ copy pattern |
| `chat_conversations` / `chat_messages` / `chat_quota` | ❌ chưa có |
| Env budget/limit | ❌ chưa có (bước 5 khai báo) |
| Số quota cụ thể | ❓ owner chốt sau 2 tuần chạy nhóm nhỏ — đề xuất ở §4 |

## 2. Persistence (`user_db` — KHÔNG phải `agent_db`)

> **Schema chi tiết + bộ nhớ cá nhân hoá + prune/governance: [`08-database-design-memory.md`](08-database-design-memory.md)** — file đó là nguồn sự thật DB; mục này giữ mức tổng quan.

`agent_db` = kiến thức thị trường read-only dùng chung; hội thoại = dữ liệu user → `user_db`, theo đúng pattern watchlists. Giữ nguyên thiết kế spec cũ (vẫn đúng với v2, chỉ `tool_calls` giờ lưu query thay vì tool name cố định):

```
user_db.chat_conversations: { _id, user_id, title, created_at, updated_at, msg_count }
user_db.chat_messages:      { _id, conversation_id, user_id, role, content,
                              tool_calls?: [{name, args_summary, ok, ms}],  // audit + render chip khi xem lại
                              usage?: {in, out}, interrupted?, created_at }
Indexes (database.py, cùng block user_db):
  chat_conversations: (user_id, updated_at desc)
  chat_messages:      (conversation_id, created_at)
```

- `args_summary` = bản rút gọn của query (collection + khoá filter), **không lưu full filter** nếu chứa văn bản dài — đủ audit, gọn DB.
- Lifecycle: user message lưu TRƯỚC stream; assistant message lưu lúc `done` (partial khi abort, flag `interrupted`). Server chết giữa chừng → còn user msg trống reply → FE render "Thử lại".
- Prune: giữ 50 hội thoại gần nhất/user — xoá lố khi tạo mới, khỏi TTL.
- REST phụ (không stream): `GET /conversations` · `GET /conversations/{id}` · `DELETE /conversations/{id}` — router pattern sẵn có.
- Lưu message theo **schema trung lập** (không format provider) → đổi model giữa chừng, hội thoại cũ vẫn tiếp tục.

## 3. Chọn Model — nguyên tắc vendor-free + kịch bản giá tham chiếu

**✅ ĐÃ CHỐT (owner): không khoá vendor.** Model/provider là biến env; kiến trúc tương thích mọi API chuẩn OpenAI-compat (file 02 §6). Chọn model cụ thể = chạy eval (file 07 §2) trên 2-3 ứng viên + so giá — và đổi được bất kỳ lúc nào (3 env vars, không sửa code).

**Tiêu chí chọn model bắt buộc** (không thoả = loại, dù rẻ mấy):
1. Tool calling ổn định qua nhiều vòng (viết query Mongo JSON đúng cú pháp — đây là kỹ năng sống còn của mô hình model-tự-viết-query).
2. Tiếng Việt tự nhiên + giữ kỷ luật đơn vị/số liệu.
3. Streaming + tool-call streaming qua endpoint OpenAI-compat.
4. Chính sách dữ liệu: không train trên API data (verify từng nhà — điều kiện NĐ 13, file 09 §2).
5. Có prompt caching càng tốt — tác động chi phí lớn (xem dưới).

**Kịch bản giá THAM CHIẾU** (Claude API 2026-07 — chỉ để hình dung bậc giá và làm mốc so sánh; dùng nhà nào thay số nhà đó):

| Model tham chiếu | Input | Output | Cache read | Ghi chú |
|---|---|---|---|---|
| Sonnet 5 | $2/MTok (khuyến mãi đến 31/08/2026, sau đó $3) | $10 → $15 | 0.1× input | bậc "thông minh vừa, giá vừa" |
| Haiku 4.5 | $1 | $5 | 0.1× input | bậc rẻ — rủi ro viết query phức tạp kém hơn |
| Opus 4.8 | $5 | $25 | 0.1× input | bậc đắt — chỉ khi eval chứng minh cần |

**Hai biến làm chi phí lệch MẠNH giữa các provider (quan trọng hơn giá niêm yết):**
- **Prompt caching mỗi nhà mỗi kiểu:** Anthropic explicit (read = 0.1×), OpenAI tự động (~50% phần trùng prefix), Gemini context-caching thuê theo giờ, nhiều nhà nhỏ **không có caching**. Hệ thống này có ~11k tok system lặp mọi lượt → **không caching thì chi phí/lượt tăng ~2.5-4×**. Luật so sánh: so "giá có cache theo profile sử dụng của mình", không so giá niêm yết.
- **Tokenizer mỗi nhà mỗi khác** (tiếng Việt lệch mạnh; VD tokenizer Sonnet 5 +~30% so đời trước): đo pack bằng đúng tokenizer/endpoint đếm token của model chốt, không dùng số ước của nhà khác.

## 4. Quota — 3 Lớp Chặn Tiền (giữ thiết kế spec cũ, đã đúng)

| Lớp | Cơ chế | Đề xuất v1 |
|---|--------|-----------|
| 1. Per-user | `user_db.chat_quota {user_id, date, msg_count, tok_in, tok_out}` — upsert `$inc` mỗi lượt (Mongo counter: sống qua restart, đúng với 2 workers) | 60 msg/ngày, 6 msg/phút |
| 2. Global kill-switch | tổng token/ngày > `AGENT_DAILY_TOKEN_BUDGET` → chat trả "AI tạm nghỉ hôm nay" — **fail-closed** | budget theo §5 |
| 3. Concurrency | semaphore in-process/user (tối đa 2 stream/user với 2 workers — chấp nhận) | 1 stream/user/worker |

Quota fail → JSON lỗi thường TRƯỚC khi stream mở (429) → FE hiện thân thiện. Gating v1: mọi user đăng nhập (nhóm đã curate bằng admin-approval). Điểm cắm tương lai: feature key `agent_feature` gắn license — hạ tầng features sẵn có, KHÔNG build ở v1 (khớp agent_db_v2 §1.5 "nội bộ trước, bán sau" + điểm cắm tier ở gateway v2 §7.2).

## 5. Mô Hình Chi Phí — Ước Tính Có Nhãn (±40%, KỊCH BẢN THAM CHIẾU: Sonnet 5 giá khuyến mãi + có cache read 0.1× — provider khác thay số theo §3)

Ngân sách token/lượt (đã cộng ~30% tokenizer mới vào các khối văn bản):

| Khối | Tok ước | Cache? |
|---|---|---|
| System pack (~7k đo tokenizer cũ → cộng dự phòng tokenizer) | 9.000 | ✅ read từ lượt 2 |
| Briefing core (đo thật ~320 tok — agent_db_v2 §4; + dự phòng) | ~500 | ✅ đổi theo vòng ghi |
| Tool schemas (3 tools, gọn) + tool-use system prompt | ~800 | ✅ |
| History (10 msg) + câu hỏi | ~3.000 | một phần |
| Tool results (2-3 query × ~1-2k) | ~4.000 | ❌ |
| **Input/lượt** | **~17k** (trong đó ~10k cache-read) | |
| Output | ~1.000 | |

Chi phí/lượt ≈ uncached 7k×$2 + cached 10k×$0.2 + out 1k×$10 ≈ **$0.026/lượt (~700đ)**.
Kịch bản 10 user × 20 lượt/ngày ≈ $5.2/ngày ≈ **~$160/tháng (~4tr VND)**. ⚠️ Cùng khối lượng đó trên provider **không có caching**: ~$0.07-0.10/lượt → ~$450-600/tháng — minh hoạ vì sao caching là tiêu chí chọn nhà (§3). 2 việc bắt buộc: (1) `AGENT_DAILY_TOKEN_BUDGET` đặt ban đầu **4M tok** ≈ mức full-nhóm dự kiến/ngày (vòng 1-2 dùng thấp hơn nhiều — dư địa an toàn nằm ở đó), siết/nới theo số thật sau 2 tuần; (2) giá provider đổi theo thời gian (VD Sonnet 5 hết khuyến mãi 31/08/2026 = +50%) → review giá theo quý (file 07 §5).

**Việc phải làm trước go-live:** đo pack thật với đúng model đã chọn — số 9k ở trên là ước, không được chốt budget bằng số ước. Cách đo phổ quát cho MỌI provider (nhiều nhà không có endpoint count-tokens): gửi 1 request thật chứa đúng system prompt + đọc `usage.prompt_tokens` trong response — chính xác tuyệt đối, tốn vài xu.

## 6. Rủi Ro & Xử Lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | Bug tool loop chạy hoang đốt token (lý do tồn tại của kill-switch, kể cả khi user ít) | Lớp 2 fail-closed + alert khi ngày nào chạm 70% budget (log WARN — bước 5 ops) |
| R2 | Cache miss nhiều hơn dự kiến (chat ngắt quãng >5 phút TTL) | chấp nhận — write 1.25× không đau; KHÔNG dùng cache 1h (2× write chỉ lời khi phiên rất dài); đo `cache_read_input_tokens` trong usage thật rồi quyết lại |
| R3 | Usage từ provider không khớp cách mình đếm | tin số usage của API (`usage` trong response) — đó là số bị tính tiền; counter của mình chỉ để quota |
| R4 | User xoá hội thoại nhưng muốn "xoá hẳn" (privacy) | DELETE conversation xoá cả messages (không soft-delete) — nhóm nội bộ, đơn giản là đúng |
| R5 | Đổi model làm chi phí đổi bậc mà quota tính theo msg không phản ánh | budget lớp 2 tính bằng TOKEN không phải msg — tự miễn nhiễm |

## 7. Điều Kiện Hoàn Thành Bước 3

- [ ] pytest CRUD hội thoại + prune 50 + quota: lượt 61 trong ngày → 429.
- [ ] Kill-switch test thật: set budget thấp → chat trả "AI tạm nghỉ hôm nay" (fail-closed, không âm thầm gọi tiếp).
- [ ] Usage ghi vào `chat_messages.usage` khớp số `usage` provider trả.
- [ ] Đã đo pack + briefing bằng `count_tokens` với model chốt; budget đặt theo số đo.
