# Chat Bubble theo ngữ cảnh trang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bong bóng chat nổi trên 14 trang sản phẩm, cho user hỏi đáp với Finext AI về đúng nội dung trang đang xem, hội thoại lưu vào lịch sử chat chung.

**Architecture:** Frontend dựng một chuỗi "ngữ cảnh trang" thuần từ URL và gửi kèm mỗi lượt chat qua field mới `page_context`. Backend nối chuỗi đó thành một khối system ở cuối danh sách, không cache, không lưu vào lịch sử — agent loop, guard, quota và persistence giữ nguyên. Bubble mount một lần ở layout dùng chung với bản `useChatStore` riêng; bàn giao sang trang `/chat` bằng điều hướng, đọc lại hội thoại từ CSDL.

**Tech Stack:** Next.js (App Router, TypeScript strict) · MUI · FastAPI + Pydantic v2 · pytest · `node --test` (bộ chạy test có sẵn của Node 24, không thêm dependency).

**Spec:** [`docs/superpowers/specs/2026-07-20-chat-bubble-design.md`](../specs/2026-07-20-chat-bubble-design.md)

## Global Constraints

- **KHÔNG thêm dependency mới** vào bất kỳ package nào. Test frontend dùng `node --test` có sẵn.
- **KHÔNG sửa nội dung 14 trang sản phẩm** — mọi chủ thể động đọc từ URL.
- **KHÔNG đụng** `app/agent/loop.py`, `app/agent/context.py`, `app/crud/chat.py` — agent loop, guard chống bịa số, coherence, quota, persistence giữ nguyên tuyệt đối.
- **Ngữ cảnh trang KHÔNG được chứa số liệu** (giá, chỉ số, phần trăm). Guard chống bịa số chỉ đối chiếu số trong câu trả lời với số trích từ kết quả tool; số nằm trong khối system có thể khiến guard chặn nhầm câu trả lời đúng.
- **Ngữ cảnh trang KHÔNG lặp lại định nghĩa thuật ngữ** — KB pack của agent đã có sẵn và được cache thường trú.
- **K-hygiene:** ngữ cảnh không chứa tên collection, số trần hạn mức, hay chi tiết nội bộ.
- **Tương thích ngược tuyệt đối:** trang `/chat` không truyền ngữ cảnh → không gửi field → hành vi y hệt hiện tại.
- Giới hạn độ dài ngữ cảnh: frontend cắt ở **1500** ký tự, backend khai báo `max_length=2000`.
- Khối system ngữ cảnh phải nối vào **CUỐI** danh sách và đặt `cache_hint=False`.
- Trả lời và mọi chuỗi hiển thị bằng **tiếng Việt**.
- Verify backend: `pytest` (kiểm `${PIPESTATUS[0]}` khi pipe). Verify frontend: `npx tsc --noEmit` phải exit 0.
- **Giao diện do owner tự kiểm thử trên trình duyệt** — KHÔNG dựng Playwright/browser automation.
- **KHÔNG commit trong suốt quá trình code** (owner chốt). Mỗi task kết thúc bằng việc để nguyên thay đổi ở working tree và báo cáo kết quả kiểm thử. Chỉ commit **một lần duy nhất** khi toàn bộ tính năng hoàn thành và mọi cổng kiểm tra đều xanh. **KHÔNG push** (chờ owner cho phép riêng).

---

## File Structure

**Backend (finext-fastapi)**

| File | Trách nhiệm |
|---|---|
| `app/schemas/chat.py` (sửa) | Thêm field `page_context` vào request lượt chat |
| `app/routers/chat.py` (sửa) | Hàm thuần `_page_context_block()` + nối khối vào cuối `system` |
| `tests/agent/test_chat_page_context.py` (mới) | Test hàm thuần + test schema |

**Frontend (finext-nextjs)**

| File | Trách nhiệm |
|---|---|
| `services/chatPageContext.ts` (mới) | Registry 14 trang + `buildPageContext` + `getSuggestions` + `hasBubble`. Thuần logic, không import React/MUI/Next |
| `services/chatPageContext.test.ts` (mới) | Test registry bằng `node --test` |
| `tsconfig.json` (sửa) | Bật `allowImportingTsExtensions` để tsc chấp nhận import có đuôi `.ts` trong file test |
| `services/chatClient.ts` (sửa) | Thêm `page_context` vào body gửi lên |
| `hooks/useChatStore.ts` (sửa) | Tham số `getPageContext`, truyền vào 2 chỗ gửi, huỷ stream khi unmount |
| `app/(main)/chat/components/MessageList.tsx` (sửa) | Prop chế độ cuộn (mặc định giữ nguyên) |
| `components/chatBubble/BubbleMessages.tsx` (mới) | Vùng tin nhắn cuộn trong khung + trạng thái trống (lời chào + câu gợi ý) |
| `components/chatBubble/ChatBubble.tsx` (mới) | Nút tròn + cửa sổ chat; nạp lười; chưa đăng nhập; nút mở rộng |
| `app/(main)/LayoutContent.tsx` (sửa) | Mount bubble |

---

## Task 1: Backend nhận và chèn ngữ cảnh trang

**Files:**
- Modify: `finext-fastapi/app/schemas/chat.py:14-18`
- Modify: `finext-fastapi/app/routers/chat.py` (import ở đầu file; hàm thuần mới đặt cạnh `_messages_from` dòng 37-39; nối khối trong `_produce` sau dòng 137)
- Test: `finext-fastapi/tests/agent/test_chat_page_context.py`

**Interfaces:**
- Consumes: `SystemBlock(text: str, cache_hint: bool)` từ `app.agent.adapters.base`; `ChatStreamRequest` từ `app.schemas.chat`.
- Produces: field `ChatStreamRequest.page_context: str | None`; hàm `_page_context_block(page_context: str | None) -> SystemBlock | None` trong `app/routers/chat.py`.

- [ ] **Step 1: Viết test thất bại**

Tạo `finext-fastapi/tests/agent/test_chat_page_context.py`:

```python
import pytest
from pydantic import ValidationError

from app.routers.chat import _page_context_block
from app.schemas.chat import ChatStreamRequest


def test_khong_co_ngu_canh_thi_khong_tao_khoi():
    assert _page_context_block(None) is None
    assert _page_context_block("") is None
    assert _page_context_block("   \n  ") is None


def test_co_ngu_canh_thi_tao_khoi_khong_cache():
    blk = _page_context_block("Trang: Chi tiết cổ phiếu · Đang xem: HPG")
    assert blk is not None
    assert blk.cache_hint is False, "khối ngữ cảnh đổi mỗi request nên không được cache"
    assert "HPG" in blk.text
    assert blk.text.startswith("[NGỮ CẢNH TRANG")


def test_khoi_co_nhan_chong_nhai_lai():
    blk = _page_context_block("Trang: Trang chủ")
    assert blk is not None
    assert "KHÔNG nhắc lại" in blk.text


def test_schema_mac_dinh_khong_co_ngu_canh():
    req = ChatStreamRequest(message="xin chào")
    assert req.page_context is None


def test_schema_nhan_ngu_canh_hop_le():
    req = ChatStreamRequest(message="xin chào", page_context="Trang: Trang chủ")
    assert req.page_context == "Trang: Trang chủ"


def test_schema_chan_ngu_canh_qua_dai():
    with pytest.raises(ValidationError):
        ChatStreamRequest(message="xin chào", page_context="a" * 2001)


def test_ngu_canh_khong_lot_vao_messages_gui_model():
    """page_context chỉ đi đường khối system. Không được lẫn vào messages —
    vì messages cũng chính là thứ được lưu vào lịch sử hội thoại của user."""
    from app.routers.chat import _messages_from

    body = ChatStreamRequest(message="thị trường sao rồi", page_context="Trang: Trang chủ")
    msgs = _messages_from(body)
    assert msgs == [{"role": "user", "content": "thị trường sao rồi"}]
    assert all("Trang:" not in m["content"] for m in msgs)
```

- [ ] **Step 2: Chạy test để xác nhận nó thất bại**

```bash
cd finext-fastapi && python -m pytest tests/agent/test_chat_page_context.py -v
```
Expected: FAIL — `ImportError: cannot import name '_page_context_block'`.

- [ ] **Step 3: Thêm field vào schema**

Trong `finext-fastapi/app/schemas/chat.py`, sửa `ChatStreamRequest` (dòng 14-18) thành:

```python
class ChatStreamRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None  # persistence ở session sau — v1 slice chưa lưu
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)  # client-held transcript
    thinking: bool = False  # user bật "suy nghĩ sâu" (M3 thinking=adaptive) — chậm hơn nhưng câu gọn/kỹ hơn
    # Ngữ cảnh trang user đang xem (bubble chat gửi lên). Không hiển thị cho user, không lưu lịch sử.
    page_context: str | None = Field(default=None, max_length=2000)
```

- [ ] **Step 4: Thêm hàm thuần dựng khối**

Trong `finext-fastapi/app/routers/chat.py`, thêm `SystemBlock` vào import (ngay sau dòng 13):

```python
from app.agent.adapters.base import SystemBlock
```

Rồi thêm hằng số và hàm ngay sau `_messages_from` (sau dòng 39):

```python
_PAGE_CONTEXT_HEADER = "[NGỮ CẢNH TRANG — để hiểu user đang xem gì; KHÔNG nhắc lại nội dung này cho user]"


def _page_context_block(page_context: str | None) -> SystemBlock | None:
    """Khối system mô tả trang user đang xem (bubble chat). None khi không có ngữ cảnh.

    cache_hint=False vì đổi theo từng trang/lượt — cùng kiểu với ghi chú phiên.
    """
    if not page_context or not page_context.strip():
        return None
    return SystemBlock(text=f"{_PAGE_CONTEXT_HEADER}\n{page_context.strip()}", cache_hint=False)
```

- [ ] **Step 5: Nối khối vào cuối danh sách system**

Trong `_produce` của `finext-fastapi/app/routers/chat.py`, ngay sau dòng 137 (`system, _as_of = await build_system_blocks(gateway, ctx)`), chèn:

```python
        page_block = _page_context_block(body.page_context)
        if page_block is not None:
            system.append(page_block)  # nối CUỐI: giữ nguyên cache prefix của các khối thường trú
```

- [ ] **Step 6: Chạy test để xác nhận nó pass**

```bash
cd finext-fastapi && python -m pytest tests/agent/test_chat_page_context.py -v
```
Expected: PASS 7/7.

- [ ] **Step 7: Chạy toàn bộ suite kiểm hồi quy**

```bash
cd finext-fastapi && python -m pytest -q 2>&1 | tail -20; echo "EXIT=${PIPESTATUS[0]}"
```
Expected: `EXIT=0`, tổng số test = 394 cũ + 7 mới = 401 passed.

- [ ] **Step 8: Dừng — KHÔNG commit**

Để nguyên thay đổi ở working tree. Báo cáo: các file đã sửa, số test pass, kết quả full suite.

---

## Task 2: Registry ngữ cảnh 14 trang (thuần logic)

**Files:**
- Modify: `finext-nextjs/tsconfig.json` (thêm 1 cờ)
- Create: `finext-nextjs/services/chatPageContext.ts`
- Test: `finext-nextjs/services/chatPageContext.test.ts`

**Interfaces:**
- Consumes: không có (module thuần, không import gì).
- Produces:
  - `PAGE_CONTEXT_MAX: number` (= 1500)
  - `buildPageContext(pathname: string, search?: SearchLike): string | undefined` với `type SearchLike = { get(name: string): string | null }` — cố ý dùng kiểu cấu trúc thay vì `URLSearchParams`, vì `useSearchParams()` của Next trả `ReadonlyURLSearchParams` (không gán được cho `URLSearchParams`)
  - `getSuggestions(pathname: string): string[]`
  - `hasBubble(pathname: string): boolean`

- [ ] **Step 1: Bật cờ cho phép import đuôi .ts**

Trong `finext-nextjs/tsconfig.json`, thêm vào `compilerOptions` (ngay sau `"noEmit": true,` dòng 13):

```json
    "allowImportingTsExtensions": true,
```

Cờ này hợp lệ vì dự án đã đặt `noEmit: true`. Nó cho phép file test import `./chatPageContext.ts` đúng cách Node yêu cầu, mà `tsc` vẫn kiểm tra được file test.

- [ ] **Step 2: Viết test thất bại**

Tạo `finext-nextjs/services/chatPageContext.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPageContext, getSuggestions, hasBubble, PAGE_CONTEXT_MAX } from './chatPageContext.ts';

const ROUTES_CO_BUBBLE = [
  '/', '/markets', '/phase', '/stocks', '/sectors', '/groups',
  '/commodities', '/macro', '/international', '/watchlist',
  '/stocks/HPG', '/sectors/nganhang', '/groups/FNXINDEX', '/charts/VNINDEX',
];

test('đủ 14 trang sản phẩm đều dựng được ngữ cảnh', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const ctx = buildPageContext(r);
    assert.ok(ctx, `thiếu ngữ cảnh cho ${r}`);
    assert.ok(ctx.startsWith('[NGỮ CẢNH TRANG'), `thiếu nhãn ở ${r}`);
    assert.ok(ctx.includes('Trang: '), `thiếu tên trang ở ${r}`);
    assert.ok(hasBubble(r), `hasBubble sai ở ${r}`);
  }
});

test('trang ngoài danh sách không có ngữ cảnh và không có bubble', () => {
  for (const r of ['/chat', '/chat/abc', '/profile', '/profile/ai-usage', '/news', '/news/bai-viet', '/reports', '/plans', '/open-account', '/guides/overview', '/policies/privacy', '/support/email', '/charts']) {
    assert.equal(buildPageContext(r), undefined, `không được có ngữ cảnh ở ${r}`);
    assert.equal(hasBubble(r), false, `không được hiện bubble ở ${r}`);
  }
});

test('trang chi tiết đưa được chủ thể đang xem vào ngữ cảnh', () => {
  assert.ok(buildPageContext('/stocks/HPG')!.includes('HPG'));
  assert.ok(buildPageContext('/sectors/nganhang')!.includes('nganhang'));
  assert.ok(buildPageContext('/groups/FNXINDEX')!.includes('FNXINDEX'));
  assert.ok(buildPageContext('/charts/VNINDEX')!.includes('VNINDEX'));
});

test('tab trên URL được đưa vào ngữ cảnh', () => {
  const ctx = buildPageContext('/stocks/HPG', new URLSearchParams('tab=dongtien'));
  assert.ok(ctx!.includes('Tab: '), 'phải có dòng Tab khi URL có ?tab=');
});

test('tab lạ vẫn không làm hỏng ngữ cảnh', () => {
  const ctx = buildPageContext('/markets', new URLSearchParams('tab=khong-ton-tai'));
  assert.ok(ctx, 'tab lạ không được làm mất ngữ cảnh');
  assert.ok(ctx.includes('Trang: '));
});

test('đường dẫn có dấu / thừa vẫn khớp', () => {
  assert.ok(buildPageContext('/markets/'));
  assert.ok(buildPageContext('/stocks/HPG/'));
});

test('đường dẫn con không khai báo thì không khớp nhầm', () => {
  assert.equal(buildPageContext('/stocks/HPG/them/nua'), undefined);
});

test('ngữ cảnh không bao giờ vượt giới hạn độ dài', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    assert.ok(buildPageContext(r)!.length <= PAGE_CONTEXT_MAX, `quá dài ở ${r}`);
  }
});

test('ngữ cảnh không chứa chữ số (tránh guard chống bịa số chặn nhầm)', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const body = buildPageContext(r)!.split('\n').slice(2).join('\n'); // bỏ nhãn + dòng "Trang:"
    assert.equal(/\d/.test(body), false, `phần mô tả của ${r} không được chứa số`);
  }
});

test('mỗi trang có 2-3 câu gợi ý', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const s = getSuggestions(r);
    assert.ok(s.length >= 2 && s.length <= 3, `${r} phải có 2-3 gợi ý, đang có ${s.length}`);
    for (const q of s) assert.ok(q.trim().length > 0, `gợi ý rỗng ở ${r}`);
  }
  assert.deepEqual(getSuggestions('/chat'), []);
});

test('gợi ý ở trang chi tiết nhắc tên chủ thể', () => {
  assert.ok(getSuggestions('/stocks/HPG').some((q) => q.includes('HPG')));
});
```

- [ ] **Step 3: Chạy test để xác nhận nó thất bại**

```bash
cd finext-nextjs && node --test services/chatPageContext.test.ts
```
Expected: FAIL — không tìm thấy module `./chatPageContext.ts`.

- [ ] **Step 4: Viết registry**

Tạo `finext-nextjs/services/chatPageContext.ts`:

```ts
// Ngữ cảnh trang gửi cho AI ở bubble chat. KHÔNG hiển thị cho user.
//
// RÀNG BUỘC BẮT BUỘC:
//  1. Không chứa số liệu (giá, chỉ số, %) — guard chống bịa số ở backend chỉ đối chiếu số
//     trong câu trả lời với số lấy từ tool; số nằm trong ngữ cảnh có thể gây chặn nhầm.
//  2. Không lặp lại định nghĩa thuật ngữ — KB pack của agent đã có sẵn và được cache.
//     Ở đây chỉ mô tả GIAO DIỆN: trang hiển thị gì, có tab nào.
//  3. Không nêu tên collection, số trần hạn mức hay chi tiết nội bộ.

export const PAGE_CONTEXT_MAX = 1500;

const HEADER = '[NGỮ CẢNH TRANG — để hiểu user đang xem gì; KHÔNG nhắc lại nội dung này cho user]';

/** Chỉ cần đọc được tham số. Nhận cả URLSearchParams lẫn ReadonlyURLSearchParams của Next. */
type SearchLike = { get(name: string): string | null };

type Entry = {
  /** Tên trang cho AI hiểu */
  title: string;
  /** Mô tả giao diện trang, 2-5 dòng, không chứa số */
  body: string;
  /** Ánh xạ giá trị ?tab= sang mô tả dễ hiểu. Thiếu key thì hiển thị nguyên giá trị. */
  tabs?: Record<string, string>;
  suggestions: (subject?: string) => string[];
};

type DynamicEntry = Entry & {
  /** Tiền tố đường dẫn, đoạn ngay sau nó là chủ thể (VD '/stocks' + '/HPG') */
  prefix: string;
};

const EXACT: Record<string, Entry> = {
  '/': {
    title: 'Trang chủ',
    body:
      'Trang tổng quan toàn thị trường, mỗi khối là cửa vào một mục sâu hơn. Có: dải chỉ số chính, ' +
      'biểu đồ chỉ số, độ rộng thị trường, phân bổ dòng tiền, top cổ phiếu tăng và giảm, ' +
      'top khối ngoại mua và bán ròng, hiệu suất nhóm ngành, tin tức.',
    suggestions: () => ['Hôm nay thị trường thế nào?', 'Độ rộng thị trường nghĩa là gì?', 'Cách đọc bảng khối ngoại?'],
  },
  '/markets': {
    title: 'Thị trường',
    body:
      'Trang phân tích thị trường nhiều chiều. Đầu trang là biểu đồ chỉ số và bảng các chỉ số. ' +
      'Bên dưới là các tab: Biến động, Dòng tiền, Định giá, Kỹ thuật, Nước ngoài, Tự doanh. ' +
      'Một số tab yêu cầu đăng nhập hoặc gói hội viên phù hợp.',
    suggestions: () => ['Trang này xem được gì?', 'Cách đọc tab Định giá?', 'Bản đồ thị trường nghĩa là gì?'],
  },
  '/phase': {
    title: 'Giai đoạn thị trường',
    body:
      'Trang định vị pha thị trường, dữ liệu chốt cuối phiên. Đầu trang hiển thị trạng thái pha ' +
      'kèm dải các phiên gần nhất, tỷ trọng nắm giữ gợi ý và cường độ thị trường. ' +
      'Có tab phân tích thị trường và các tab rổ danh mục mẫu; tab rổ yêu cầu gói hội viên phù hợp.',
    suggestions: () => ['Pha thị trường hiện tại nghĩa là gì?', 'Tỷ trọng nắm giữ gợi ý dùng thế nào?', 'Các rổ danh mục khác nhau ra sao?'],
  },
  '/stocks': {
    title: 'Bộ lọc cổ phiếu',
    body:
      'Trang sàng lọc cổ phiếu toàn thị trường. Có ô tìm mã, các mẫu lọc dựng sẵn, bộ lọc nhanh ' +
      'theo sàn và nhóm, bộ lọc nâng cao theo khoảng giá trị, bộ lọc kỹ thuật so giá với chỉ báo. ' +
      'Kết quả hiển thị dạng bảng, chuyển được giữa các kiểu bảng và tuỳ chỉnh cột. ' +
      'Trang yêu cầu gói hội viên phù hợp.',
    suggestions: () => ['Cách dùng bộ lọc này?', 'Các mẫu lọc dựng sẵn chọn ra gì?', 'Các kiểu bảng khác nhau thế nào?'],
  },
  '/sectors': {
    title: 'Ngành nghề',
    body:
      'Trang xếp hạng và so sánh các nhóm ngành theo sức mạnh dòng tiền. Có bảng xếp hạng ngành, ' +
      'các biểu đồ dòng tiền và thanh khoản theo ngành, và bảng chỉ số định giá ngành. ' +
      'Bấm vào một ngành để xem trang chi tiết ngành đó.',
    suggestions: () => ['Bảng này xếp hạng theo tiêu chí gì?', 'So sánh định giá giữa các ngành thế nào?'],
  },
  '/groups': {
    title: 'Nhóm cổ phiếu',
    body:
      'Trang so sánh các rổ chỉ số do Finext tự xây, chia theo ba loại: nhóm thị trường, ' +
      'nhóm dòng tiền và nhóm vốn hoá. Nhóm khác với ngành nghề: nhóm phân theo tiêu chí dòng tiền ' +
      'và vốn hoá chứ không theo lĩnh vực kinh doanh. Bấm một nhóm để xem chi tiết.',
    suggestions: () => ['Nhóm khác ngành nghề thế nào?', 'Ba loại nhóm phân theo tiêu chí gì?'],
  },
  '/commodities': {
    title: 'Thị trường hàng hoá',
    body:
      'Trang theo dõi giá hàng hoá, chia theo các tab nhóm mặt hàng. Mỗi tab có biểu đồ giá của ' +
      'mục đang chọn và bảng liệt kê kèm mức biến động theo tuần, tháng, quý, năm. ' +
      'Bấm một dòng trong bảng để đổi biểu đồ.',
    suggestions: () => ['Trang này theo dõi gì?', 'Cách đọc các cột biến động?', 'Giá hàng hoá liên quan gì tới cổ phiếu?'],
  },
  '/macro': {
    title: 'Kinh tế vĩ mô',
    body:
      'Trang theo dõi các chỉ tiêu kinh tế vĩ mô, lãi suất tiền tệ và tỷ giá, chia theo tab. ' +
      'Mỗi tab có biểu đồ của mục đang chọn, mặc định khung một năm, kèm bảng liệt kê ' +
      'và mức biến động theo nhiều mốc thời gian.',
    suggestions: () => ['Các chỉ tiêu vĩ mô này nghĩa là gì?', 'Lãi suất ảnh hưởng tới chứng khoán ra sao?'],
  },
  '/international': {
    title: 'Tài chính quốc tế',
    body:
      'Trang theo dõi thị trường tài chính toàn cầu, chia theo tab: chứng khoán, ngoại hối, ' +
      'trái phiếu, tiền mã hoá. Mỗi tab có biểu đồ mục đang chọn và bảng liệt kê kèm mức biến động.',
    suggestions: () => ['Trang này theo dõi gì?', 'Thị trường quốc tế ảnh hưởng tới Việt Nam thế nào?'],
  },
  '/watchlist': {
    title: 'Danh sách theo dõi',
    body:
      'Trang công cụ theo dõi. Có khối chỉ số thị trường, khối chỉ số ngành, và các danh mục ' +
      'do user tự tạo. Danh mục sắp xếp nhiều cột và nhiều trang, kéo thả để đổi thứ tự, ' +
      'đổi được kiểu sắp xếp. Mỗi dòng hiển thị giá, mức biến động, thanh khoản và giá trị giao dịch. ' +
      'Đây là công cụ theo dõi, không phải khuyến nghị mua bán.',
    suggestions: () => ['Cách tạo danh mục theo dõi?', 'Các cột trong danh mục nghĩa là gì?'],
  },
};

const DYNAMIC: DynamicEntry[] = [
  {
    prefix: '/stocks',
    title: 'Chi tiết cổ phiếu',
    body:
      'Trang phân tích chi tiết một mã. Có giá và mức biến động, thông tin doanh nghiệp, ' +
      'các chỉ số định giá, và chuyển được giữa chế độ thông tin và biểu đồ. ' +
      'Bên dưới là các tab: Dòng tiền, Kỹ thuật, Tài chính, Tin tức. ' +
      'Một số tab yêu cầu gói hội viên phù hợp.',
    tabs: {},
    suggestions: (s) => [`Giải thích các chỉ số của ${s}`, 'Cách đọc tab Dòng tiền?', 'Bản đồ giá dùng thế nào?'],
  },
  {
    prefix: '/sectors',
    title: 'Chi tiết ngành',
    body:
      'Trang phân tích chi tiết một ngành. Có biểu đồ chỉ số ngành, thông tin phiên, ' +
      'dải chỉ số định giá ngành, và các tab: Dòng tiền, Cổ phiếu trong ngành, Tài chính, Tin tức. ' +
      'Tab Cổ phiếu có bảng xếp hạng và bản đồ ngành. Một số tab yêu cầu gói hội viên phù hợp.',
    tabs: {},
    suggestions: (s) => [`Ngành ${s} đang thế nào?`, 'Cách đọc bản đồ ngành?', 'Tab Tài chính là số liệu gì?'],
  },
  {
    prefix: '/groups',
    title: 'Chi tiết nhóm cổ phiếu',
    body:
      'Trang phân tích chi tiết một rổ chỉ số của Finext. Có biểu đồ chỉ số rổ, thông tin phiên, ' +
      'các biểu đồ dòng tiền và thanh khoản của rổ, bảng cổ phiếu nổi bật trong nhóm và bản đồ nhóm. ' +
      'Đây là rổ phân theo dòng tiền hoặc vốn hoá, không phải ngành nghề. ' +
      'Phần nâng cao yêu cầu gói hội viên phù hợp.',
    suggestions: (s) => [`Nhóm ${s} gồm những gì?`, 'Cách đọc bản đồ nhóm?'],
  },
  {
    prefix: '/charts',
    title: 'Biểu đồ kỹ thuật',
    body:
      'Trang biểu đồ kỹ thuật của một mã, có thể là cổ phiếu, chỉ số hoặc ngành. ' +
      'Gồm biểu đồ nến và khối lượng, đổi được khung thời gian và loại biểu đồ. ' +
      'Có bảng chỉ báo bật tắt được, bảng thông tin mã, và bảng danh mục theo dõi. ' +
      'Bảng chỉ báo yêu cầu gói hội viên phù hợp. Đây là công cụ phân tích tham khảo, ' +
      'không phải khuyến nghị đầu tư.',
    suggestions: (s) => [`Cách đọc biểu đồ nến của ${s}?`, 'Bật chỉ báo thế nào?', 'Các chỉ báo này nghĩa là gì?'],
  },
];

function normalize(pathname: string): string {
  const p = pathname.split('?')[0].split('#')[0];
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

function resolve(pathname: string): { entry: Entry; subject?: string } | undefined {
  const path = normalize(pathname);
  const exact = EXACT[path];
  if (exact) return { entry: exact };
  for (const d of DYNAMIC) {
    if (!path.startsWith(`${d.prefix}/`)) continue;
    const rest = path.slice(d.prefix.length + 1);
    if (!rest || rest.includes('/')) continue; // chỉ nhận đúng một đoạn
    return { entry: d, subject: decodeURIComponent(rest) };
  }
  return undefined;
}

/** Chuỗi ngữ cảnh gửi kèm lượt chat. undefined = trang không có ngữ cảnh (không hiện bubble). */
export function buildPageContext(pathname: string, search?: SearchLike): string | undefined {
  const hit = resolve(pathname);
  if (!hit) return undefined;
  const { entry, subject } = hit;

  const head = [`Trang: ${entry.title}`];
  if (subject) head.push(`Đang xem: ${subject}`);
  const tabKey = search?.get('tab');
  if (tabKey) head.push(`Tab: ${entry.tabs?.[tabKey] ?? tabKey}`);

  const out = [HEADER, head.join(' · '), entry.body].join('\n');
  return out.length > PAGE_CONTEXT_MAX ? out.slice(0, PAGE_CONTEXT_MAX) : out;
}

/** 2-3 câu hỏi gợi ý hiển thị khi mở bubble ở trạng thái trống. */
export function getSuggestions(pathname: string): string[] {
  const hit = resolve(pathname);
  return hit ? hit.entry.suggestions(hit.subject) : [];
}

/** Trang này có hiện bubble không. Nguồn sự thật duy nhất cho việc ẩn/hiện. */
export function hasBubble(pathname: string): boolean {
  return resolve(pathname) !== undefined;
}
```

- [ ] **Step 5: Chạy test để xác nhận nó pass**

```bash
cd finext-nextjs && node --test services/chatPageContext.test.ts
```
Expected: PASS 11/11. (Cảnh báo `MODULE_TYPELESS_PACKAGE_JSON` là bình thường, chỉ nói về hiệu năng.)

- [ ] **Step 6: Điền ánh xạ tab từ mã nguồn thật**

Ánh xạ `tabs` hiện để trống nên ngữ cảnh sẽ hiển thị nguyên giá trị `?tab=` (vẫn dùng được). Nay điền nhãn dễ hiểu bằng cách đọc hằng số danh sách tab trong từng file, rồi thêm vào `EXACT`/`DYNAMIC` tương ứng:

| Đọc file | Hằng số cần lấy | Điền vào |
|---|---|---|
| `app/(main)/markets/PageContent.tsx` | danh sách tab của SubNavbar | `EXACT['/markets'].tabs` |
| `app/(main)/phase/PageContent.tsx` | hằng `TABS` (dòng ~17) | `EXACT['/phase'].tabs` |
| `app/(main)/commodities/PageContent.tsx` | danh sách category | `EXACT['/commodities'].tabs` |
| `app/(main)/macro/PageContent.tsx` | danh sách category | `EXACT['/macro'].tabs` |
| `app/(main)/international/PageContent.tsx` | hằng `VALID_TABS` + nhãn SubNavbar | `EXACT['/international'].tabs` |
| `app/(main)/stocks/[symbol]/PageContent.tsx` | danh sách tab sub-navbar | `DYNAMIC` mục `prefix: '/stocks'` |
| `app/(main)/sectors/[sectorId]/PageContent.tsx` | danh sách tab sub-navbar | `DYNAMIC` mục `prefix: '/sectors'` |

Mỗi mục dạng `{ 'gia-tri-tren-url': 'Nhãn tiếng Việt' }`, ví dụ `{ dongtien: 'Dòng tiền' }`. Chỉ chép nhãn, **không chép số liệu**.

- [ ] **Step 7: Chạy lại test sau khi điền tab**

```bash
cd finext-nextjs && node --test services/chatPageContext.test.ts
```
Expected: vẫn PASS 11/11.

- [ ] **Step 8: Kiểm tra kiểu**

```bash
cd finext-nextjs && npx tsc --noEmit; echo "EXIT=$?"
```
Expected: `EXIT=0`.

- [ ] **Step 9: Dừng — KHÔNG commit**

Để nguyên thay đổi ở working tree. Báo cáo: số test pass, kết quả tsc, và các nhãn tab đã điền được ở Step 6.

---

## Task 3: Đường ống gửi ngữ cảnh lên backend

**Files:**
- Modify: `finext-nextjs/services/chatClient.ts:13-18`
- Modify: `finext-nextjs/hooks/useChatStore.ts` (chữ ký hook dòng 107; `runStream` dòng 203-204; lời gọi `streamChat` dòng 292; thêm effect huỷ stream khi unmount)

**Interfaces:**
- Consumes: `buildPageContext(pathname, search)` từ Task 2 — nhưng hook **không** tự gọi; nó nhận hàm lấy ngữ cảnh do bên gọi truyền vào.
- Produces: `useChatStore(initialConversationId?: string, getPageContext?: () => string | undefined)` — tham số thứ hai tuỳ chọn; khi không truyền thì không gửi `page_context`.

- [ ] **Step 1: Thêm field vào body gửi đi**

Trong `finext-nextjs/services/chatClient.ts`, sửa `ChatStreamBody` (dòng 13-18) thành:

```ts
export interface ChatStreamBody {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  conversation_id?: string;
  thinking?: boolean; // true = M3 suy nghĩ sâu (adaptive) — backend nhận, default false
  page_context?: string; // ngữ cảnh trang (bubble chat) — không hiển thị cho user, không lưu lịch sử
}
```

- [ ] **Step 2: Cho hook nhận hàm lấy ngữ cảnh**

Trong `finext-nextjs/hooks/useChatStore.ts`, sửa chữ ký (dòng 107):

```ts
export default function useChatStore(
  initialConversationId?: string,
  getPageContext?: () => string | undefined,
): UseChatStoreReturn {
```

Thêm ref giữ hàm mới nhất, ngay sau `thinkingRef` (sau dòng 124):

```ts
  const pageContextRef = useRef<(() => string | undefined) | undefined>(getPageContext); // đọc lúc gửi → luôn khớp trang hiện tại
  pageContextRef.current = getPageContext;
```

- [ ] **Step 3: Gửi ngữ cảnh kèm mỗi lượt**

Trong cùng file, sửa lời gọi `streamChat` (dòng 292) thành:

```ts
        for await (const ev of streamChat(
          {
            history,
            message,
            conversation_id: serverId ?? undefined,
            thinking: thinkingRef.current,
            page_context: pageContextRef.current?.(),
          },
          controller.signal,
        )) {
```

Lấy ngữ cảnh **tại thời điểm gửi** nên `send` và `retry` đều tự động dùng ngữ cảnh của trang user đang đứng, không cần sửa hai hàm đó.

- [ ] **Step 4: Dọn timer khi component bị gỡ — CỐ Ý KHÔNG huỷ stream**

Vẫn trong `finext-nextjs/hooks/useChatStore.ts`, thêm effect sau trọn khối khai báo ref (sau `pendingOpenRef`):

```ts
  // Unmount: CHỈ dọn timer. CỐ Ý KHÔNG abort stream đang chạy — backend chỉ lưu câu trả lời ở
  // nhánh chạy trọn vẹn, bị huỷ là mất luôn. Để stream chạy nốt thì câu trả lời vẫn được lưu và
  // user thấy đủ khi mở lại hội thoại ở /chat (đúng cơ chế bàn giao qua CSDL của bubble).
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);
```

**Lý do quan trọng:** trong `app/routers/chat.py`, `_persist_answer` chỉ chạy ở nhánh `else` của khối try; `asyncio.CancelledError` được `raise` lại nên **bỏ qua bước lưu**. Nếu abort khi unmount thì kịch bản "đang trả lời dở → bấm Mở rộng → sang `/chat`" sẽ **mất câu trả lời** — phá đúng luồng bàn giao cốt lõi. React 18 không còn cảnh báo setState sau unmount nên để stream chạy nốt là an toàn.

- [ ] **Step 5: Kiểm tra kiểu**

```bash
cd finext-nextjs && npx tsc --noEmit; echo "EXIT=$?"
```
Expected: `EXIT=0`.

- [ ] **Step 6: Xác nhận trang /chat không đổi hành vi**

Kiểm bằng mắt: trong `finext-nextjs/app/(main)/chat/PageContent.tsx` dòng ~57, lời gọi `useChatStore(...)` **không** truyền tham số thứ hai. Vì `getPageContext` là `undefined`, `page_context` gửi lên cũng là `undefined` và bị bỏ khỏi JSON — request giống hệt trước.

```bash
grep -n "useChatStore(" finext-nextjs/app/\(main\)/chat/PageContent.tsx
```
Expected: chỉ có một tham số (hoặc không tham số).

- [ ] **Step 7: Dừng — KHÔNG commit**

Để nguyên thay đổi ở working tree. Báo cáo: kết quả tsc và bằng chứng trang `/chat` không truyền tham số thứ hai.

---

## Task 4: MessageList hỗ trợ cuộn trong khung

**Files:**
- Modify: `finext-nextjs/app/(main)/chat/components/MessageList.tsx` (phần auto-scroll dùng `window.scrollY` / `document.documentElement.scrollHeight`, khoảng dòng 91 và 98)

**Interfaces:**
- Consumes: không.
- Produces: prop mới `scrollMode?: 'window' | 'container'` trên `MessageList`; mặc định `'window'` giữ nguyên hành vi trang `/chat`.

- [ ] **Step 1: Thêm prop và ref khung cuộn**

Trong `finext-nextjs/app/(main)/chat/components/MessageList.tsx`:

1. Thêm `scrollMode?: 'window' | 'container'` vào interface props của component, kèm chú thích:
   `/** 'window' = cuộn theo trang (mặc định, trang /chat). 'container' = cuộn trong khung (bubble). */`
2. Nhận prop với mặc định: `scrollMode = 'window'`.
3. Thêm `const scrollBoxRef = useRef<HTMLDivElement | null>(null);`
4. Gắn `ref={scrollBoxRef}` vào **Box gốc sẵn có** của component (Box `maxWidth: 760`), và chỉ khi `scrollMode === 'container'` thì spread thêm `{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, pt: 2 }` vào `sx`. **KHÔNG bọc thêm Box con**: Box gốc không nằm trong flex column bị chặn chiều cao, nên `flex: 1` đặt trên một Box con sẽ vô tác dụng và khung sẽ không cuộn được. Việc ghi đè `px`/`pt` ở nhánh container là để bỏ khoảng đệm 56px vốn dùng để né header cố định của trang `/chat` — trong cửa sổ bubble nhỏ khoảng đệm đó là thừa. Nhánh `'window'` không thêm key nào nên bố cục giữ nguyên tuyệt đối.

- [ ] **Step 2: Cho logic auto-scroll đọc đúng nguồn**

Thay hai chỗ đọc vị trí cuộn (khoảng dòng 91 và 98) bằng hai hàm trợ giúp đặt trong component:

```ts
  const readScroll = useCallback(() => {
    if (scrollMode === 'container') {
      const el = scrollBoxRef.current;
      if (!el) return { top: 0, height: 0, viewport: 0 };
      return { top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight };
    }
    return {
      top: window.scrollY,
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    };
  }, [scrollMode]);

  const scrollToBottom = useCallback(() => {
    if (scrollMode === 'container') {
      const el = scrollBoxRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [scrollMode]);
```

Lưu ý: nhánh `'window'` cuộn **tức thì** đúng như mã hiện tại của `/chat` (không thêm `behavior: 'smooth'`), chỉ nhánh `'container'` mới cuộn mượt.

Sửa các chỗ đang dùng trực tiếp `window.scrollY` / `document.documentElement.scrollHeight` / `window.scrollTo` để gọi `readScroll()` và `scrollToBottom()`. Khi `scrollMode === 'container'`, listener `scroll` phải gắn vào `scrollBoxRef.current` thay vì `window`.

- [ ] **Step 3: Kiểm tra kiểu**

```bash
cd finext-nextjs && npx tsc --noEmit; echo "EXIT=$?"
```
Expected: `EXIT=0`.

- [ ] **Step 4: Xác nhận trang /chat không bị đổi**

```bash
grep -n "scrollMode" finext-nextjs/app/\(main\)/chat/MessageList.tsx finext-nextjs/app/\(main\)/chat/PageContent.tsx 2>/dev/null; grep -rn "<MessageList" finext-nextjs/app/\(main\)/chat/
```
Expected: chỗ dùng `MessageList` trong trang `/chat` **không** truyền `scrollMode` → chạy nhánh `'window'` như cũ.

- [ ] **Step 5: Dừng — KHÔNG commit**

Để nguyên thay đổi ở working tree. Báo cáo: kết quả tsc và bằng chứng chỗ dùng `MessageList` ở `/chat` không truyền `scrollMode`.

---

## Task 5: Cửa sổ bubble

**Files:**
- Create: `finext-nextjs/components/chatBubble/BubbleMessages.tsx`
- Create: `finext-nextjs/components/chatBubble/ChatBubble.tsx`

**Interfaces:**
- Consumes: `buildPageContext(pathname, search?)`, `getSuggestions(pathname)`, `hasBubble(pathname)` từ `services/chatPageContext.ts` (Task 2); `useChatStore(initialConversationId?, getPageContext?)` (Task 3); `MessageList` với `scrollMode="container"` (Task 4); `Composer` (prop `centered={false}`) từ `app/(main)/chat/components/Composer.tsx`; kiểu `ChatMessage` export từ `hooks/useChatStore.ts` — nếu chưa export thì thêm `export` vào khai báo type đó (thay đổi duy nhất được phép ở file này trong task này).
- Produces: `export default function ChatBubble(): JSX.Element | null`.

**Ghi chú thiết kế:** phần này là giao diện, owner sẽ tự kiểm thử và tinh chỉnh bằng mắt. Plan mô tả cấu trúc, ràng buộc và trạng thái phải đúng; cách bố trí chi tiết theo ngôn ngữ thiết kế sẵn có của dự án.

- [ ] **Step 1: Viết BubbleMessages**

Tạo `finext-nextjs/components/chatBubble/BubbleMessages.tsx`. Đây là lớp bọc mỏng:

- Props: `messages` (kiểu `ChatMessage[]` lấy từ `hooks/useChatStore`), `phase`, `suggestions: string[]`, `onPickSuggestion: (q: string) => void`, và các prop `MessageList` đang cần.
- Khi `messages.length === 0`: hiển thị lời chào ngắn một dòng (ví dụ *"Mình có thể giải thích những gì đang hiển thị trên trang này."*) và danh sách `suggestions` dạng chip bấm được; bấm chip gọi `onPickSuggestion(q)`.
- Khi có tin nhắn: render `<MessageList scrollMode="container" ... />`.
- Không tự quản lý state hội thoại — chỉ nhận props.

- [ ] **Step 2: Viết ChatBubble**

Tạo `finext-nextjs/components/chatBubble/ChatBubble.tsx`, `'use client'`.

Yêu cầu bắt buộc:

1. **Ẩn/hiện:** lấy `pathname = usePathname()`; nếu `!hasBubble(pathname)` thì `return null`. Đây là nguồn sự thật duy nhất — `/chat`, `/profile/*`, tin tức, báo cáo… đều tự động không có bubble.
2. **Nạp lười, mount một lần:** state `const [opened, setOpened] = useState(false)` (đã từng mở lần nào chưa) và `const [visible, setVisible] = useState(false)` (đang mở hay không). Component con `BubbleChat` — nơi gọi `useChatStore` — chỉ render khi `opened === true`, và từ đó **giữ nguyên trong cây**, chỉ ẩn hiện bằng `sx={{ display: visible ? 'flex' : 'none' }}`. Nhờ vậy đóng rồi mở lại vẫn còn hội thoại, và trang chỉ để xem không phát sinh request nào.
3. **Ngữ cảnh:** trong `BubbleChat`, lấy `searchParams = useSearchParams()` và truyền cho hook:
   ```ts
   const store = useChatStore(undefined, () => buildPageContext(pathnameRef.current, searchParamsRef.current));
   ```
   Dùng ref cập nhật mỗi render để hàm luôn đọc giá trị mới nhất tại thời điểm gửi.
4. **Chưa đăng nhập:** nếu chưa đăng nhập thì vẫn hiện nút tròn; mở ra hiển thị lời mời đăng nhập kèm nút chuyển tới trang đăng nhập, và **không** render `BubbleChat` (không gọi API). Lấy trạng thái đăng nhập theo đúng cách các trang khác trong dự án đang dùng.
5. **Nút tròn:** cố định góc trái dưới. Desktop cách mép 24px. Trên mobile phải đẩy cao hơn thanh điều hướng đáy **56px** để không đè lên (tham chiếu `BAR_HEIGHT` trong `components/layout/MobileBottomBar.tsx`).
6. **Cửa sổ:** khoảng 380×560 trên desktop; mobile gần toàn màn hình. Dùng glass card chuẩn của dự án (`getGlassCard` trong `theme/tokens`). Header có tên trợ lý, nút **Mở rộng**, nút **Đóng**. Thân là `BubbleMessages`. Chân là `Composer` ở chế độ **không** căn giữa (`centered={false}`) cộng thanh thông báo hạn mức khi `store.limitNotice` khác null.
7. **z-index:** cao hơn Drawer điều hướng (MUI `drawer` = 1200) để không bị che — dùng `theme.zIndex.modal` hoặc giá trị lớn hơn 1200.
7b. **RÀNG BUỘC BỐ CỤC BẮT BUỘC (kéo từ Task 4):** `MessageList` ở chế độ `container` tự nó là khung cuộn bằng `flex: 1; minHeight: 0; overflowY: auto`. Vì vậy **phần tử cha của nó bắt buộc phải là flex column có chiều cao bị chặn** (`display: flex; flexDirection: column;` + chiều cao cố định hoặc `height: 100%`). Nếu cha không chặn chiều cao, khung sẽ không cuộn mà đùn dài ra. Tham khảo cách trang `/chat` dựng cột ở `app/(main)/chat/PageContent.tsx`.
8. **Nút Mở rộng:** lấy `serverId` của hội thoại đang mở; nếu có thì `router.push('/chat/' + serverId)`, nếu chưa có (chưa gửi lượt nào) thì `router.push('/chat')`.

- [ ] **Step 3: Kiểm tra kiểu**

```bash
cd finext-nextjs && npx tsc --noEmit; echo "EXIT=$?"
```
Expected: `EXIT=0`.

- [ ] **Step 4: Dừng — KHÔNG commit**

Để nguyên thay đổi ở working tree. Báo cáo: kết quả tsc và cách 8 ràng buộc bắt buộc ở Step 2 đã được đáp ứng.

---

## Task 6: Gắn bubble vào layout và nghiệm thu

**Files:**
- Modify: `finext-nextjs/app/(main)/LayoutContent.tsx` (thêm bubble cạnh `<MobileBottomBar />`, khoảng dòng 1082-1083)

**Interfaces:**
- Consumes: `ChatBubble` từ `components/chatBubble/ChatBubble` (Task 5).
- Produces: không.

- [ ] **Step 1: Mount bubble**

Trong `finext-nextjs/app/(main)/LayoutContent.tsx`, thêm import ở đầu file:

```ts
import ChatBubble from 'components/chatBubble/ChatBubble';
```

Rồi render ngay cạnh `<MobileBottomBar />` (khoảng dòng 1082-1083), là phần tử anh em cùng cấp:

```tsx
      <ChatBubble />
```

Không cần điều kiện ở đây — `ChatBubble` tự trả `null` với các route không có ngữ cảnh.

- [ ] **Step 2: Kiểm tra kiểu**

```bash
cd finext-nextjs && npx tsc --noEmit; echo "EXIT=$?"
```
Expected: `EXIT=0`.

- [ ] **Step 3: Chạy lại test frontend**

```bash
cd finext-nextjs && node --test services/chatPageContext.test.ts
```
Expected: PASS 11/11.

- [ ] **Step 4: Chạy lại toàn bộ test backend**

```bash
cd finext-fastapi && python -m pytest -q 2>&1 | tail -10; echo "EXIT=${PIPESTATUS[0]}"
```
Expected: `EXIT=0`, 401 passed.

- [ ] **Step 5: Dừng — KHÔNG commit**

Để nguyên thay đổi ở working tree. Đây là task cuối; owner sẽ tự kiểm thử giao diện rồi mới cho commit một lần cho toàn bộ tính năng.

- [ ] **Step 6: Bàn giao owner kiểm thử giao diện**

Không tự dựng browser. Báo owner checklist tự kiểm:

1. Bubble hiện ở cả 14 trang sản phẩm; **không** hiện ở `/chat`, `/profile/*`, tin tức, báo cáo, `/plans`, `/open-account`, hướng dẫn, chính sách, hỗ trợ.
2. Vào `/stocks/HPG`, mở bubble, hỏi "giải thích các chỉ số của mã này" → AI trả lời đúng về HPG mà không cần nhắc tên mã.
3. Đổi sang tab khác rồi hỏi tiếp → AI hiểu đang ở tab mới.
4. Hội thoại vừa tạo xuất hiện trong lịch sử ở `/chat`, mở ra chat tiếp được.
5. Bấm **Mở rộng** → sang đúng `/chat/{id}` của hội thoại đó.
6. Trang `/chat` hoạt động y hệt trước: cuộn, gửi, ghim, đổi tên, xoá, phản hồi.
7. Mobile: nút tròn không đè thanh điều hướng đáy; mở menu điều hướng thì bubble không đè lên sai lớp.
8. Đăng xuất rồi mở bubble → hiện lời mời đăng nhập, không lỗi.

---

## Tiêu chí hoàn thành

- Bubble hiện đúng 14 trang, ẩn ở mọi trang còn lại.
- Ngữ cảnh trang tới được model qua khối system cuối, không lọt vào lịch sử hội thoại.
- Hội thoại từ bubble nằm chung lịch sử với trang `/chat`.
- Trang `/chat` không hồi quy.
- `pytest` toàn bộ xanh · `node --test` xanh · `npx tsc --noEmit` exit 0.
- Không thêm dependency nào; không sửa dòng nào trong 14 trang sản phẩm.

---

## Kết quả thực thi (2026-07-20)

**Cả 6 task XONG.** Sau đó có thêm nhiều vòng chỉnh giao diện theo phản hồi trực tiếp của owner — chi tiết đầy đủ ở **§10 của spec**.

| Cổng kiểm tra | Kết quả |
|---|---|
| `pytest` toàn bộ | 405 passed (401 cũ + 7 test ngữ cảnh + 4 test hồi quy múi giờ, trừ trùng lặp đếm) |
| `node --test` | 17/17 |
| `npx tsc --noEmit` | exit 0 |
| Không thêm dependency | đúng |
| Không sửa 14 trang sản phẩm | đúng |

**Ba chỗ plan viết sai, đã sửa trong lúc thực thi** (ghi lại để rút kinh nghiệm cho plan sau):

1. **Huỷ stream khi unmount** (Task 3) — plan yêu cầu huỷ, nhưng backend chỉ lưu câu trả lời ở nhánh chạy trọn vẹn nên huỷ là mất câu trả lời đúng lúc bàn giao sang `/chat`. Đã bỏ.
2. **Bọc Box con để cuộn** (Task 4) — không cuộn được vì Box cha không phải flex column bị chặn chiều cao. Đã đặt thuộc tính cuộn thẳng lên Box gốc.
3. **Mã ngành ví dụ `ryganhang`** — là mã **bịa**, do subagent khảo sát nêu ra và plan chép lại mà không đối chiếu dữ liệu thật. Mã thật dùng gạch dưới (`nganhang`, `chung_khoan`, `dmts`…). Test vẫn xanh với mã bịa vì nó chỉ kiểm định dạng chuỗi. **Bài học: giá trị ví dụ đưa vào test phải đối chiếu dữ liệu thật.**
