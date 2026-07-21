# 03 — Bước 3: Persistence · Quota · Mô Hình Chi Phí

> **Vai trò trong lộ trình:** phần "sổ sách" — lưu hội thoại, đếm usage và áp quota. Global kill-switch là tùy chọn cấu hình và hiện mặc định tắt; không mô tả nó như lớp bảo vệ đang bật.
> **Phụ thuộc:** bước 2 (loop emit usage). Làm song song được với bước 4.
> Giá API verify 2026-07-12 từ [trang pricing chính thức](https://platform.claude.com/docs/en/about-claude/pricing).
> **Snapshot as-built 2026-07-21:** persistence và quota đã triển khai. Repo `.env.production` cấu hình MiniMax-M3 (không phải default code/xác nhận deploy live); quota đếm **đơn vị quy đổi theo chi phí** trong cửa sổ anchored 5 giờ + 7 ngày, theo license.

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| `chat_conversations` / `chat_messages` / `chat_quota` + indexes | ✅ Có trong `crud/chat.py` và `core/database.py` |
| REST list/detail/pin/rename/delete/feedback/quota | ✅ Có dưới `/api/v1/chat/*` |
| Env budget/limit/giá | ✅ Có trong `core/config.py` |
| Quota hiện hành | ✅ Standard 4M/5h + 40M/tuần; advanced ×5; MANAGER/ADMIN unlimited |
| Global kill-switch | Có code nhưng **mặc định tắt** (`AGENT_DAILY_TOKEN_BUDGET=0`) |

## 2. Persistence (`user_db` — KHÔNG phải `agent_db`)

> **Schema chi tiết + bộ nhớ cá nhân hoá + prune/governance: [`08-database-design-memory.md`](08-database-design-memory.md)** — file đó là nguồn sự thật DB; mục này giữ mức tổng quan.

`agent_db` = kiến thức thị trường read-only dùng chung; hội thoại = dữ liệu user → `user_db`, theo đúng pattern watchlists. Giữ nguyên thiết kế spec cũ (vẫn đúng với v2, chỉ `tool_calls` giờ lưu query thay vì tool name cố định):

```
user_db.chat_conversations: { _id, user_id:ObjectId, title, pinned,
                              created_at, updated_at, msg_count }
user_db.chat_messages:      { _id, conversation_id, user_id, role, content,
                              tool_calls?: [{name, args_summary, ok, ms}],  // audit + render chip khi xem lại
                              usage?: {in, out}, interrupted?, created_at }
Indexes (database.py, cùng block user_db):
  chat_conversations: (user_id, updated_at desc)
  chat_messages:      (conversation_id, created_at)
                      (user_id, created_at desc)
```

- `args_summary` hiện lưu **label tool chip** từ `tool_start`, không chứa full query/filter; tên field giữ từ thiết kế cũ nhưng không phải query summary đầy đủ.
- Lifecycle: user message lưu trước stream; assistant chỉ lưu khi collector đã thấy `done`. Abort/error không lưu partial assistant; user message trống reply vẫn còn để FE retry.
- Hội thoại mới lấy 60 ký tự đầu làm title tạm, rồi best-effort gọi model non-thinking để đổi title sau lượt đầu (`title` event). User có thể pin/rename/delete.
- Prune: giữ 50 hội thoại **không ghim** mới nhất/user; hội thoại ghim miễn prune nên tổng thực tế có thể >50. Xoá cascade messages.
- REST: `GET /quota`, `GET /conversations`, `GET /conversations/{id}`, `PATCH .../pin`, `PATCH .../rename`, `PATCH /messages/{id}/feedback`, `DELETE /conversations/{id}`.
- Lưu message theo **schema trung lập** (không format provider) → đổi model giữa chừng, hội thoại cũ vẫn tiếp tục.

## 3. Chọn Model — nguyên tắc vendor-free + kịch bản giá tham chiếu

**Snapshot repo:** `.env.production` cấu hình `LLM_BASE_URL=https://api.minimax.io/v1`, `LLM_MODEL=MiniMax-M3`; `LLM_API_STYLE` không đặt nên code dùng default `openai`. `LLM_THINKING` default code là `disabled`. Đây không phải bằng chứng container live; đổi model/provider vẫn phải chạy lại eval.

**Tiêu chí chọn model bắt buộc** (không thoả = loại, dù rẻ mấy):
1. Tool calling ổn định qua nhiều vòng (viết query Mongo JSON đúng cú pháp — đây là kỹ năng sống còn của mô hình model-tự-viết-query).
2. Tiếng Việt tự nhiên + giữ kỷ luật đơn vị/số liệu.
3. Streaming + tool-call streaming qua wire OpenAI-compatible hoặc Anthropic Messages-compatible.
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

## 4. Quota as-built — cửa sổ anchored theo license

| Lớp | Cơ chế hiện hành | Default code |
|---|--------|-----------|
| 1. Per-user | Một doc/user: `{user_id, s5_start, s5_tokens, wk_start, wk_tokens}`; cửa sổ mở ở lượt đầu và reset sau 5h/7d | standard 4.000.000 / 40.000.000 đơn vị |
| 2. License tier | `resolve_tier()` đọc subscription đang hiệu lực, không dựa role trực tiếp | PATRON/PARTNER advanced ×5; MANAGER/ADMIN unlimited; còn lại standard |
| 3. Global | Doc sentinel `user_id="__global__"`, cửa sổ 24h; request mới trả 503 khi đã chạm trần | `AGENT_DAILY_TOKEN_BUDGET=0` ⇒ **tắt** |
| 4. Cảnh báo | Sau `done`, nếu lượt vừa vượt mốc 50% hoặc 75% của 5h/tuần thì emit `quota_warn` | bật cố định; không nhắc lại cùng mốc |

`billable_units = ceil(uncached_input + cached_input × PRICE_CACHED/PRICE_INPUT + output × PRICE_OUTPUT/PRICE_INPUT)`. Default giá: input 0,30 · cache-read 0,06 · output 1,20 USD/MTok, nên tương đương `uncached + 0,2×cached + 4×output`. `usage.in` luôn bao gồm phần cache-read; adapter Anthropic cộng `input_tokens + cache_read_input_tokens` để khớp quy ước.

Quota fail → JSON lỗi thường **trước khi mở stream**: 429 cho cửa sổ user, 503 cho global. Usage chỉ cộng sau `done`, không reserve trước, nên một lượt rất lớn có thể vượt trần rồi lượt kế tiếp mới bị chặn. Code hiện không có semaphore/concurrency limit per-user.

## 5. Mô Hình Chi Phí

**Số đo hiện hành từ eval thật 2026-07-20:** một lượt điển hình khoảng **130.000 đơn vị quy đổi ≈ 0,039 USD** với bảng giá MiniMax-M3 mặc định nói trên; 10 user × 8 lượt/ngày ≈ 94 USD/tháng. Đây là số đo có ngày, không phải SLA. Quota standard 4M/5h tương đương khoảng 30 lượt điển hình; advanced cao gấp 5.

### Kịch bản ước tính lịch sử 2026-07-12 (giữ để truy vết, không phải config hiện hành)

Ngân sách token/lượt (đã cộng ~30% tokenizer mới vào các khối văn bản):

| Khối | Tok ước | Cache? |
|---|---|---|
| System pack (~7k đo tokenizer cũ → cộng dự phòng tokenizer) | 9.000 | ✅ read từ lượt 2 |
| Briefing core (đo thật ~320 tok — agent_db_v2 §4; + dự phòng) | ~500 | ✅ đổi theo vòng ghi |
| Tool schemas (thiết kế lúc đó: 3 tools) + tool-use system prompt | ~800 | ✅ |
| History (10 msg) + câu hỏi | ~3.000 | một phần |
| Tool results (2-3 query × ~1-2k) | ~4.000 | ❌ |
| **Input/lượt** | **~17k** (trong đó ~10k cache-read) | |
| Output | ~1.000 | |

Ước tính lịch sử khi đó: uncached 7k×$2 + cached 10k×$0.2 + out 1k×$10 ≈ **$0.026/lượt (~700đ)**.
Kịch bản lịch sử: 10 user × 20 lượt/ngày ≈ $5.2/ngày ≈ **~$160/tháng (~4tr VND)**. Không dùng con số này để cấu hình runtime hiện tại. `AGENT_DAILY_TOKEN_BUDGET` hiện mặc định 0 chứ không phải 4M.

**Việc phải làm trước go-live:** đo pack thật với đúng model đã chọn — số 9k ở trên là ước, không được chốt budget bằng số ước. Cách đo phổ quát cho MỌI provider (nhiều nhà không có endpoint count-tokens): gửi 1 request thật chứa đúng system prompt + đọc `usage.prompt_tokens` trong response — chính xác tuyệt đối, tốn vài xu.

## 6. Rủi Ro & Xử Lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | Bug tool loop chạy hoang đốt token | Loop có MAX_ITERS=10, dừng sau 2 vòng toàn-fail/600k token; global kill-switch chỉ bảo vệ thêm nếu owner đặt env >0. Alert 70% chưa có code. |
| R2 | Cache miss nhiều hơn dự kiến (chat ngắt quãng >5 phút TTL) | chấp nhận — write 1.25× không đau; KHÔNG dùng cache 1h (2× write chỉ lời khi phiên rất dài); đo `cache_read_input_tokens` trong usage thật rồi quyết lại |
| R3 | Usage từ provider không khớp cách mình đếm | tin số usage của API (`usage` trong response) — đó là số bị tính tiền; counter của mình chỉ để quota |
| R4 | User xoá hội thoại nhưng muốn "xoá hẳn" (privacy) | DELETE conversation xoá cả messages (không soft-delete) — nhóm nội bộ, đơn giản là đúng |
| R5 | Đổi model/giá làm quota lệch chi phí thật | cập nhật đồng bộ `LLM_PRICE_INPUT/CACHED/OUTPUT`; quota đếm đơn vị quy đổi, không đếm message |

## 7. Điều Kiện Hoàn Thành Bước 3

- [x] CRUD, prune (kể cả pinned), quota 5h/tuần/tier/timezone/cảnh báo có pytest.
- [x] Usage mọi vòng LLM được cộng dồn, lưu ở assistant message và quy đổi bằng `billable_units()`.
- [x] `/profile/ai-usage` đọc `GET /api/v1/chat/quota` và chỉ hiển thị phần trăm/∞.
- [ ] Job dọn `chat_quota` 90 ngày chưa có; hiện collection chỉ có một doc/user + một sentinel global nên không tăng theo ngày.
- [ ] Alert global budget 70% chưa có; nếu bật kill-switch phải test trên môi trường deploy.
