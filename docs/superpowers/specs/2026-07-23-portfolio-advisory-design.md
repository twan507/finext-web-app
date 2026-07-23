# Thiết kế: Tư vấn Danh mục theo Watchlist (`/portfolio`)

**Ngày:** 2026-07-23 · **Trạng thái:** đã chốt với owner, sẵn sàng lập plan

## 1. Mục tiêu

Xây một **tính năng nâng cao riêng** cho phép user đưa watchlist (WL) của mình vào một cuộc
hội thoại với Finext AI để được **tư vấn danh mục có phương pháp** — hỏi kĩ vị thế (đang giữ
hay định mua, giá vốn, mua từ bao giờ, mục tiêu, mức chịu lỗ) rồi phân tích từng mã dựa trên
**giai đoạn thị trường (phase)** và **3 danh mục hệ thống của Finext**.

Trải nghiệm phải khiến user cảm nhận đây là **một chức năng chuyên nghiệp, khác hẳn** chat
chung ở bubble/`/chat` — không phải "chat generic" mà là một bàn tư vấn có ngữ cảnh danh mục,
phase, và tài nguyên phân tích của Finext.

Ba ràng buộc nền:

1. **Compliance A**: khuyến nghị khách quan có điều kiện ("nếu mục tiêu X thì…"), **KHÔNG** phát
   lệnh mua/bán cá nhân hoá. Kế thừa lập trường hiện hành (`system_prompt.md`, `agent_db_06.md`).
2. **Tính năng advanced**: chỉ user có gói **advanced trở lên** mới dùng được (gate 2 tầng).
3. **Tận dụng tài nguyên sẵn có, hợp lý**: phase + 3 rổ + lịch sử trading là dữ liệu agent đã
   truy cập được — dùng có chọn lọc để tư vấn, KHÔNG bắn dữ liệu thô.

## 2. Phạm vi

### 2.1 Trong phạm vi (v1)
- Route mới `/portfolio` (dưới `(main)`), layout 2 cột: trái = chọn/hiển thị WL, phải = chat.
- Thu thập bối cảnh cá nhân theo **hội thoại** (AI hỏi từng nhịp), không form.
- Tiêm WL đang chọn + phase hiện tại vào `page_context`.
- Persona tư vấn riêng (compliance A) khi `mode="portfolio"`.
- Gate advanced 2 tầng (frontend blur + backend 403).
- Lưu hội thoại portfolio **tách logic** bằng tag `source="portfolio"` (cùng collection).

### 2.2 Ngoài phạm vi (YAGNI — để v1.1)
- Live % từng mã + badge "trùng rổ Finext" ở cột trái (v1 chỉ hiện giá live như page watchlist).
- Gợi ý câu hỏi động sinh bằng LLM (v1 dùng kho tĩnh curated).
- Trang lịch sử hội thoại riêng cho `/portfolio` (v1 tag + ẩn khỏi `/chat` là đủ).
- Pre-inject phase nâng cao (intensity/sub_signal) — v1 chỉ nhãn phase + exposure gợi ý.
- **Sổ vị thế deterministic** (parse free-text) — đã loại; dựa vào history replay sẵn có.
- **Bật lại tool `get_my_watchlist`** — không cần; page_context injection thay thế.
- Thu thập cost basis / lãi-lỗ lưu vào DB — v1 chỉ sống trong hội thoại.

## 3. Quyết định nền (đã cân nhắc)

| Chủ đề | Đã chọn | Lý do / phương án loại |
|---|---|---|
| Ranh giới tư vấn | **A — khách quan có điều kiện** | B (cá nhân hoá mạnh "nên chốt/gồng") lệch lập trường + rủi ro pháp lý — loại. |
| Thu thập bối cảnh | **Hội thoại (AI hỏi từng bước)** | Form bị owner loại; conversational tự nhiên hơn. Bù rủi ro M3 bằng history replay + persona kỷ luật 1 nhịp/lượt. |
| Tiêm WL cho AI | **`page_context`** | Không đụng tool surface (bubble/`/chat` không bị thêm tool); khớp yêu cầu "chọn 1 list ở cột trái" (tool không biết list nào đang chọn). Bật lại `get_my_watchlist` — loại. |
| Nhớ vị thế qua lượt | **History replay sẵn có** (`capHistory` 20 lượt) | Sổ vị thế deterministic phải parse free-text → giòn → loại. |
| Lưu hội thoại | **Tách logic bằng tag `source`** (cùng collection) | Lưu chung làm hội thoại portfolio lọt sidebar `/chat` chung → loãng bản sắc. Tách vật lý (collection riêng) — thừa. |

## 4. Kiến trúc

### 4.1 Luồng tổng
```
User chọn WL ở cột trái ──▶ PageContent giữ {name, symbols[≤20]}
        │
        ├──▶ portfolioContext.ts dựng page_context:
        │       "Danh mục đang tư vấn: «name». Mã: HPG, MWG, ...
        │        Giai đoạn thị trường: «phase» (hệ gợi ý nắm ~X%)."   (≤2000 ký tự)
        │
        └──▶ useChatStore.send(text)
                 ──▶ streamChat({ history, message, page_context, mode:'portfolio' })
                          │
     Backend chat.py:
       1) mode=="portfolio" → enforce advanced feature (403 nếu thiếu)
       2) build_system_blocks(...)  (resident + briefing + session_note)
       3) + build_portfolio_block() (persona compliance A, cache)   ← MỚI
       4) + page_context block (WL + phase, non-cache)
       5) run_agent → AI hỏi kĩ / phân tích theo khung điều kiện
       6) persist assistant-msg với source="portfolio"
```
Đổi WL giữa phiên → `page_context` đổi → lượt kế AI biết trọng tâm mới (cùng hội thoại).

### 4.2 Backend — file & thay đổi
| File | Thay đổi |
|---|---|
| `app/agent/kb/system_prompt_portfolio.md` | **MỚI** — persona tư vấn (behavioral, kế thừa `agent_db_06`). |
| `app/agent/portfolio.py` | **MỚI** — `build_portfolio_block() -> SystemBlock` nạp file trên (cache_hint chốt ở plan, xem §4.2); hằng số. |
| `app/auth/access.py` | **+ `get_user_feature_keys(db, user) -> list[str]`** — tách logic từ `read_my_features` (không đẻ file mới); dùng chung 2 nơi. |
| `app/routers/auth.py` | `read_my_features` gọi helper chung (bỏ code trùng — behavior không đổi). |
| `app/schemas/chat.py` | `ChatStreamRequest` **+ `mode: Literal["portfolio"] \| None = None`**; conversation DTO có **`source`**. |
| `app/routers/chat.py` | `_produce`/handler: nếu `mode=="portfolio"` → check advanced (403 nếu thiếu) → append `build_portfolio_block()` (TRƯỚC block page_context) → tạo/persist với `source="portfolio"`. |
| `app/crud/chat.py` + router list | Conversation doc **+ field `source`** (mặc định `"chat"`); `list conversations` **filter theo `source`** (`/chat` loại portfolio; `/portfolio` chỉ lấy portfolio). |

`get_my_watchlist` (tools/user.py, registry.py) **giữ nguyên OFF** — không đụng. Không thêm dependency.

**Vị trí block portfolio & cache:** append cùng chỗ page_context trong `_produce`. Persona tĩnh
nên đặt `cache_hint=True` là hợp lý, nhưng để không phá cache-prefix của các khối thường trú
(page_context đang `cache_hint=False` append cuối), v1 append portfolio block **trước** page_context;
chi tiết cache cuối cùng chốt ở plan (mặc định an toàn = non-cache như page_context, tối ưu cache sau).

### 4.3 Frontend — file (self-contained `app/(main)/portfolio/`)
| File | Vai trò |
|---|---|
| `page.tsx` | Server wrapper + metadata (`robots: noindex`). |
| `PageContent.tsx` | Client, layout 2 cột, bọc `OptionalAuthWrapper(requireAuth, ADVANCED_AND_ABOVE_STRICT)`; giữ state `selectedWl`; dựng `page_context`. |
| `components/WatchlistPicker.tsx` | Cột trái: liệt kê WL của user (`GET /watchlists/me`) bằng `WatchlistColumn` chế độ read-only + SSE `home_today_stock` (giá live); click chọn 1 (viền highlight); WL >20 mã **không cho chọn** (mờ + chú thích). |
| `components/PortfolioPhaseChip.tsx` | Chip giai đoạn thị trường hiện tại (dùng `hooks/useMarketPhaseData` sẵn có). |
| `portfolioContext.ts` | Dựng chuỗi `page_context` (WL + phase). **Seam tối ưu chính** về sau. |
| `portfolioMeta.ts` | Greeting + kho gợi ý câu hỏi chuyên biệt danh mục (tĩnh, curated). |
| (reuse) `chat/components/Composer`, `MessageList` | Cột phải — cơ chế chat. |
| (sửa additive) `hooks/useChatStore.ts` | **+ tham số `mode?` + `source?`** luồn xuống `streamChat` và `fetchConversations`. Các surface khác không truyền → default như cũ. |
| (sửa additive) `app/(main)/watchlist/components/WatchlistColumn.tsx` | **+ prop `readOnly?`** (ẩn ⋮/xoá/thêm mã/DnD/rename). `/watchlist` không truyền → hành vi không đổi. |

## 5. Persona tư vấn — `system_prompt_portfolio.md` (compliance A)

Nội dung behavioral, **kế thừa** `agent_db_06.md` (không lặp số liệu/luật đã có ở đó):

**Vai trò & mở đầu (bản sắc chuyên nghiệp):**
- Mở đầu chủ động, có cấu trúc: thiết lập bối cảnh **giai đoạn thị trường** (từ page_context) rồi
  mời user kể vị thế — khác hẳn "tôi giúp gì được".
- Chỉ bàn các mã trong **danh mục đang chọn** (page_context); mã ngoài danh mục → mời quay lại trọng tâm.

**Hỏi kĩ trước khi tư vấn sâu (kỷ luật 1 nhịp/lượt vì M3 output ngắn):**
- Với mỗi mã/cụm: đang giữ hay định mua · giá vốn · mua từ bao giờ · mục tiêu ngắn/dài hạn · mức chịu lỗ.
- Hỏi gọn từng nhịp, không dồn nhiều câu; tự tóm & xác nhận lại vị thế user đã khai khi đi qua nhiều lượt.

**Tận dụng tài nguyên (hợp lý, không bắn thô):**
- **Luôn khung theo phase**: dùng nhãn + exposure gợi ý (đã có trong page_context) làm nền cho mọi nhận định.
- **Đối chiếu rổ Finext**: khi mã user giữ trùng rổ (Phòng Thủ/Sóng Ngành/Mạo Hiểm) → nêu trạng thái
  mã trong rổ (`trong_ro`/`vung_buffer`/`ung_vien`/`cho_tin_hieu`) + đối chiếu tỷ trọng. Query
  `phase_basket`/rank **on-demand**, chỉ khi liên quan.
- **Lịch sử trading**: trích `phase_trading` (win rate / return TB của **đúng mã đang bàn**) **có chọn lọc**,
  luôn kèm **nhãn backtest** — KHÔNG liệt kê cả sổ lệnh.

**Ràng buộc compliance (bắt buộc, kế thừa guard hệ thống):**
- Khung điều kiện, **KHÔNG** lệnh "anh nên mua/bán/chốt/gồng".
- Hành động hệ = mã "**được thêm vào / rời khỏi** danh mục", không viết hệ "mua/bán".
- Không bịa thesis/giá mục tiêu; không lộ công thức/trọng số.
- Kèm disclaimer ngắn: thông tin tham khảo, không phải khuyến nghị mua/bán; số quá khứ là backtest.

## 6. Gate advanced — 2 tầng

**Tầng 1 — Frontend (UX):** `PageContent` bọc `OptionalAuthWrapper requireAuth
requiredFeatures={ADVANCED_AND_ABOVE_STRICT}`. Group này (có sẵn ở `components/auth/features.ts`,
loại BASIC) đúng nghĩa "advanced trở lên". Guest/basic → blur overlay + `AuthGateOverlay`.

**Tầng 2 — Backend (hàng rào thật, kẻo gate rỗng):** ở `chat.py`, khi `mode=="portfolio"`:
- Resolve feature qua `get_user_feature_keys(db, user)`.
- Nếu không giao với `{advanced_feature, broker_feature, manager_feature, admin_feature}` → **HTTP 403**.
- (BASIC không đủ — khớp `ADVANCED_AND_ABOVE_STRICT`.)

## 7. Lưu hội thoại — tách logic bằng tag

- **Cùng collection `conversations` (user_db)** — KHÔNG collection mới.
- **Conversation doc** thêm field **`source`**: `"chat"` (mặc định) hoặc `"portfolio"` (set 1 lần lúc tạo hội thoại — list filter ở cấp conversation).
- Tạo hội thoại từ `/portfolio` → `source="portfolio"`.
- `list conversations`: `/chat` **loại** `source="portfolio"`; `/portfolio` **chỉ lấy** `source="portfolio"`.
- v1 `/portfolio` chưa cần sidebar lịch sử (cột trái = WL picker) — tag + ẩn khỏi `/chat` là đủ;
  lịch sử riêng để v1.1.

## 8. Cột trái — hiển thị WL như page /watchlist

- Tái dùng **`WatchlistColumn`** (+ prop `readOnly` additive: ẩn ⋮/xoá/thêm mã/DnD/rename) + SSE
  **`home_today_stock`** (giá live, %+/-, VSI, GTGD — đồng nhất page watchlist).
- Xếp **dọc trong panel** (không phải lưới 5 cột của page watchlist).
- Mỗi card **click để chọn** làm trọng tâm tư vấn (viền highlight; chỉ 1 tại một thời điểm,
  đổi được trong phiên).
- WL **>20 mã → không cho chọn** (mờ + chú thích "danh mục quá dài, tối đa 20 mã").

## 9. Edge cases & lỗi
- User chưa có WL → cột trái empty state (mời tạo WL ở `/watchlist`); chat vẫn mở, persona nhắc tạo trước.
- WL >20 mã → disable chọn (đã nêu §8).
- Chưa chọn WL mà gõ chat → persona nhắc chọn danh mục ở cột trái.
- Quota/limit/429/503 → tái dùng nguyên `limitNotice`/`quotaWarn` của `useChatStore`.
- Guest/basic vượt gate frontend (gọi API trực tiếp) → backend 403 (§6 tầng 2).
- `market_phase` không đọc được → page_context bỏ dòng phase (persona vẫn có thể query on-demand); không chặn chat.

## 10. Kiểm thử
- **Backend:**
  - `get_user_feature_keys` (advanced → pass, basic/none → 403 khi `mode=portfolio`).
  - `mode` validate trong schema; `build_portfolio_block` append đúng khi `mode=portfolio`, không đụng khi `None`.
  - `source` gán đúng + filter list (chat loại portfolio; portfolio chỉ lấy portfolio).
  - `uv run pytest` giữ xanh (hiện 731+).
- **Frontend:**
  - `WatchlistPicker`: cap-20 (list 21 mã bị chặn chọn); chọn/đổi WL cập nhật state.
  - `WatchlistColumn readOnly`: không render ⋮/add/remove/DnD.
  - `portfolioContext`: dựng chuỗi đúng định dạng (WL + phase, ≤2000 ký tự).
  - `npx tsc --noEmit` + `npm test` (hiện 63+).

## 11. Seam để tối ưu về sau (không làm v1)
Live % + badge trùng rổ ở cột trái · gợi ý câu hỏi động (LLM) · trang lịch sử hội thoại riêng của
`/portfolio` (tận dụng tag `source`) · pre-inject phase nâng cao (intensity/sub_signal) · tách row
renderer của `WatchlistColumn` thành component dùng chung nếu cần.

## 12. Verification baseline
```bash
# Backend
cd finext-fastapi && uv run pytest        # hiện 731

# Frontend
cd finext-nextjs && npx tsc --noEmit && npm test   # hiện 63
```
Không thêm dependency mới. Không chạy `next build` song song dev server (cùng `.next`).
