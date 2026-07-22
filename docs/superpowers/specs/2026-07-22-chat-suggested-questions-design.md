# Gợi ý câu hỏi động ở màn hình chat rỗng

- Ngày: 22/07/2026
- Trạng thái: design đã chốt với owner, chưa implement

## 1. Mục tiêu

Khi user mở `/chat` và chưa có tin nhắn nào, hiện **5 câu hỏi gợi ý** ngay dưới ô nhập.
Câu hỏi do AI soạn sẵn, bám diễn biến thị trường trong phiên, **không cố định**.

Hai ràng buộc owner nêu rõ:

1. **Phải thấy ngay khi mở chat** — không chờ, không chớp, không nhảy layout.
2. **Sát diễn biến thị trường** — làm mới trong phiên, không phải nội dung tĩnh.

## 2. Quyết định đã chốt

| Vấn đề | Chốt | Lý do |
|---|---|---|
| Độ tươi | Sinh mỗi 30 phút trong giờ giao dịch | Owner chọn intraday |
| Phạm vi | Một tập CHUNG cho mọi user | 1 lần sinh dùng cho tất cả; chi phí không đổi theo số user |
| Nội dung | 2 toàn cảnh + 2 điểm nóng + 1 khám phá tính năng | Vừa dẫn dắt vừa cho user biết AI làm được gì |
| Sinh lúc nào | Cron (APScheduler sẵn có) | Đơn giản hơn sinh lười; không cần lock phân tán |
| Đưa xuống client | Server-side render | Nằm trong HTML lần paint đầu → thật sự "thấy ngay" |
| Lưu ở đâu | `user_db.chat_suggestions`, mỗi lần sinh một doc | Xem lại được lịch sử để tinh chỉnh prompt |

### Vì sao không phải các DB khác

- **`stock_db`**: app chỉ ĐỌC (grep `crud/sse/` cho 0 thao tác ghi). Dữ liệu do pipeline
  ngoài đổ vào; ghi vào đó phá vỡ ranh giới và có thể mất khi pipeline rebuild.
- **`agent_db`**: vùng gateway đọc theo `policy.agent_db.yaml`, cố ý read-only. Để gợi ý
  ở đó thì agent tự đọc lại gợi ý của chính nó — vòng lặp vô nghĩa.
- **`user_db`**: nơi app tự ghi, đã có họ `chat_conversations` / `chat_messages` /
  `chat_quota`. Thêm `chat_suggestions` là nhất quán.

## 3. Luồng dữ liệu

```
Cron 30' (giờ giao dịch)
  → gom snapshot thị trường (dùng lại fetcher SSE sẵn có, KHÔNG viết query mới)
  → 1 call LLM (không tool)
  → validate nghiêm
  → insert user_db.chat_suggestions
                                        ↓
chat/page.tsx (server component)
  → fetch /api/v1/sse/rest/chat_suggestions (revalidate 300s)
  → truyền props xuống PageContent
                                        ↓
SuggestedQuestions (dưới Composer, chỉ khi hội thoại rỗng)
  → click = điền + gửi luôn
```

## 4. Sinh gợi ý (backend)

### 4.1 Lịch chạy

Thêm job vào `app/core/scheduler.py`:

```python
CronTrigger(day_of_week="mon-fri", hour="8-15", minute="0,30")
```

16 lần/ngày làm việc. Scheduler đã có `timezone="Asia/Ho_Chi_Minh"` và leader lock
(`flock`) nên chỉ một worker chạy — không sinh trùng.

### 4.2 Nguồn dữ liệu cho prompt

Dùng lại fetcher trong `app/crud/sse/`, **không viết query mới**:

Chỉ dùng 3 nguồn, đều đã xác minh tên field trong code (không đoán):

| Keyword | Field dùng | Cho ra |
|---|---|---|
| `phase_signal` | `date`, `final_phase` | Trạng thái pha phiên mới nhất → câu toàn cảnh + câu khám phá tính năng |
| `home_today_stock` | `ticker`, `pct_change`, `industry_name` | Mã biến động mạnh **và** ngành đang nóng → câu điểm nóng |
| `news_daily` | `title` | Chủ đề đang được nói tới |

Ngành nóng suy ra từ `industry_name` của chính các mã biến động mạnh — bớt một query và
đảm bảo ngành luôn nhất quán với mã được nhắc.

Snapshot rút gọn trước khi vào prompt để prompt nhỏ và rẻ:

- `phase_signal`: chỉ `final_phase` của `date` lớn nhất.
- `home_today_stock`: 10 mã `pct_change` cao nhất + 10 mã thấp nhất; chỉ giữ `ticker`,
  `industry_name` và **chiều** biến động (tăng/giảm) — KHÔNG đưa giá trị số vào, xem §4.3.
- `news_daily`: 5 `title` mới nhất.

Tập `ticker` trong snapshot chính là allowlist để validate ở §4.4 bước 5.

> **Cập nhật 22/07/2026 sau khi chạy thật.** Bản đầu xếp hạng thuần theo `pct_change`
> trên toàn sàn nên gợi ý toàn mã lạ (DGT, HDA, PVO, HHG, SD3, HU4) — top biến động theo
> % gần như luôn là penny UPCOM/HNX thanh khoản thấp. Đã lọc `top100 == 1` (nhóm FNX100
> app đang hiển thị ở `/groups`) TRƯỚC khi xếp hạng; thiếu cờ đó thì rơi về 100 mã thanh
> khoản cao nhất phiên. Đồng thời siết allowlist validate từ ~1600 mã toàn sàn xuống
> ĐÚNG các mã đã đưa vào prompt.

### 4.3 Ràng buộc sinh

Prompt yêu cầu trả về **JSON array đúng 5 chuỗi**, tiếng Việt, và:

- Chỉ nhắc mã/ngành **có trong snapshot** được cung cấp.
- **Cấm con số tuyệt đối** (điểm số, giá, %) — đây là chống lệch số: gợi ý sinh lúc
  10h có thể hiển thị lúc 11h khi thị trường đã đổi chiều. "Vì sao nhóm thép giảm mạnh
  phiên nay?" an toàn; "VNINDEX giảm 12 điểm, vì sao?" thì không.
- **Cấm giọng khuyến nghị** — theo đúng lập trường compliance sẵn có của dự án.
- Mỗi câu là một câu hỏi hoàn chỉnh, 8–80 ký tự.

Gọi LLM qua `_complete()` trong `app/agent/loop.py` (một lượt, không tool) — cùng pattern
`generate_title` đang dùng.

### 4.4 Validate sau khi sinh

Đây là rào chắn quan trọng nhất. Nếu gợi ý dẫn tới câu agent không trả lời được thì
phản tác dụng — ấn tượng đầu hỏng hẳn.

Hàm thuần `validate_suggestions(raw, context) -> list[str] | None`:

1. Parse JSON; không parse được → `None`.
2. Đúng 5 phần tử, mỗi phần tử là chuỗi 8–80 ký tự, kết thúc bằng `?`.
3. Loại nếu chứa `%` hoặc số từ 3 chữ số trở lên (điểm số/giá → dễ lệch).
4. Loại nếu khớp cụm khuyến nghị: `có nên`, `khuyến nghị`, `nên mua`, `nên bán`,
   `giá mục tiêu`, `target giá`.
   *Lưu ý: KHÔNG cấm riêng từ "mua"/"bán" vì "khối ngoại mua ròng" là hợp lệ.*
5. Mọi token 3 ký tự in hoa (mã cổ phiếu) phải có trong snapshot đã đưa vào.

Trượt bất kỳ bước nào → **không publish**, log cảnh báo, giữ nguyên set cũ.
Không retry trong cùng nhịp; nhịp 30 phút sau tự thử lại.

### 4.5 Chi phí và quota

Job **không được** tính vào quota của bất kỳ user nào — họ không hỏi thì không trừ.

- Không gọi `crud_chat.record_usage(db, user_id, ...)`.
- Cộng thẳng vào bộ đếm global bằng `_bump_window(db, GLOBAL_QUOTA_KEY, "g_start",
  "g_tokens", ...)` để chi phí vẫn nhìn thấy được.
- Trước khi gọi LLM, job kiểm `AGENT_DAILY_TOKEN_BUDGET`: nếu đã cạn thì **bỏ nhịp**,
  không tiêu thêm.

16 call/ngày là không đáng kể so với trần 4M đơn vị/5h của một user.

## 5. Lưu trữ

Collection `user_db.chat_suggestions`, mỗi lần sinh một document:

```
{
  _id:          ObjectId,
  questions:    [str × 5],
  generated_at: datetime (UTC),
  context:      dict,     # snapshot đã đưa vào LLM — để chỉnh prompt về sau
  model:        str,      # LLM_MODEL lúc sinh
  usage:        dict,     # in/out/cache_read — theo dõi chi phí
  expires_at:   datetime  # generated_at + 7 ngày
}
```

Index thêm vào `app/core/database.py` (khối tạo index đã tách khỏi try kết nối nên
thêm index mới không còn rủi ro làm rụng DB):

- `generated_at` giảm dần — đọc bản mới nhất.
- TTL trên `expires_at`, `expireAfterSeconds=0` — tự dọn.

Đọc: `find_one({}, sort=[("generated_at", -1)])`.

**Đánh đổi đã biết**: nếu LLM lỗi liên tục quá 7 ngày, TTL xoá sạch kể cả set cuối còn
tốt → rơi xuống set tĩnh. Chấp nhận được, và cũng là tín hiệu có gì đó hỏng lâu rồi.

## 6. Phân phối

### 6.1 Endpoint

Thêm keyword `chat_suggestions` vào registry `app/crud/sse/__init__.py` → có sẵn
`GET /api/v1/sse/rest/chat_suggestions`, không phải viết router mới.

**Vì sao dùng registry công khai thay vì chat router**: SSR chạy server-side **không có
session user**; endpoint yêu cầu auth sẽ trả 401. Nội dung là câu hỏi thị trường chung,
không nhạy cảm, nên public là chấp nhận được. Endpoint cũng thừa hưởng gzip và rate
limit vừa cấu hình cho `/sse/rest/`.

Fetcher đọc `user_db` (khác các fetcher hiện tại đọc `stock_db`) — hợp lệ, chỉ cần
`get_database("user_db")`.

### 6.2 SSR

`finext-nextjs/app/(main)/chat/serverFetch.ts` theo đúng pattern `news/serverFetch.ts`:
native fetch tới `INTERNAL_API_URL`, `next: { revalidate: 300 }`, timeout 3 giây.

Gọi ở cả `chat/page.tsx` và `chat/[id]/page.tsx`, truyền prop xuống `PageContent`.

Revalidate 300s so với nhịp sinh 30 phút: user thấy set mới trong vòng 5 phút kể từ lúc
sinh. Đủ tươi, và không bắt mỗi request đi hỏi backend.

## 7. Hiển thị

Component mới `app/(main)/chat/components/SuggestedQuestions.tsx`, render **dưới
Composer** trong nhánh hội thoại rỗng (`PageContent.tsx:235-241`, trong khối
`gap: 4` đã có).

- Chỉ hiện khi `!hasMessages` — vào hội thoại là biến mất.
- Click = điền vào ô nhập **và gửi luôn** (một chạm tới giá trị).
- Danh sách dọc, mỗi dòng một câu, kèm icon nhỏ — theo tham chiếu ChatGPT owner đưa.
- Không có gợi ý → **không render gì**, khu vực co lại. Không hiện khung rỗng.

Lưu ý layout: `PageContent` có `emptyComposerTopRef` đo vị trí Composer để chạy hiệu ứng
khi gửi tin đầu. Thêm nội dung **dưới** Composer không ảnh hưởng phép đo đó vì nó đo
chính element Composer.

## 8. Chuỗi dự phòng

1. Set mới nhất trong DB.
2. Không có doc nào (lần đầu deploy / TTL đã dọn) → **hằng số tĩnh trong Python**,
   backend luôn trả về 5 câu an toàn không gắn thời điểm.
3. SSR fetch lỗi hoàn toàn (backend chết) → frontend **không render khu vực gợi ý**.

Không nhân bản danh sách tĩnh ở frontend: backend đã luôn trả về thứ dùng được, nên
frontend chỉ cần xử lý đúng một trường hợp "không có dữ liệu".

## 9. Kiểm thử

**Backend (test được, `uv run pytest`)**

- `validate_suggestions` là hàm thuần → phủ đủ: JSON hỏng, sai số lượng, quá dài/ngắn,
  chứa `%`, chứa số 3+ chữ số, dính cụm khuyến nghị, mã cổ phiếu không có trong snapshot,
  và một set hợp lệ đi qua được.
- Bảo đảm "mua ròng" KHÔNG bị loại nhầm — đây là bẫy dễ mắc.
- Fetcher trả hằng số tĩnh khi collection rỗng.
- Job bỏ nhịp khi budget global đã cạn.

**Frontend**

Repo chưa có React testing library nên **không unit test được component**. Chỉ tsc +
build. Ghi nhận thẳng giới hạn này thay vì giả vờ có phủ.

## 10. Ngoài phạm vi

- Cá nhân hoá theo watchlist (owner chốt dùng tập chung).
- Theo dõi click/analytics để đo gợi ý nào hiệu quả.
- Gợi ý nối tiếp giữa cuộc hội thoại (chỉ làm màn hình rỗng).
- Đa ngôn ngữ.
