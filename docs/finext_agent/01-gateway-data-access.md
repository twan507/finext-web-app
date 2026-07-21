# 01 — Bước 1: Gateway — Tầng Truy Cập Dữ Liệu

> **Vai trò trong lộ trình:** lớp duy nhất được chạm `agent_db`. Mọi query của model đi qua đây và bị giám sát. Đây là nơi hiện thực hoá nguyên tắc DB-agnostic: web runtime không biết schema, chỉ gateway (qua policy file) biết luật của từng collection.
> **Contract gốc:** [`agent_db_v2.md`](agent_db_v2.md) §7.2 (Gateway MCP) — file này chi tiết hoá cách hiện thực trên web + các phương án.
> **Phụ thuộc:** DB thật đã sẵn sàng (v2 §6 — verify PASS); fixture mode §7 vẫn giữ cho test/CI. Gateway chặn go-live (v2 §7.2: "trước khi mở cho nhóm NĐT").
> **Snapshot as-built 2026-07-21:** đã chọn Option A (library in-process). Code hiện nằm tại `finext-fastapi/app/agent/gateway/`; policy **version 2** whitelist đủ 33 collection và gateway có ba primitive `find`/`aggregate`/`stats`.

---

## 1. Yêu Cầu (từ contract v2 §7.2 — nhắc lại ngắn)

Chỉ expose `find` + `aggregate` + `stats` trên `agent_db`, với luật: whitelist collection · bắt buộc projection trên collection lớn · chặn COLLSCAN khi `GATEWAY_EXPLAIN_MODE=on` · collection series bắt buộc filter khoá + `$slice` và bị cấm aggregate · `*_itd` `$slice ≤ 30` · cap mặc định 50KB/response (hai `history_finratios_*` override 200KB) · cấm `$lookup/$graphLookup/$unionWith/$out/$merge/$where/$function/$accumulator/$skip` · `maxTimeMS 5000` · limit mặc định 20, tối đa 50 · log mọi query · điểm cắm `context.tier` (hiện luôn `internal`). `db_stats` chỉ cho các field số khai báo trong policy và trả scalar server-side.

Thêm 2 yêu cầu từ phía web:

- **Async bắt buộc** — chạy trong event loop của uvicorn (Motor), không được block worker.
- **Lỗi trả về phải "dạy được model"** — mỗi lần từ chối kèm gợi ý sửa ("thêm filter ticker", "thêm projection", "giảm limit") để model tự sửa query trong vòng lặp thay vì chết cứng.

---

## 2. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| Contract luật gateway | ✅ Đã chốt (agent_db_v2 §7.2) |
| Kết nối Mongo async (Motor) trong FastAPI | ✅ `core/database.py` kết nối `user_db`, `stock_db`, `agent_db` |
| Code gateway | ✅ `policy.py`, `validator.py`, `executor.py`, `stats_compute.py`, `fixture.py`, `types.py` |
| Quyết định library vs process riêng | ✅ **Option A — library in-process**; chưa có MCP/HTTP wrapper riêng |
| `agent_db` có index (điều kiện để luật chặn COLLSCAN có nghĩa) | ✅ ĐÃ CÓ — index tạo trên `temp_*` mỗi vòng ghi, sống qua mọi vòng, verify 5 vòng (v2 §2/§5) |

---

## 3. Quyết Định Kiến Trúc: Gateway Chạy Ở Đâu?

### Option A (đã triển khai) — Gateway core = thư viện Python, web import in-process

```
finext-fastapi/app/agent/gateway/
├── policy.py        # load + validate policy file (YAML/JSON)
├── validator.py     # kiểm tra query против policy (thuần logic, không I/O)
├── executor.py      # chạy query qua Motor: explain → execute → cap → log
└── policy.agent_db.yaml   # ← TOÀN BỘ hiểu biết về schema nằm ở đây
```

- Web gọi hàm trực tiếp: `await gateway.find(ctx, collection, filter, projection, limit)` — **0 process mới, 0 RAM mới, 0 network hop**, đúng cam kết hạ tầng "0 container" trên VPS 8GB.
- Runtime ngoài (Claude app hay BẤT KỲ client MCP nào) dùng chung logic bằng **wrapper MCP mỏng tự viết** bọc chính các hàm core — một nguồn luật, hai cách đóng gói. Lưu ý độc lập vendor: **MCP là chuẩn mở** (spec public, JSON-RPC), không thuộc về nhà cung cấp model nào; wrapper viết bằng lib open-source (FastMCP / official SDK — đều MIT-style) hoặc tự implement theo spec nếu muốn zero-dep tuyệt đối. FastMCP hỗ trợ cả chạy server thật lẫn [client in-process](https://gofastmcp.com/clients/client) nên phần test dùng chung được.
- Validator tách rời I/O → unit test luật không cần Mongo.

**Nhược điểm phải chấp nhận:** hai runtime (web / Claude app) chạy hai *instance* của cùng code — cần kỷ luật "sửa luật = sửa ở core, không sửa ở wrapper"; version pin bằng git (gateway core nằm trong repo nào thì owner chốt — đề xuất: package riêng `finext-agent-gateway` pip-installable từ git, cả 2 nơi cài cùng tag).

### Option B (fallback) — MCP server process riêng (Streamable HTTP), web làm client

- Một service duy nhất cho cả web + Claude app → luật chắc chắn đồng nhất, log tập trung 1 chỗ.
- Transport: [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) (chuẩn hiện hành; SSE transport cũ đã deprecated từ spec 2025-03).
- **Giá phải trả:** +1 process (~100-200MB RAM trên VPS đang kín) · +1 hop latency mỗi query · thêm auth giữa FastAPI↔gateway · thêm 1 thứ để deploy/monitor.
- **Khi nào rơi sang B:** (1) owner muốn log/ACL tập trung tuyệt đối một chỗ khi bắt đầu "bán"; (2) xuất hiện runtime thứ 3 (mobile app, đối tác); (3) muốn tách tải Mongo-read của agent khỏi container fastapi. Thiết kế Option A **không cản** việc nâng cấp sau: core library được bọc thành server là xong, call-site phía web đổi từ function call sang HTTP client (interface `GatewayProtocol` giữ nguyên — xem §5).

### Option C (tạm thời, không dùng cho web production) — [mongodb-mcp-server chính thức](https://github.com/mongodb-js/mongodb-mcp-server) với `--readOnly`

- Có sẵn, cài là chạy, có [readOnly mode](https://www.mongodb.com/docs/mcp-server/configuration/enable-or-disable-features/) chặn write.
- **Không đủ cho contract:** không có whitelist theo collection, không bắt buộc projection, không chặn COLLSCAN theo bảng khai báo, không cap bytes tuỳ biến, không có ACL tier, không có error message "dạy model" theo luật riêng của mình.
- Chỉ phù hợp: owner nghịch nhanh trên Claude app trong lúc gateway thật chưa xong. **Không bao giờ** trỏ nó vào web.

**Kết luận hiện hành:** web đang chạy **A**. B/C chỉ còn là phương án tương lai; không có service gateway/MCP riêng trong Compose.

---

## 4. Policy File — Trái Tim Của Tính DB-Agnostic

Toàn bộ hiểu biết về `agent_db` dồn vào MỘT file declarative. Đổi schema DB = sửa file này (+ pack), **không sửa code**.

```yaml
# policy.agent_db.yaml — ví dụ rút gọn (danh sách đầy đủ = inventory 33 collection agent_db_v2 §4 + AGENT_DB_INDEXES v2 §5)
version: 2                      # version hiện hành
defaults:
  max_response_kb: 50
  max_time_ms: 5000
  default_limit: 20
  max_limit: 50
  banned_operators: [$lookup, $graphLookup, $unionWith, $out, $merge, $where, $function, $accumulator, $skip]

collections:
  stock_snapshot:   { size: large, key: ticker }
  stock_recent:     { size: large, key: ticker }
  history_stock:    { size: large, key: ticker, require_filter: [ticker], require_series_slice: true }
  history_industry: { size: large, key: industry_name, require_filter: [industry_name], require_series_slice: true }
  stock_itd:        { size: large, key: ticker, require_filter: [ticker], max_slice: 30 }
  news_history_feed:    { size: large, sort_hint: created_at }
  news_history_content: { size: large, key: article_slug }
  market_phase:         { size: small }          # collection nhỏ: cho phép COLLSCAN
  market_phase_history: { size: large, key: date, require_filter: [date] }
  phase_basket:     { size: small }
  phase_trading:    { size: large, key: ticker }
  phase_perf:       { size: large, require_filter: [product] }
  data_briefing:    { size: small }
  # ... (đủ danh sách; collection KHÔNG có mặt = bị từ chối, kể cả temp_*/old_*)
```

Luật suy ra từ policy khi validate:
- `size: large` → bắt buộc projection + limit; explain() phải ra IXSCAN (hoặc thoả `require_filter` nếu dùng chế độ heuristic §6-R2).
- `require_filter` → filter phải chứa ít nhất 1 khoá liệt kê.
- Collection không khai báo → từ chối thẳng ("collection không nằm trong phạm vi dữ liệu").

**Đồng bộ policy ↔ pack:** pack (agent_db_02) dạy model *cách query*; policy quyết *được hay không*. Khi owner thêm collection mới: thêm 1 dòng policy + 1 đoạn pack, cùng commit — checklist này ghi vào quy trình cập nhật DB của owner.

---

## 5. Interface Cho Web Runtime (chốt sớm để bước 2 làm song song)

```python
class GatewayContext:      # web tạo mỗi request
    tier: str = "internal" # điểm cắm gating tương lai (agent_db_v2 §7.2 — v1 allow-all)
    request_id: str        # trace xuyên suốt log
    user_id: str           # CHỈ để log/audit — không bao giờ vào query agent_db

class GatewayResult:
    ok: bool
    data: list[dict] | None    # đã qua cap bytes
    error: str | None          # lỗi NGÔN NGỮ MODEL HIỂU, kèm gợi ý sửa
    meta: {collection, ms, bytes, truncated, ...}  # thêm note/rejected/plan tuỳ nhánh; không có as_of

class GatewayProtocol(Protocol):           # web chỉ biết interface này
    async def find(self, ctx, collection, filter, projection, sort=None, limit=None) -> GatewayResult: ...
    async def aggregate(self, ctx, collection, pipeline) -> GatewayResult: ...
    async def stats(self, ctx, collection, field, ops, filter=None, date_range=None) -> GatewayResult: ...
```

Hai implementation hiện có: `MongoGateway` và `FixtureGateway`; `HttpGateway` chưa tồn tại. Agent loop nhận `GatewayProtocol` qua dependency injection. `FixtureGateway.aggregate()` chủ động trả lỗi "không hỗ trợ"; `find()` và `stats()` dùng được trong test.

---

## 6. Rủi Ro & Phương Án Xử Lý

| # | Rủi ro | Dấu hiệu | Xử lý |
|---|--------|----------|-------|
| R1 | `explain()` thêm 1 round-trip trên collection lớn khi bật | p95 query tăng | Runtime hiện mặc định `GATEWAY_EXPLAIN_MODE=off` và dựa vào validator/`require_filter`; chỉ bật `on` khi cần kiểm IXSCAN/COLLSCAN. Chưa có cache query-shape. |
| R2 | **Index chết sau vòng ghi fnx05** — ĐÃ ĐƯỢC TRỊ từ pipeline (index tạo trên temp trước rename, verify sống qua 5 vòng — v2 §2); chỉ tái phát nếu ai đó sửa writer bỏ bước create-on-temp (v2 §7.3) | log dày đặc `rejected: COLLSCAN` trên query có filter đúng khoá | Giữ **chế độ heuristic dự phòng** (R1c, env `GATEWAY_EXPLAIN_MODE=off`) làm phòng thủ sâu; gateway log riêng biến cố "filter đúng khoá mà vẫn COLLSCAN" → chạy `verify_agent_db.py` (v2 §6) để bắt |
| R3 | **Torn-read khi fnx05 đang ghi** (đọc được nửa cũ nửa mới) — pipeline đã giảm thiểu: rename atomic per-collection + `core` ghi cuối làm commit marker + phase mirror giữ bản cũ khi nguồn thiếu (v2 §2) | các document trả về có mốc dữ liệu lệch nhau | Runtime gateway hiện **không** trích `as_of`/`snapshot_date` vào meta và loop cũng không so với `core.as_of`; `meta.as_of` ở SSE đang luôn `null`. Muốn cảnh báo staleness tự động phải bổ sung contract/code riêng. Lưu ý nghiệp vụ: `market_phase.as_of` có thể trễ hơn snapshot 1 phiên trong giờ giao dịch (v2 §2), không mặc định là lỗi |
| R4 | **Model viết query hợp lệ nhưng rộng** | tool result bị shrink/cap liên tục | Loop cap 24k ký tự/tool và 40k/vòng, chia đều trước khi chạy; `shrink.py` giữ phần tử mới và bỏ trọn phần tử cũ. Gateway giới hạn 50 dòng và trả gợi ý thu hẹp. |
| R5 | **Policy file sai/lỗi thời so DB thật** (collection đổi tên, khoá đổi) | error rate tăng đột ngột sau ngày owner sửa fnx05 | Policy có `version`; script smoke §8 chạy sau mỗi lần owner đổi DB: từng collection trong policy thử 1 point-read hợp lệ. Fail → biết ngay collection nào lệch |
| R6 | **Prompt injection dụ model query collection ngoài phạm vi** | log `rejected: not whitelisted` | Đây là hành vi ĐÚNG của thiết kế — whitelist là deny-by-default. Chỉ cần đảm bảo error message không tiết lộ danh sách collection tồn tại ngoài whitelist |
| R7 | Hai instance luật (web + Claude app wrapper) lệch version | so version trong log 2 bên | Pin cùng git tag (§3-A); nếu bắt đầu bán/ACL thật → nâng Option B |

---

## 7. Fixture Mode — Để Web Không Phải Chờ DB

`FixtureGateway` implement cùng `GatewayProtocol`, trả data từ file JSON tĩnh đã sanitize. Fixture hiện chỉ có `stock_snapshot`, `stock_info`, `market_phase` và `data_briefing`; không có dữ liệu news. Mục đích:

1. Bước 2-4 dev + test end-to-end (stream, tool loop, FE chip) **trước khi** `agent_db` xong.
2. Pytest chạy CI không cần Mongo.
3. Demo UX cho owner sớm — chốt giao diện trước khi tốn tiền token thật.

Env: `AGENT_GATEWAY=mongo|fixture` (mặc định `mongo`). **Code hiện chỉ log warning khi chọn fixture, chưa có guard cứng từ chối production**; deployment phải bảo đảm không đặt `fixture` ở production.

---

## 8. Điều Kiện Hoàn Thành Bước 1

- [x] Policy v2 phủ 33 collection, gồm 2 `history_finratios_*`; collection series ép filter/`$slice`, cấm aggregate và khai báo field `db_stats`.
- [x] Unit test validator/policy/stats/cap/fixture có trong `tests/agent/gateway/` và `tests/agent/test_db_stats_tool.py`.
- [x] Log query không log filter/content; trả meta `collection/ms/bytes/truncated`, thêm `plan=COLLSCAN` khi bị chặn.
- [x] `FixtureGateway` hỗ trợ `find` + `stats`; aggregate trả lỗi có chủ đích.
- [x] `GATEWAY_EXPLAIN_MODE=off|on` có code và test; default hiện là `off`.
- [ ] Smoke Mongo production sau mỗi lần schema/index đổi vẫn là bước vận hành, không thể kết luận chỉ từ repo.
- [ ] Thêm guard cứng không cho `AGENT_GATEWAY=fixture` trong production nếu muốn biến quy ước deploy thành bất biến code.
