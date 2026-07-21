# db_stats — Tool tính toán an toàn + nới cap + chống lặp query — Design

> **HISTORICAL — IMPLEMENTED:** Tool db_stats hiện có trong agent tool surface; code tại app/agent/tools/db_stats.py và gateway stats modules là nguồn hiện tại.

> **Trạng thái:** PLANNED (chưa build) — owner duyệt hướng 2026-07-16, viết spec trước, build sau.
> **Ngày:** 2026-07-16. Nhánh (dự kiến): nhánh mới tách từ main (KHÔNG gộp vào feat/chat-fe-v1).
> **Vì sao:** câu cần TÍNH TOÁN trên chuỗi lịch sử dài (vd "PE/PB thị trường so với đáy các cú sập lịch sử") hiện FAIL → MAX_ITERS. Root cause (đã chẩn đoán, có evidence scratchpad/diag_maxiters.py):
> 1. `history_finratios_*` bắt buộc `$slice`, cấm aggregate (chống exfil), cap 50KB → model chỉ lấy được ~156 điểm/40KB (~3 năm), KHÔNG đủ dài để thấy đáy 2020/2022.
> 2. Model **không có tool tính toán** — mọi phép min/percentile/đáy nó tự làm bằng bare LLM → không đáng tin trên chuỗi dài.
> 3. Model **lặp lại y hệt query đã fail** (call 3≡11, 5≡10) → phí 8 iteration → MAX_ITERS → lỗi câm.

## 1. Nguyên tắc & phạm vi
- **Không nới lỏng bảo mật.** Bất biến hiện có giữ nguyên: collection mảng-lớn vẫn cấm `db_aggregate` (model-supplied pipeline = exfil). Tool mới KHÔNG mở lại đường đó.
- **Đẩy phép tính về server/DB, không nhồi data thô cho bare LLM.** Trả về **số vô hướng chính xác**, không trả doc/series thô.
- **Giữ đơn giản (YAGNI).** v1 chỉ whitelist các phép rút gọn thông dụng; không làm ngôn ngữ truy vấn tổng quát.
- **3 phần độc lập, review được riêng:** (A) tool `db_stats`, (B) nới cap theo collection, (C) chống lặp query.

## 2. Phần A — Tool `db_stats` (reducer an toàn)

### 2.1 Vì sao AN TOÀN (khác `db_aggregate`)
`db_aggregate` để **model tự viết pipeline** → không chặn nổi exfil (lý do policy.py cấm trên collection mảng-lớn). `db_stats` **đảo ngược quyền**: model chỉ CHỌN tham số từ whitelist; **server tự dựng phép tính cố định** và **chỉ trả scalar**. Model không điều khiển được logic tính, không nhận raw → không exfil. Vì thế `db_stats` được phép **cả trên collection mảng-lớn**.

### 2.2 Schema (model-facing)
```jsonc
db_stats(
  collection: str,           // phải ∈ whitelist policy (như db_find)
  field: str,                // field số cần rút gọn; collection series → "series.pe", "series.pb"…
  ops: string[],             // ⊆ {min,max,mean,median,p05,p25,p75,p95,count,first,last,latest,drawdown_from_peak}
  filter?: object,           // theo require_filter/collscan guard như db_find
  range?: { from?: str, to?: str }  // (tùy chọn) giới hạn theo series.date; thiếu = toàn lịch sử
)
```
- `ops` là **whitelist cứng** (từ chối op lạ). `field` phải khớp allowlist field-số của collection (policy) — không cho rút gọn field nhạy cảm bất kỳ.
- `latest` = giá trị mới nhất (điểm cuối series). `drawdown_from_peak` = (giá trị hiện tại − đỉnh)/đỉnh — phục vụ trực tiếp câu "đã chạm đáy chưa".

### 2.3 Thực thi (SERVER-SIDE, độc lập version Mongo)
Tránh phụ thuộc `$percentile`/`$median` (Mongo 7+; VPS standalone chưa chắc có) VÀ tránh aggregate model-supplied:
1. Validate: collection ∈ whitelist · field ∈ allowlist-field-số của collection · ops ⊆ whitelist · filter qua require_filter + collscan guard.
2. Đọc data **server-side, bounded**: với collection series → đọc `series.<subfield>` + `series.date` của (các) doc khớp filter (nội bộ, KHÔNG áp cap-gửi-model vì data không ra khỏi server); với collection phẳng → đọc field qua các doc khớp (giới hạn nội bộ hợp lý, vd 100k điểm).
3. (tùy chọn) lọc theo `range.date`.
4. Tính **trong Python** (statistics/numpy nếu đã có, else thuần): min/max/mean/median/percentile/count/first/last/latest/drawdown. Chính xác, không lệ thuộc version.
5. Trả **JSON nhỏ chỉ scalar**: `{ "field": "series.pe", "n": 412, "min": 8.9, "max": 21.3, "median": 14.1, "p05": 9.4, "latest": 12.7, "drawdown_from_peak": -0.34, "range": {"from": "...", "to": "..."} }`.

> **Ràng buộc bộ nhớ:** chỉ đọc trong phạm vi doc/filter đã chặn; series 1 doc vài trăm KB là trần thực tế — an toàn. Nếu vượt ngưỡng nội bộ (vd >100k điểm) → lỗi "thu hẹp range".

### 2.4 Ví dụ giải quyết câu gốc
`db_stats(collection="history_finratios_industry", filter={"industry_name":"Toàn bộ thị trường"}, field="series.pe", ops=["min","p05","median","max","latest","drawdown_from_peak"])`
→ model nhận **đáy PE toàn lịch sử + PE hiện tại + mức sụt so đỉnh** = số chính xác Mongo/server tính → trả lời "đã chạm đáy chưa" đúng, không đoán.

### 2.5 Đăng ký tool
Thêm `DB_STATS_SCHEMA` vào `TOOL_SCHEMAS` (registry) + nhánh xử lý trong `execute_tool`. Nhãn (label_for) tiếng Việt: "Đang tính thống kê …".

## 3. Phần B — Nới cap theo collection
- `CollectionRule` thêm field `max_response_kb: int | None = None` (override default global 50).
- Executor: `_ok_result` dùng `rule.max_response_kb or defaults.max_response_kb`.
- YAML: đặt `max_response_kb: 200` + nâng `max_slice` (260 → 520) cho `history_finratios_stock` / `history_finratios_industry`.
- ⚠ **PACK:** `policy.agent_db.yaml` thuộc pack → sửa bản repo + **owner đồng bộ pack canonical ngoài**. (Ghi rõ trong PR.)
- Với db_stats là đường chính cho câu tính-toán, cap chỉ cần đủ headroom cho db_find lấy chuỗi trung bình — KHÔNG cần bỏ hẳn cap (giữ trần để chặn context phình + chi phí).

## 4. Phần C — Chống lặp query (loop)
- `run_agent` giữ `failed_sig: set[str]` — chữ ký `sha1(tool + collection + json(args, sort_keys))` của call trả `ok=False`.
- Trước khi execute một call: nếu chữ ký ∈ `failed_sig` → **KHÔNG chạy lại**; trả thẳng feedback mạnh: "Query này đã thử và lỗi ở trên. Đừng lặp lại — hãy đổi cách (giảm phạm vi) hoặc dùng db_stats để lấy số tổng hợp." → tiết kiệm iteration.
- (Tùy chọn v1.1, KHÔNG bắt buộc) cache call **thành công** để tránh re-fetch trùng — ghi nhận, chưa làm.
- Giữ MAX_ITERS=8 (chống lặp đã giảm thrash; không cần nâng vội).

## 5. Error handling
- Field/collection/op ngoài whitelist → lỗi "dạy model" (nêu whitelist hợp lệ), không rỗng câm.
- Filter thiếu require_filter / COLLSCAN → tái dùng guard hiện có (cùng thông điệp db_find).
- Kết quả rỗng (không doc khớp) → "không có dữ liệu cho filter này", gợi ý kiểm tra tên (vd industry_name).
- Vượt ngưỡng nội bộ → "thu hẹp range".

## 6. Testing (nghiệm thu)
- **Unit tính toán:** fixture series đã biết → assert min/max/mean/median/percentile/latest/drawdown ĐÚNG số.
- **Bảo mật:** db_stats từ chối collection/field/op ngoài whitelist; **KHÔNG bao giờ** trả raw doc/series (chỉ scalar); không thực thi pipeline model-supplied.
- **Cap:** collection có override → dùng cap lớn; collection khác → vẫn 50; số nhỏ vẫn trả bình thường.
- **Chống lặp:** loop test — model gọi lại query đã fail → bị chặn, feedback đúng, không tốn thêm gateway call; không chạm MAX_ITERS ở kịch bản lặp.
- **Live (Pha verify):** câu gốc "PE/PB … so đáy lịch sử" giờ ra câu trả lời có số (db_stats), không MAX_ITERS. Toàn bộ pytest (đang 231) vẫn PASS.

## 7. Ngoài scope
- Không làm code-interpreter/sandbox Python cho model. Không mở lại db_aggregate trên collection mảng-lớn. Không đổi FE. Không precompute field tóm tắt (phương án data-pipeline — để riêng nếu cần sau).

## 8. Rủi ro & phụ thuộc
- **Pack sync** (Phần B) — cap/slice phải khớp pack canonical, else drift.
- **Prompt hướng dẫn** — cần thêm ~1 khối ngắn trong system_prompt/agent_db doc: "khi cần min/đỉnh/đáy/percentile/so lịch sử → dùng db_stats, đừng tự tính trên chuỗi dài" (PACK → sync). Nếu không, model có thể vẫn quen db_find rồi tự tính.
- **Đổi LLM (MiniMax M3?)** — nếu đổi model, tool-calling format có thể khác; db_stats vẫn OK vì là contract chuẩn OpenAI-compat, nhưng cần A/B (xem ghi chú riêng).
