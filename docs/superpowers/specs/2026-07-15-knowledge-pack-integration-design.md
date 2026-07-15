# Tích hợp Knowledge Pack thật vào agent — Design

> **Ngày:** 2026-07-15 · **Trạng thái:** owner đã duyệt các quyết định lớn trong phiên brainstorm.
> **Bối cảnh:** Agent v1 lát cắt dọc đã xong ([[project_agent_v1_slice]], branch `feat/agent-v1-slice`) đang chạy bằng
> **pack stub** ~1k token. Owner cung cấp Knowledge Pack THẬT (7 file) ở `d:/twan_projects/notebook-runner/projects/finext/ai_agent/agent_db/`:
> `system_prompt.md` (~6k tok) + `agent_db_01→06` (~94k tok). Spec này định nghĩa cách tích hợp cho khớp kiến trúc
> tool/gateway thật của dự án. Nguồn: [spec lát cắt](2026-07-14-agent-v1-slice-and-chat-render-design.md).

## 1. Vấn đề & mục tiêu

Pack đầy đủ ~100k token. Kiến trúc pack gốc giả định Claude Projects (system_prompt = custom instructions resident,
agent_db_01→06 = project files có retrieval). Runtime dự án **không có retrieval** và `context.py` hiện nối toàn bộ
`.md` trong pack dir vào system prompt. Mục tiêu: đưa pack thật vào runtime tự viết (tool `db_find`/`db_aggregate` +
gateway policy), không vỡ ngân sách token, giữ nguyên lớp an ninh validator đã kiểm 4 vòng.

## 2. Quyết định đã chốt

### D1 — Cơ chế nạp pack: resident chọn lọc + `read_kb` tool
- **Resident** (nạp vào block system mỗi request, `cache_hint=True`): `system_prompt.md` + `agent_db_01` (schema) +
  `agent_db_02` (query patterns). ~30k token sau khi cắt phần history (D2). Đây là thứ model cần cho MỌI câu query.
- **`read_kb` tool**: model tự đọc `agent_db_03` (anti-patterns) / `04` (methodology) / `05` (news) / `06` (phase)
  khi câu hỏi cần chiều sâu — đúng tinh thần manifest mục 13 của system_prompt.
- DeepSeek V4 context 256k → resident 30k + tool results thoải mái; context caching làm phần resident rẻ từ request 2.
- **Cái giá (chấp nhận):** câu cần diễn giải chuyên sâu (news/methodology/phase) tốn thêm 1 vòng `read_kb`. Câu query
  cơ bản (giá, dòng tiền, BCTC, screening) KHÔNG tốn vòng nào — schema+query đã resident.

### D2 — 28 collection whitelist; bỏ 5 history mảng-lớn; ghi chú rõ
- **BỎ khỏi whitelist (5, doc chứa mảng vài trăm–nghìn phiên → nặng):** `history_stock`, `history_industry`,
  `history_index`, `history_finratios_stock`, `history_finratios_industry`.
- **GIỮ `market_phase_history`** (khoá `date`, 1 doc/phiên nhỏ, `require_filter: [date]` — không phải mảng lớn như
  `history_*`; thuộc khối phase owner muốn giữ).
- **28 collection còn lại mở đủ**, gồm 6 collection phase (`market_phase`, `market_phase_history`, `phase_basket`,
  `phase_trading`, `phase_perf`, `phase_industry`) để agent tư vấn được phase + danh mục.
- **Ghi chú history KHÔNG khả dụng v1** một cách chính xác tại: bản đồ collection `system_prompt` mục 3 (dòng
  `history_*` / `history_finratios_*`), `agent_db_01` khối E + mục `history_finratios_*`, `agent_db_02` mục 1.6/1.7
  (định giá lịch sử) + Workflow G (xu hướng dài hạn), `agent_db_04` mục D6 (định giá tương đối lịch sử). Cách ghi:
  đánh dấu "⚠ v1 web: chưa mở — dùng `*_recent` (20 phiên) / `*_finstats` (BCTC hiện tại) thay thế", KHÔNG xoá hẳn
  (giữ để nối lại khi mở history sau).

### D3 — Tool `read_kb`
- Schema: `read_kb(doc: enum["agent_db_03","agent_db_04","agent_db_05","agent_db_06"])` → trả nguyên nội dung file.
  Whitelist cứng 4 tên (01/02 đã resident, không cho đọc lại; không cho path tùy ý — chặn path traversal).
- KHÔNG đi qua cap 12k chars của `execute_tool` (cap đó chặn exfil dữ liệu Mongo; KB là tài liệu tĩnh của dự án).
  Trả nguyên file (file lớn nhất `05` ~33k token — 256k context chứa thoải mái).
- Nằm trong `TOOL_SCHEMAS` cạnh `db_find`/`db_aggregate`. Label chip: "Đang tra cứu tài liệu phương pháp…".
- Đọc từ `app/agent/kb/` (D8). File không tồn tại → trả text lỗi dạy model (không raise), như tool khác.

### D4 — Sửa `agent_db_02` cho khớp 2 tool thật
- File 02 hiện viết cú pháp mongosh (`db.collection.find(...)`) + khối `collection:/filter:/pipeline:` + note
  "dùng MongoDB tool với `database: "agent_db"`". Viết lại TOÀN BỘ sang đúng 2 tool dự án:
  - `db_find({collection, filter, projection, sort?, limit?})` · `db_aggregate({collection, pipeline})`.
  - Bỏ `database` (gateway bind cứng `agent_db`). Bỏ cú pháp mongosh, thống nhất một dạng JSON tham số tool.
- Đối chiếu từng pipeline mẫu với validator, sửa cái vi phạm (theo D7). Bỏ/đánh dấu các mục dùng history (D2).

### D5 — Policy `policy.agent_db.yaml`: 8 → 28 collection
- Đối chiếu schema `agent_db_01` khai đúng mỗi collection: `size` (large nếu doc lớn/nhiều/mảng), `key`,
  `require_filter`, `require_series_slice` (các `*_recent`/`*_itd` có mảng series), `max_slice` (`*_itd` ≤ 30),
  `allow_aggregate` (mặc định true cho doc phẳng; false + `require_series_slice` cho collection mảng series lớn —
  cơ chế fail-closed ở `Policy.load` tự ép).
- `banned_operators` giữ nguyên (đã gồm `$unionWith`, `$$ROOT` chặn ở validator).

### D6 — Sửa `system_prompt.md` cho khớp runtime
- Mục 3 "Luật query": diễn đạt theo 3 tool thật (`db_find`, `db_aggregate`, `read_kb`) thay vì mongosh.
- Mục 7 web search: v1 CHƯA có web search tool → ghi rõ agent luôn ở "chế độ KHÔNG web search" (pack đã có sẵn nhánh
  này: trả lời từ DB + ghi "chưa đối chiếu tin ngoài hệ thống"). KHÔNG hứa web search.
- Mục 13 manifest: cập nhật — 01/02 "đã có sẵn trong ngữ cảnh", 03–06 "gọi `read_kb` khi cần".
- Bản đồ collection mục 3: đánh dấu history (D2).
- `get_my_watchlist` hiện đã gỡ khỏi tool surface (chưa tích hợp watchlist thật) — system_prompt KHÔNG quảng cáo tool này.

### D7 — Reconcile validator ↔ pipeline pack (ưu tiên validator)
- Mặc định giữ validator, sửa pipeline pack cho tuân thủ. Chỉ nới validator ở false-positive thật đã biết:
  - **G4** (`size:large` + `require_filter` rỗng → bắt buộc `$limit`): nới để nếu `pipeline[0]` là `$match` theo
    `rule.key` với giá trị cụ thể thì KHÔNG đòi `$limit` (đã có anchor, không quét vô hạn). Bỏ chặn oan
    aggregate-có-match-hẹp mà reviewer Task 2 đã nêu.
  - Xác nhận các operator pack dùng (`$let`/`$filter`/`$map`/`$arrayToObject`/`$unwind`/`$group`/`$project`) KHÔNG
    nằm banned list → hợp lệ. `$unwind` trên collection có `require_series_slice` cần rà (mục 9.3 intraday) — sửa
    pack dùng `$slice` thay vì `$unwind` toàn series nếu validator chặn.
- Mọi thay đổi validator phải kèm test giữ nguyên các test exfil cũ (không mở lại lỗ đã vá).

### D8 — Pack sync: copy vào repo
- KB copy vào `finext-fastapi/app/agent/kb/` (6 file `agent_db_01→06.md`), commit vào repo web (đúng cam kết doc 05
  "copy vào image lúc build"). `system_prompt.md` → thay `pack_stub/00_system_stub.md` (giữ thư mục stub cho CI test).
- `context.py`: resident đọc `system_prompt.md` + `agent_db_01.md` + `agent_db_02.md`; `read_kb` đọc từ `kb/`.
- Script sync `scripts/sync_agent_pack.py` (hoặc tài liệu hoá lệnh copy): owner sửa pack ở notebook-runner → copy
  sang repo web + commit. Pack versioned cùng code (nguyên tắc "pack và DB cùng thế hệ").
- **CI/test vẫn dùng pack stub tối giản** — không phụ thuộc pack thật (giữ như spec lát cắt §D7).

### D9 — Testing
- `read_kb`: trả đúng nội dung file whitelist; tên ngoài whitelist → lỗi text không raise; không path traversal.
- Policy 28 collection: mỗi collection point-read hợp lệ pass; history_* bị từ chối "ngoài phạm vi".
- Validator sau khi nới G4: test anchor-match-không-limit pass; **các test exfil cũ vẫn pass** (không regression).
- Context assembly: resident nạp đủ 3 file; câu "FPT giá" không gọi read_kb; đổi pack stub↔thật không đổi interface.
- Không chạy DeepSeek thật trong CI (dùng ScriptedAdapter); verify pack thật end-to-end là bước thủ công của owner
  (như mốc lát cắt Task 9).

## 3. Ngoài phạm vi v1
- History collections (5 cái) — mở sau khi có cơ chế nén/slice an toàn.
- **Web search tool — task riêng có spec/plan sau** (owner chốt 2026-07-15). Cần: chọn provider + API key +
  dependency + lớp an ninh cho web content (prompt-injection từ web nguy hiểm hơn Mongo). V1 pack chạy nhánh "không
  web search" (system_prompt mục 7): trả lời từ DB + ghi "chưa đối chiếu tin ngoài hệ thống".
- Retrieval/RAG thật (Mongo standalone không vector).
- `get_my_watchlist` nối lại (chờ tích hợp watchlist thật — schema `stock_symbols`/multi-doc).
- Persistence/quota, FE — các bước sau của roadmap.

## 4. File sẽ tạo/sửa (chi tiết ở plan)
- Tạo: `finext-fastapi/app/agent/kb/agent_db_01..06.md` (copy), `app/agent/tools/kb.py` (read_kb), script sync.
- Sửa: `app/agent/pack_stub/` (thay bằng system_prompt thật hoặc giữ stub + thêm real dir), `app/agent/context.py`
  (resident 3 file), `app/agent/tools/registry.py` (+read_kb), `app/agent/labels.py`, `policy.agent_db.yaml`
  (28 collection), `app/agent/gateway/validator.py` (nới G4 + test), `agent_db_02.md` + `system_prompt.md` (rewrite).
