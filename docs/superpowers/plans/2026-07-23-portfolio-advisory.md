# Portfolio Advisory (`/portfolio`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây tính năng nâng cao `/portfolio` — bàn tư vấn danh mục dùng Finext AI, chọn 1 watchlist làm trọng tâm, AI hỏi kĩ vị thế rồi tư vấn theo khung điều kiện (compliance A), tận dụng phase + 3 rổ hệ thống.

**Architecture:** Route mới `/portfolio` layout 2 cột (trái = WL picker read-only + giá live, phải = chat tái dùng). WL + phase tiêm qua `page_context`; persona riêng qua `mode="portfolio"` (system block backend); gate advanced 2 tầng (frontend blur + backend 403); hội thoại tách logic bằng tag `source`.

**Tech Stack:** FastAPI + Motor + Pydantic v2 (backend); Next.js 15 App Router + React 19 + MUI 7 + TS strict (frontend). Spec: `docs/superpowers/specs/2026-07-23-portfolio-advisory-design.md`.

## Global Constraints

- Không thêm dependency mới (Python hoặc npm).
- TS `strict: true` — không `any` không giải thích; không `@ts-ignore` không giải thích.
- Python: type hint mọi signature; không bare `except`; không `print` (dùng logging); hàm ≤ ~40 dòng.
- Compliance A: persona KHÔNG phát lệnh mua/bán; giữ framing "hệ thêm vào/rời khỏi"; kèm disclaimer backtest.
- `page_context` ≤ 2000 ký tự (ràng buộc schema hiện có).
- WL > 20 mã: không cho chọn làm trọng tâm.
- Gate advanced = feature key ∈ {advanced_feature, broker_feature, manager_feature, admin_feature} (khớp `ADVANCED_AND_ABOVE_STRICT`).
- Verify: `cd finext-fastapi && uv run pytest` (hiện 731) · `cd finext-nextjs && npx tsc --noEmit && npm test` (hiện 63).
- `get_my_watchlist` (tools/user.py, registry.py) GIỮ NGUYÊN OFF — không đụng.

---

## Task 1: Backend — `get_user_feature_keys` helper (DRY)

**Files:**
- Modify: `finext-fastapi/app/auth/access.py` (thêm helper + imports)
- Modify: `finext-fastapi/app/routers/auth.py` (`read_my_features` gọi helper)
- Test: `finext-fastapi/tests/auth/test_feature_keys.py`

**Interfaces:**
- Produces: `async def get_user_feature_keys(db: AsyncIOMotorDatabase, user: UserInDB) -> list[str]` — feature keys từ subscription hiệu lực → `license.feature_keys`; `[]` khi không sub / hết hạn / license mất.

- [ ] **Step 1: Viết test** `tests/auth/test_feature_keys.py`: user không subscription_id → `[]`; user có sub active + license.feature_keys=["advanced_feature"] → chứa "advanced_feature"; sub hết hạn → `[]`. Dùng fakes/monkeypatch cho `crud_subscriptions.get_subscription_by_id_db` + `crud_licenses.get_license_by_id` (theo pattern test hiện có trong `tests/`).
- [ ] **Step 2: Chạy test** `uv run pytest tests/auth/test_feature_keys.py -v` → FAIL (import error).
- [ ] **Step 3: Thêm helper vào `access.py`** — tách logic từ `read_my_features` (auth.py:240-279), giữ PURE (không side-effect clear sub). Thêm imports `crud_subscriptions`, `crud_licenses`, `datetime/timezone`.
- [ ] **Step 4: Refactor `read_my_features`** → `return await get_user_feature_keys(db, current_user)` (bỏ code trùng; chấp nhận bỏ opportunistic clear sub — cleanup không thiết yếu).
- [ ] **Step 5: Chạy test** helper + `uv run pytest tests/auth -v` → PASS.
- [ ] **Step 6: Commit** `feat(auth): tách get_user_feature_keys dùng chung read_my_features + gate`.

---

## Task 2: Backend — persona KB + `build_portfolio_block()`

**Files:**
- Create: `finext-fastapi/app/agent/kb/system_prompt_portfolio.md`
- Create: `finext-fastapi/app/agent/portfolio.py`
- Test: `finext-fastapi/tests/agent/test_portfolio_block.py`

**Interfaces:**
- Produces: `def build_portfolio_block() -> SystemBlock` — đọc `kb/system_prompt_portfolio.md`, trả `SystemBlock(text=..., cache_hint=False)`. Fallback text ngắn nếu thiếu file (không raise).

- [ ] **Step 1: Viết test**: `build_portfolio_block()` trả `SystemBlock`, `.text` chứa cụm khoá compliance ("không" + "mua/bán" hay "khung điều kiện") và "danh mục".
- [ ] **Step 2: Chạy test** → FAIL.
- [ ] **Step 3: Viết `system_prompt_portfolio.md`** theo §5 spec (vai trò, hỏi kĩ 1 nhịp/lượt, tận dụng phase/rổ/phase_trading có chọn lọc, compliance A, disclaimer). Kế thừa agent_db_06, KHÔNG lặp số.
- [ ] **Step 4: Viết `portfolio.py`** — `KB_DIR / "system_prompt_portfolio.md"`, đọc text (theo pattern `_read_resident` trong context.py), fallback ngắn nếu thiếu; `build_portfolio_block()`.
- [ ] **Step 5: Chạy test** → PASS.
- [ ] **Step 6: Commit** `feat(agent): persona tư vấn danh mục + build_portfolio_block`.

---

## Task 3: Backend — schema `mode`/`source` + crud source + filter

**Files:**
- Modify: `finext-fastapi/app/schemas/chat.py` (`ChatStreamRequest.mode`, `ConversationSummary.source`)
- Modify: `finext-fastapi/app/crud/chat.py` (`start_turn(source=...)`, `list_conversations(source=...)`)
- Test: `finext-fastapi/tests/agent/test_chat_source.py` (hoặc file crud test hiện có)

**Interfaces:**
- Produces:
  - `ChatStreamRequest.mode: Literal["portfolio"] | None = None`
  - `ConversationSummary.source: str = "chat"`
  - `start_turn(db, user_id, conversation_id, message, source: str = "chat") -> str` (set `source` khi tạo doc)
  - `list_conversations(db, user_id, source: str | None = None) -> list[dict]`: `source="portfolio"` → `{"source": "portfolio"}`; `source="chat"` → `{"source": {"$ne": "portfolio"}}`; `None` → không lọc.

- [ ] **Step 1: Viết test**: tạo conv với source="portfolio" → `list_conversations(source="portfolio")` thấy nó, `list_conversations(source="chat")` KHÔNG thấy; conv cũ không field source → coi là "chat". (Dùng mongomock/fake db theo pattern test crud hiện có.)
- [ ] **Step 2: Chạy test** → FAIL.
- [ ] **Step 3: Sửa `schemas/chat.py`** — thêm `mode` + `source`.
- [ ] **Step 4: Sửa `crud/chat.py`** — `start_turn` nhận `source`, set vào insert doc; `list_conversations` nhận `source` + build filter như interface.
- [ ] **Step 5: Chạy test** → PASS.
- [ ] **Step 6: Commit** `feat(chat): tag source hội thoại + filter list theo source`.

---

## Task 4: Backend — enforce gate + tag source + append portfolio block

**Files:**
- Modify: `finext-fastapi/app/routers/chat.py` (`chat_stream` gate+source; `_produce` append block; `list_my_conversations` query param)
- Test: `finext-fastapi/tests/agent/test_portfolio_gate.py`

**Interfaces:**
- Consumes: `access.get_user_feature_keys` (Task 1), `portfolio.build_portfolio_block` (Task 2), `crud_chat.start_turn(source=)`, `crud_chat.list_conversations(source=)` (Task 3).
- Constant: `_ADVANCED_FEATURE_KEYS = {"advanced_feature", "broker_feature", "manager_feature", "admin_feature"}`.

- [ ] **Step 1: Viết test**: gọi helper enforce (tách được) — feature ["basic_feature"] + mode=portfolio → 403; feature ["advanced_feature"] → không raise. Test `_produce` append portfolio block khi `body.mode=="portfolio"` (mock build_system_blocks + run_agent). Nếu khó test SSE end-to-end, test đơn vị hàm append + hàm gate.
- [ ] **Step 2: Chạy test** → FAIL.
- [ ] **Step 3: Sửa `chat_stream`** — sau `check_quota`, nếu `body.mode=="portfolio"`: `feats=await get_user_feature_keys(db,current_user)`; nếu `not set(feats) & _ADVANCED_FEATURE_KEYS` → `HTTPException(403, "Tính năng tư vấn danh mục yêu cầu gói hội viên phù hợp.")`. Tính `source = "portfolio" if body.mode=="portfolio" else "chat"`; truyền vào `start_turn(..., source=source)`.
- [ ] **Step 4: Sửa `_produce`** — sau `build_system_blocks`, TRƯỚC `_page_context_block`: `if body.mode=="portfolio": system.append(build_portfolio_block())`.
- [ ] **Step 5: Sửa `list_my_conversations`** — thêm query param `source: str | None = None` → truyền vào `crud_chat.list_conversations(db, uid, source=source)`.
- [ ] **Step 6: Chạy test** + `uv run pytest` (toàn bộ, 731+) → PASS.
- [ ] **Step 7: Commit** `feat(chat): gate advanced + persona cho mode=portfolio + list theo source`.

---

## Task 5: Frontend — luồng `mode`/`source` qua service + store

**Files:**
- Modify: `finext-nextjs/services/chatClient.ts` (`ChatStreamBody.mode`)
- Modify: `finext-nextjs/services/chatConversations.ts` (`fetchConversations(source?)`)
- Modify: `finext-nextjs/hooks/useChatStore.ts` (param `chatMode`)

**Interfaces:**
- Produces:
  - `ChatStreamBody.mode?: 'portfolio'`
  - `fetchConversations(source?: 'chat' | 'portfolio'): Promise<ConversationSummaryDTO[]>` (append `?source=`)
  - `useChatStore(initialConversationId?, getPageContext?, chatMode?: 'portfolio')` — runStream gửi `mode: chatMode`; fetch list dùng `source = chatMode === 'portfolio' ? 'portfolio' : 'chat'`.

- [ ] **Step 1**: Thêm `mode?: 'portfolio'` vào `ChatStreamBody`.
- [ ] **Step 2**: `fetchConversations(source?)` → nếu có source, url `+= '?source=' + source`.
- [ ] **Step 3**: `useChatStore` nhận param thứ 3 `chatMode`; ref `chatModeRef`; trong `runStream` thêm `mode: chatModeRef.current` vào body streamChat; trong effect tải list gọi `fetchConversations(chatMode === 'portfolio' ? 'portfolio' : 'chat')`.
- [ ] **Step 4**: `npx tsc --noEmit` → PASS (không lỗi type).
- [ ] **Step 5: Commit** `feat(chat-fe): luồng mode/source qua chatClient + store`.

---

## Task 6: Frontend — prop `readOnly` cho `WatchlistColumn`

**Files:**
- Modify: `finext-nextjs/app/(main)/watchlist/components/WatchlistColumn.tsx`

**Interfaces:**
- Produces: `WatchlistColumnProps.readOnly?: boolean` — true → ẩn ⋮ menu, ẩn ô "+ Thêm mã", ẩn nút xoá mã (CloseIcon), tắt rename (bỏ onDoubleClick), tắt DnD stock (`disabled = readOnly || !isManualSort`). `/watchlist` không truyền → hành vi cũ.

- [ ] **Step 1**: Thêm `readOnly?: boolean` vào props + destructure.
- [ ] **Step 2**: Guard ⋮ IconButton bằng `{!readOnly && (...)}`; header rename `onDoubleClick={readOnly ? undefined : ...}` + cursor.
- [ ] **Step 3**: Guard remove-btn (2 nhánh renderStockRow) + ô Autocomplete "+ Thêm mã" bằng `{!readOnly && ...}`.
- [ ] **Step 4**: `SortableStockRow disabled={readOnly || !isManualSort}`.
- [ ] **Step 5**: `npx tsc --noEmit` + `npm test` → PASS; kiểm tra `/watchlist` không đổi (không truyền readOnly).
- [ ] **Step 6: Commit** `feat(watchlist): prop readOnly cho WatchlistColumn (dùng lại ở /portfolio)`.

---

## Task 7: Frontend — `portfolioContext.ts` + `portfolioMeta.ts`

**Files:**
- Create: `finext-nextjs/app/(main)/portfolio/portfolioContext.ts`
- Create: `finext-nextjs/app/(main)/portfolio/portfolioMeta.ts`
- Test: `finext-nextjs/app/(main)/portfolio/portfolioContext.test.ts`

**Interfaces:**
- Produces:
  - `buildPortfolioContext(input: { name: string; symbols: string[]; phaseLabel?: string; exposureHint?: string }): string` — chuỗi ≤2000 ký tự: "Danh mục đang tư vấn: «name». Mã: A, B... " + (nếu có) "Giai đoạn thị trường: «phaseLabel» (hệ gợi ý nắm ~«exposureHint»)."; symbols viết HOA; cắt an toàn ≤2000.
  - `PORTFOLIO_GREETING: string`, `PORTFOLIO_SUGGESTIONS: string[]` (kho tĩnh curated, chuyên biệt danh mục).

- [ ] **Step 1: Viết test** `portfolioContext.test.ts` (node:test): symbols viết hoa; có phaseLabel → chuỗi chứa "Giai đoạn"; không phase → không có dòng phase; độ dài ≤2000; `PORTFOLIO_SUGGESTIONS` ≥3 câu, không rỗng, không trùng.
- [ ] **Step 2: Chạy test** `node --test` (theo script npm test) → FAIL.
- [ ] **Step 3: Viết `portfolioContext.ts`** (`buildPortfolioContext`).
- [ ] **Step 4: Viết `portfolioMeta.ts`** (greeting + suggestions).
- [ ] **Step 5: Chạy test** → PASS.
- [ ] **Step 6: Commit** `feat(portfolio): builder page_context + greeting/gợi ý tĩnh`.

---

## Task 8: Frontend — `PortfolioPhaseChip.tsx`

**Files:**
- Create: `finext-nextjs/app/(main)/portfolio/components/PortfolioPhaseChip.tsx`

**Interfaces:**
- Consumes: `hooks/useMarketPhaseData` (đọc shape thực khi implement).
- Produces: `<PortfolioPhaseChip onPhase={(p:{label?:string; exposureHint?:string})=>void} />` — hiện chip giai đoạn + báo ngược label/exposure lên cha để nhồi page_context.

- [ ] **Step 1**: Đọc `hooks/useMarketPhaseData.ts` xác định field (phase label, exposure).
- [ ] **Step 2**: Viết component: render chip nhỏ (màu theo phase), `useEffect` gọi `onPhase` khi có dữ liệu.
- [ ] **Step 3**: `npx tsc --noEmit` → PASS.
- [ ] **Step 4: Commit** `feat(portfolio): chip giai đoạn thị trường`.

---

## Task 9: Frontend — `WatchlistPicker.tsx` (cột trái)

**Files:**
- Create: `finext-nextjs/app/(main)/portfolio/components/WatchlistPicker.tsx`

**Interfaces:**
- Consumes: `apiClient` (`GET /api/v1/watchlists/me`), `useSseCache('home_today_stock')`, `WatchlistColumn(readOnly)` (Task 6), `useAuth`.
- Produces: `<WatchlistPicker selectedId={string|null} onSelect={(wl:{id;name;stock_symbols:string[]})=>void} />` — list WL dọc; card click chọn (viền highlight); WL >20 mã disable chọn + chú thích; giá live qua SSE.

- [ ] **Step 1**: Viết component: fetch WL `/watchlists/me`; SSE `home_today_stock` → stockDataMap + allTickers (theo pattern watchlist PageContent); render mỗi WL bằng `WatchlistColumn readOnly` bọc Box click; highlight khi `selectedId`; cap-20 disable + tooltip.
- [ ] **Step 2**: `npx tsc --noEmit` → PASS.
- [ ] **Step 3: Commit** `feat(portfolio): cột trái WatchlistPicker (WL live + chọn + cap20)`.

---

## Task 10: Frontend — `page.tsx` + `PageContent.tsx` (ráp 2 cột)

**Files:**
- Create: `finext-nextjs/app/(main)/portfolio/page.tsx`
- Create: `finext-nextjs/app/(main)/portfolio/PageContent.tsx`

**Interfaces:**
- Consumes: `OptionalAuthWrapper` + `ADVANCED_AND_ABOVE_STRICT`; `useChatStore(_, getPageContext, 'portfolio')`; `WatchlistPicker`, `PortfolioPhaseChip`, `buildPortfolioContext`, `PORTFOLIO_GREETING/SUGGESTIONS`; reuse `chat/components/Composer`, `MessageList`.

- [ ] **Step 1**: `page.tsx` — metadata (`robots: noindex`) + render `PageContent`.
- [ ] **Step 2**: `PageContent.tsx` — bọc `OptionalAuthWrapper(requireAuth, requiredFeatures=ADVANCED_AND_ABOVE_STRICT, fillHeight)`; layout 2 cột (trái WatchlistPicker + phase chip, phải chat); state `selectedWl` + `phase`; `getPageContext = () => selectedWl ? buildPortfolioContext({...selectedWl, ...phase}) : undefined`; `useChatStore(undefined, getPageContext, 'portfolio')`; render greeting + suggestions khi rỗng; Composer + MessageList. Đọc props thực của Composer/MessageList khi implement.
- [ ] **Step 3**: `npx tsc --noEmit` + `npm test` → PASS.
- [ ] **Step 4: Commit** `feat(portfolio): page /portfolio 2 cột (gate advanced + chat mode=portfolio)`.

---

## Task 11: Frontend — lối vào (sidebar + nút trên /watchlist)

**Files:**
- Modify: sidebar nav (đọc `components/layout/*` xác định file thực)
- Modify: `finext-nextjs/app/(main)/watchlist/PageContent.tsx` (nút "Tư vấn danh mục" → `/portfolio`)

**Interfaces:** thêm mục điều hướng `/portfolio` (nhãn "Tư vấn danh mục"); nút trên trang watchlist điều hướng `/portfolio`.

- [ ] **Step 1**: Đọc cấu trúc sidebar nav; thêm entry `/portfolio` (icon phù hợp, nhãn "Tư vấn danh mục").
- [ ] **Step 2**: Thêm nút/link trên `/watchlist` → `/portfolio`.
- [ ] **Step 3**: `npx tsc --noEmit` + `npm test` → PASS.
- [ ] **Step 4: Commit** `feat(portfolio): lối vào từ sidebar + trang watchlist`.

---

## Self-Review / Verify cuối
- [ ] `cd finext-fastapi && uv run pytest` → xanh (≥731).
- [ ] `cd finext-nextjs && npx tsc --noEmit && npm test` → xanh (≥63).
- [ ] Rà: mọi mục §spec có task tương ứng (gate 2 tầng ✓, persona ✓, page_context WL+phase ✓, tách source ✓, cột trái reuse ✓, cap20 ✓, edge cases ✓).
- [ ] Không thêm dependency; `get_my_watchlist` vẫn OFF.
