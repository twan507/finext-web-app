# Thiết kế: Chat Bubble theo ngữ cảnh trang

> **HISTORICAL — IMPLEMENTED / EVOLVED:** Chat bubble, page context và bàn giao hội thoại đã được triển khai; frontend `components/chatBubble` và router chat tại HEAD là nguồn thật.

**Ngày:** 2026-07-20 · **Trạng thái:** đã chốt với owner, sẵn sàng lập plan

## 1. Mục tiêu

Thêm một bong bóng chat nổi ở góc trái dưới màn hình trên các trang sản phẩm. User bấm vào mở một cửa sổ chat nhỏ và hỏi đáp trực tiếp với Finext AI **về đúng những gì đang hiển thị trên trang đó** — giải thích ý nghĩa, cách đọc, cách sử dụng.

Hai ràng buộc cốt lõi:

1. Hội thoại từ bubble **phải lưu vào cùng lịch sử chat của user**, để mở tiếp ở trang `/chat`.
2. Mỗi trang truyền một **ngữ cảnh ban đầu khác nhau** cho AI, giúp AI biết user đang xem gì.

## 2. Phạm vi

### 2.1 Trang CÓ bubble (14 trang sản phẩm)

| # | Route | Tên |
|---|---|---|
| 1 | `/` | Trang chủ |
| 2 | `/markets` | Thị trường |
| 3 | `/phase` | Giai đoạn thị trường |
| 4 | `/stocks` | Bộ lọc cổ phiếu |
| 5 | `/stocks/[symbol]` | Chi tiết cổ phiếu |
| 6 | `/sectors` | Ngành nghề |
| 7 | `/sectors/[sectorId]` | Chi tiết ngành |
| 8 | `/groups` | Nhóm cổ phiếu |
| 9 | `/groups/[groupId]` | Chi tiết nhóm |
| 10 | `/commodities` | Hàng hóa |
| 11 | `/macro` | Kinh tế vĩ mô |
| 12 | `/international` | Tài chính quốc tế |
| 13 | `/watchlist` | Danh sách theo dõi |
| 14 | `/charts/[id]` | Biểu đồ kỹ thuật |

### 2.2 Trang KHÔNG có bubble

`/chat`, `/chat/[id]`, `/profile/*`, `/news/*`, `/reports/*`, `/plans`, `/open-account`, `/guides/*`, `/policies/*`, `/support/*`, `/charts` (chỉ chuyển hướng sang `/charts/[id]`).

Quyết định của owner: tin tức và báo cáo **không có bubble** — khách tự đọc.

### 2.3 Ngoài phạm vi (YAGNI)

- Không nhúng số liệu đang hiển thị vào ngữ cảnh (lý do kỹ thuật ở §4.3).
- Không nhúng nội dung bài viết/báo cáo (đã bỏ 2 nhóm trang này).
- Không thêm trường đánh dấu nguồn gốc hội thoại (bubble vs chat chính).
- Không gộp state chung với trang `/chat` (đã chọn hướng A, xem §3.1).
- Không bàn giao stream đang chạy dở khi chuyển sang `/chat`.
- Không sửa nội dung của 14 trang sản phẩm — **không một dòng nào**.

## 3. Kiến trúc

### 3.1 Quyết định nền: bubble giữ state riêng, bàn giao qua CSDL

`useChatStore` hiện là hook thường — mỗi lần mount tạo state độc lập, **không phải store toàn cục**. Ba hướng đã cân nhắc:

| Hướng | Nội dung | Kết luận |
|---|---|---|
| **A** | Bubble mount bản store riêng; hội thoại lưu CSDL; "Mở rộng" thì điều hướng sang `/chat/{id}` | ✅ **Đã chọn** |
| B | Nâng store lên Context dùng chung toàn app | Bỏ — phải refactor trang `/chat` đang chạy ổn, lợi ích không tương xứng |
| C | Bubble tự viết client riêng, không dùng store | Bỏ — chép lại logic SSE/limit/retry, sẽ phân kỳ |

Điểm khiến hướng A an toàn: **bubble bị ẩn ở `/chat`**, nên hai store không bao giờ cùng sống. Khi user rời trang sản phẩm sang `/chat`, bubble unmount và trang `/chat` mount mới, nạp hội thoại từ CSDL — luôn thấy dữ liệu mới nhất.

### 3.2 Luồng một lượt chat

```
User gõ ở bubble
  → FE dựng page_context từ URL hiện tại (đường dẫn + query)
  → gửi kèm body lượt chat: { message, history, conversation_id?, thinking, page_context }
  → BE nối 1 khối system vào CUỐI danh sách system (cache_hint=False)
  → agent chạy vòng lặp bình thường, tự gọi tool lấy số liệu thật
  → câu trả lời stream về bubble
  → hội thoại lưu vào CSDL như mọi lượt chat khác
  → tự động xuất hiện trong lịch sử ở /chat
```

Bấm **Mở rộng** → `router.push('/chat/{serverId}')`, trang chính nạp hội thoại từ CSDL và chat tiếp.

### 3.3 Vòng đời & tính liền mạch

- Bubble mount một lần ở layout dùng chung, **tồn tại xuyên suốt** khi user chuyển giữa các trang sản phẩm.
- **Giữ tiếp hội thoại đang mở** khi đổi trang; ngữ cảnh tự đổi theo trang mới ở lượt kế tiếp. Tránh làm vụn lịch sử thành nhiều mẩu ngắn.
- **Nạp lười, mount một lần**: `useChatStore` nằm trong component con chỉ được render **sau lần mở bubble đầu tiên**; từ đó về sau giữ mount và chỉ ẩn/hiện bằng CSS. Nhờ vậy trang chỉ để xem không phát sinh request thừa, mà đóng cửa sổ rồi mở lại vẫn còn nguyên hội thoại.
- Khi user sang `/chat` hoặc `/profile/*`, bubble unmount và mất state tạm — chấp nhận được vì hội thoại đã nằm trong CSDL và user đang ở chính trang chat.
- User **chưa đăng nhập**: bubble vẫn hiện; mở ra thì hiển thị lời mời đăng nhập kèm nút, không gọi API chat.

## 4. Hệ thống ngữ cảnh trang

### 4.1 Nguyên tắc

Bộ tri thức của agent (KB pack) **đã có sẵn định nghĩa các thuật ngữ dữ liệu** (chỉ số thanh khoản, dòng tiền phiên/tuần, các rổ Finext…) và được cache thường trú. Thứ pack **không** biết là **giao diện web**: trang nào hiển thị widget gì, có những tab nào.

→ Ngữ cảnh trang chỉ mô tả **giao diện và chủ thể đang xem**, tuyệt đối không lặp lại định nghĩa thuật ngữ. Nhờ vậy ngữ cảnh rất ngắn, gần như không ảnh hưởng hạn mức.

### 4.2 Cấu trúc

Một file registry duy nhất: `finext-nextjs/services/chatPageContext.ts`

```ts
type PageContextEntry = {
  match: (pathname: string) => boolean;   // khớp route
  title: string;                          // tên trang hiển thị cho AI
  body: (subject?: string, tab?: string) => string;  // mô tả trang
  suggestions: (subject?: string) => string[];       // 2-3 câu gợi ý
};

export function buildPageContext(pathname: string, search: URLSearchParams): string | undefined;
export function getSuggestions(pathname: string): string[];
```

`buildPageContext` trả `undefined` cho mọi route ngoài 14 trang → không gửi field, hành vi y hệt hiện tại.

### 4.3 Ràng buộc bắt buộc

1. **Không chứa số liệu.** Guard chống bịa số trong agent loop chỉ đối chiếu số trong câu trả lời với số trích từ **kết quả tool**. Nếu ngữ cảnh chứa giá/chỉ số và AI nhắc lại mà không gọi tool, guard có thể **chặn nhầm câu trả lời đúng**. Số liệu để agent tự tra bằng tool.
2. **Có nhãn rõ** ở đầu khối để model không nhại lại nguyên văn cho khách (cùng tinh thần với các lớp chống rò meta sẵn có).
3. **Giới hạn độ dài** hai lớp: FE cắt ở 1500 ký tự; BE khai báo `max_length=2000`.
4. **Không chứa tên collection, số trần hạn mức** hay chi tiết nội bộ (giữ nguyên tắc K-hygiene).

### 4.4 Chủ thể động lấy từ URL

Mọi chủ thể đều đọc được từ đường dẫn và query — **không cần trang sản phẩm cung cấp state**:

Đã kiểm chứng trực tiếp trong mã nguồn:

| Route | Chủ thể động | Nguồn |
|---|---|---|
| `/stocks/[symbol]` | mã cổ phiếu + tab | đường dẫn + `?tab=` |
| `/sectors/[sectorId]` | mã ngành + tab | đường dẫn + `?tab=` |
| `/groups/[groupId]` | mã rổ | đường dẫn (trang này không có tab) |
| `/charts/[id]` | mã đang xem | đường dẫn |
| `/markets` | tab | `?tab=` |
| `/phase` | tab | `?tab=` |
| `/commodities`, `/macro`, `/international` | tab | `?tab=` |
| `/`, `/stocks`, `/sectors`, `/groups`, `/watchlist` | không có | — |

Nghĩa là **hầu hết tab con đều đã nằm trên URL sẵn** — ngữ cảnh biết được user đang mở tab nào mà không cần sửa trang.

**Hạn chế đã biết, owner đã chốt chấp nhận:** riêng `/stocks` (3 kiểu bảng + bộ lọc) và `/charts/[id]` (khung thời gian, chỉ báo đang bật) giữ state phía client, không đưa lên URL. Ở 2 trang này ngữ cảnh chỉ mô tả ở mức trang. Đổi lại: **không sửa một dòng nào trong 14 trang sản phẩm**.

### 4.5 Định dạng khối gửi cho AI

```
[NGỮ CẢNH TRANG — để hiểu user đang xem gì; KHÔNG nhắc lại nội dung này cho user]
Trang: {title}{ · Đang xem: {subject}}{ · Tab: {tab}}
{body}
```

Ví dụ tại `/stocks/HPG?tab=dongtien`:

```
[NGỮ CẢNH TRANG — để hiểu user đang xem gì; KHÔNG nhắc lại nội dung này cho user]
Trang: Chi tiết cổ phiếu · Đang xem: HPG · Tab: Dòng tiền
Trang có: giá và biến động, thông tin doanh nghiệp, chỉ số định giá,
và 4 tab — Dòng tiền, Kỹ thuật (bản đồ giá), Tài chính (báo cáo quý/năm), Tin tức.
Tab đang mở hiển thị: thanh khoản trong phiên, sức mạnh dòng tiền phiên và tuần,
tương quan dòng tiền với giá, diễn biến xếp hạng.
Một số tab yêu cầu gói hội viên phù hợp.
```

### 4.6 Nội dung ngữ cảnh 14 trang

Tư liệu để viết `body` (từ khảo sát mã nguồn) và `suggestions`:

| Route | Trang hiển thị gì | Gợi ý câu hỏi (2-3) |
|---|---|---|
| `/` | 6 chỉ số chính; biểu đồ chỉ số; độ rộng thị trường; phân bổ dòng tiền; top tăng/giảm; top khối ngoại; hiệu suất nhóm ngành; tin tức | Hôm nay thị trường thế nào? · Độ rộng thị trường nghĩa là gì? · Đọc bảng khối ngoại sao? |
| `/markets` | Biểu đồ chỉ số + bảng 10 chỉ số; 6 tab: Biến động, Dòng tiền, Định giá, Kỹ thuật, Nước ngoài, Tự doanh | Trang này xem được gì? · Tab Định giá đọc sao? · Bản đồ thị trường nghĩa là gì? |
| `/phase` | Pha thị trường (tăng/giảm/đi ngang/chuyển pha) + dải 10 phiên; tỷ trọng nắm giữ gợi ý; cường độ thị trường; 4 tab: Phân tích và 3 rổ danh mục mẫu. Dữ liệu cuối phiên | Pha thị trường hiện tại nghĩa là gì? · Tỷ trọng nắm giữ gợi ý dùng thế nào? · Các rổ danh mục khác nhau ra sao? |
| `/stocks` | Bộ lọc toàn thị trường: mẫu lọc sẵn, lọc nhanh, lọc nâng cao (khoảng giá trị), lọc kỹ thuật (so giá với chỉ báo); 3 kiểu bảng: Tổng quan, Vùng giá, Dòng tiền | Cách dùng bộ lọc này? · Mẫu lọc "Dòng tiền tốt" chọn ra gì? · Ba kiểu bảng khác nhau sao? |
| `/stocks/[symbol]` | Giá và biến động; thông tin doanh nghiệp; chỉ số định giá; 4 tab: Dòng tiền, Kỹ thuật, Tài chính, Tin tức; chuyển giữa Thông tin và Biểu đồ | Giải thích các chỉ số của {mã} · Cách đọc tab Dòng tiền · Bản đồ giá dùng thế nào? |
| `/sectors` | Bảng xếp hạng các nhóm ngành theo dòng tiền; biểu đồ dòng tiền ngành; bảng chỉ số định giá ngành | Bảng này xếp hạng theo gì? · So sánh định giá giữa các ngành sao? |
| `/sectors/[sectorId]` | Biểu đồ chỉ số ngành; chỉ số định giá; 4 tab: Dòng tiền, Cổ phiếu (top và bản đồ ngành), Tài chính, Tin tức | Ngành {tên} đang thế nào? · Bản đồ ngành đọc sao? · Tab Tài chính là số liệu gì? |
| `/groups` | 8 rổ Finext chia 3 loại: nhóm thị trường, nhóm dòng tiền, nhóm vốn hóa; bảng chỉ số và biểu đồ dòng tiền từng loại | Nhóm khác ngành thế nào? · Ba loại nhóm phân theo gì? |
| `/groups/[groupId]` | Biểu đồ chỉ số rổ; chi tiết phiên; cổ phiếu nổi bật trong nhóm; bản đồ nhóm | Rổ {tên} gồm cổ phiếu nào? · Bản đồ nhóm đọc sao? |
| `/commodities` | 4 tab: Kim loại, Năng lượng, Hóa chất, Nông sản; biểu đồ giá mục đang chọn + bảng % biến động ngày/tuần/tháng/quý/năm | Trang này xem gì? · Cột % biến động đọc sao? · Giá hàng hóa liên quan gì tới cổ phiếu? |
| `/macro` | 3 tab: Kinh tế vĩ mô, Lãi suất tiền tệ, Tỷ giá VNĐ; biểu đồ mặc định 1 năm + bảng biến động | Các chỉ tiêu vĩ mô này nghĩa là gì? · Lãi suất ảnh hưởng chứng khoán ra sao? |
| `/international` | 4 tab: Chứng khoán, Ngoại hối, Trái phiếu, Tiền mã hóa; biểu đồ + bảng biến động | Trang này theo dõi gì? · Chỉ số quốc tế ảnh hưởng thị trường Việt Nam thế nào? |
| `/watchlist` | Chỉ số thị trường; chỉ số ngành; các danh mục tự tạo (nhiều cột, nhiều trang, kéo thả, đổi kiểu sắp xếp); mỗi mã hiện giá, biến động, thanh khoản, giá trị giao dịch | Cách tạo danh mục theo dõi? · Các cột trong danh mục nghĩa là gì? |
| `/charts/[id]` | Biểu đồ nến và khối lượng; khung 1D/1W/1M; panel Chỉ báo (đường trung bình, vùng giá, điểm xoay, Fibonacci, phân bố khối lượng); panel Thông tin; panel Danh mục | Cách đọc biểu đồ nến? · Bật chỉ báo thế nào? · Các chỉ báo này nghĩa là gì? |

## 5. Frontend

### 5.1 File mới

| File | Trách nhiệm |
|---|---|
| `services/chatPageContext.ts` | Registry 14 trang + `buildPageContext()` + `getSuggestions()`. Thuần logic, không gọi API |
| `components/chatBubble/ChatBubble.tsx` | Nút tròn + cửa sổ chat; quản lý đóng/mở; ẩn theo route; xử lý chưa đăng nhập |
| `components/chatBubble/BubbleMessages.tsx` | Bọc `MessageList` ở chế độ cuộn theo container; khi hội thoại trống thì hiện lời chào + câu gợi ý theo trang thay cho danh sách |

Bubble **dùng lại** `MessageBubble` và `Composer` từ `app/(main)/chat/components/` bằng import trực tiếp. Không di chuyển file — giữ diff nhỏ và không đụng trang `/chat`.

### 5.2 File sửa

| File | Thay đổi |
|---|---|
| `services/chatClient.ts` | Thêm `page_context?: string` vào body gửi đi |
| `hooks/useChatStore.ts` | Thêm tham số tuỳ chọn `getPageContext?: () => string \| undefined`; gọi tại thời điểm gửi ở cả `send` và `retry`, truyền xuống `streamChat`. Thêm huỷ stream khi unmount |
| `app/(main)/chat/components/MessageList.tsx` | Thêm prop chế độ cuộn: mặc định giữ nguyên cuộn theo trình duyệt (trang `/chat`), chế độ mới cuộn theo container (bubble) |
| `app/(main)/LayoutContent.tsx` | Mount `<ChatBubble />` |

Chữ ký mới của store giữ **tương thích ngược tuyệt đối**: trang `/chat` không truyền `getPageContext` → không gửi `page_context` → hành vi y hệt hiện tại.

Lấy ngữ cảnh **tại thời điểm gửi** (không phải lúc mở bubble) để luôn khớp trang user đang đứng.

### 5.3 Giao diện

- **Nút tròn** góc trái dưới. Desktop cách mép 24px; mobile đẩy cao hơn thanh điều hướng đáy 56px để không đè lên.
- **Cửa sổ** ~380×560 trên desktop; mobile gần toàn màn hình. Dùng **glass card chuẩn của dự án**.
- **Header**: tên trợ lý + nút *Mở rộng* (sang `/chat/{id}`) + nút *Đóng*.
- **Thân**: khi trống hiện lời chào ngắn + 2-3 **câu gợi ý theo trang** (bấm là gửi luôn); khi có hội thoại thì hiện tin nhắn.
- **Chân**: ô nhập (dùng lại `Composer` ở chế độ không căn giữa) + thanh thông báo hạn mức khi cần.
- **z-index** cao hơn Drawer điều hướng để không bị che.

## 6. Backend

Thay đổi tối thiểu, **không đụng** agent loop, coherence, guard, quota, persistence.

| File | Thay đổi |
|---|---|
| `app/schemas/chat.py` | Thêm `page_context: str \| None = Field(default=None, max_length=2000)` vào request lượt chat |
| `app/routers/chat.py` | Ngay sau khi dựng danh sách system và **trước** khi chạy agent: nếu có `page_context` thì nối thêm một khối system ở **cuối** với `cache_hint=False` |

Vì sao đây là điểm sạch nhất:

- Backend đã có tiền lệ đúng dạng này: khối ghi chú phiên được dựng lại mỗi request và không cache.
- Nối vào **cuối** để không phá hiệu quả cache của các khối thường trú phía trước.
- Không chạm chữ ký `run_agent`, không chạm các guard (chúng chỉ quét câu trả lời và kết quả tool, không quét khối system).
- Lượt chat chỉ lưu nội dung câu hỏi của user → `page_context` **không bao giờ** vào lịch sử, user không thấy.

Schema hiện không khoá field lạ → thêm field mới **không gây lỗi** cho client cũ.

### 6.1 Ảnh hưởng hạn mức

Ngữ cảnh không được cache nên tính vào token đầu vào mỗi lượt. Với giới hạn 2000 ký tự (~500 token), mức tiêu hao thêm là không đáng kể so với hạn mức phiên. Giới hạn độ dài là biện pháp bảo vệ chính.

## 7. Xử lý ngoại lệ

| Tình huống | Xử lý |
|---|---|
| Chưa đăng nhập | Mở bubble hiện lời mời đăng nhập + nút; không gọi API chat |
| Hết hạn mức phiên/tuần | Dùng lại thanh thông báo hạn mức sẵn có, hiển thị trong bubble kèm link xem chi tiết |
| Server quá tải | Dùng lại thông báo sẵn có, không kèm link |
| Rời trang khi đang stream | **KHÔNG huỷ request** — để stream chạy nốt cho backend lưu được câu trả lời, user mở lại hội thoại ở `/chat` vẫn thấy đủ. Chỉ dọn timer khi unmount |
| Route ngoài 14 trang | `buildPageContext` trả `undefined`, bubble không hiện |
| Chuyển trang giữa hội thoại | Giữ hội thoại; lượt kế tiếp dùng ngữ cảnh trang mới |

## 8. Kiểm thử

**Backend (pytest):**

1. Không gửi `page_context` → danh sách system **không đổi** so với hiện tại (tương thích ngược).
2. Có `page_context` → có thêm đúng **một** khối, nằm **cuối cùng**, `cache_hint=False`.
3. `page_context` **không** xuất hiện trong tin nhắn đã lưu của hội thoại.
4. Vượt `max_length` → trả 422.

**Frontend:**

1. Unit test `buildPageContext`: 14 route hợp lệ trả đúng tên trang và chủ thể động; route ngoài danh sách trả `undefined`.
2. `npx tsc --noEmit` sạch.
3. Giao diện: **owner tự kiểm thử trên trình duyệt** (theo quy ước dự án, không dựng công cụ tự động).

## 9. Tiêu chí hoàn thành

- Bubble hiện đúng trên 14 trang, ẩn ở mọi trang còn lại.
- Hỏi ở bubble tại một trang chi tiết, AI trả lời đúng chủ thể đang xem mà không cần user nhắc tên.
- Hội thoại bắt đầu từ bubble xuất hiện trong lịch sử ở `/chat` và mở ra chat tiếp được.
- Bấm *Mở rộng* chuyển sang `/chat/{id}` đúng hội thoại.
- Trang `/chat` hoạt động **y hệt trước** (không hồi quy).
- Toàn bộ pytest xanh, `tsc` sạch.

---

## 10. Trạng thái triển khai thực tế (2026-07-20)

Đã hoàn thành. Phần dưới ghi những gì **khác hoặc thêm** so với thiết kế ban đầu ở trên, sau khi owner test trực tiếp.

### 10.1 Khác với thiết kế ban đầu

| Mục | Thiết kế ban đầu | Thực tế đã làm | Lý do |
|---|---|---|---|
| Vị trí bubble | Góc trái dưới | **Góc phải dưới** | Owner chọn |
| Huỷ stream khi rời trang | Có huỷ | **KHÔNG huỷ**, chỉ dọn timer | Backend chỉ lưu câu trả lời ở nhánh chạy trọn vẹn; huỷ là mất câu trả lời đúng lúc bấm "Mở trong Finext AI" — phá luồng bàn giao |
| Cuộn trong khung | Bọc thêm Box con | Đặt thuộc tính cuộn **thẳng lên Box gốc** | Box cha không phải flex column bị chặn cao nên `flex:1` trên Box con vô tác dụng, khung sẽ không cuộn |
| Câu gợi ý | 2-3 câu mỗi trang | **Kho ~120 câu** theo từng trang **và từng tab**, bốc ngẫu nhiên 3 | Owner: câu cũ lặp và hỏi về giao diện thay vì về thị trường |
| Câu chào | Một câu cố định | **Sáu câu**, bốc ngẫu nhiên | Owner |
| Icon nút tròn | Bong bóng hội thoại | **Ngôi sao lấp lánh** (cùng họ icon nav "Finext AI") | Owner: icon cũ trông như chat tổng đài, không ra AI |

### 10.2 Thêm ngoài thiết kế ban đầu

- **Popup mời chat**: mọc ra từ nút tròn, nội dung là câu gợi ý **theo đúng trang đang xem**. Đi cùng nhịp nhún của nút: lần đầu sau tám giây, hiện năm giây, nghỉ bốn mươi lăm giây, tối đa bốn lần mỗi phiên. Bấm đóng hoặc mở chat là tắt hẳn cả phiên. Hover cũng hiện popup này (đã bỏ tooltip mặc định).
- **Nút "Cuộc trò chuyện mới"** trong header cửa sổ; mở đoạn mới thì bốc lại câu chào và câu gợi ý.
- **Chỉ dẫn trả lời ngắn** nối vào cuối chuỗi ngữ cảnh — tự động chỉ áp cho bubble vì trang `/chat` không gửi ngữ cảnh.
- **Prop `compact` cho `Composer`**: rút gọn placeholder và dòng miễn trừ trách nhiệm, bỏ dải nền đặc để thấy lớp kính. Mặc định tắt nên `/chat` giữ nguyên.
- **Glass card đủ ba lớp** (nền + highlight + edge light) theo đúng chuẩn dự án.

### 10.3 Hai lỗi có sẵn được phát hiện và sửa nhân tiện

1. **Lỗi múi giờ trong quota** (`app/crud/chat.py`) — code đã push từ trước. MongoDB trả datetime không kèm `tzinfo` còn `_now()` trả datetime có, nên phép so sánh cửa sổ ném `TypeError`. Lượt chat đầu chưa có bản ghi quota nên thoát sớm; **từ lượt thứ hai là sập toàn bộ chat của mọi user**. Bộ test cũ không bắt được vì Mongo giả giữ nguyên `tzinfo`. Đã thêm hàm `_as_utc` và bốn test hồi quy mô phỏng đúng dữ liệu Mongo thật.
2. **Lỗi kỹ thuật lọt ra giao diện** (`services/apiClient.ts`) — mọi lỗi mạng bị bọc thành 503 kèm nguyên văn thông báo của trình duyệt, nên khách thấy "Failed to fetch". Đã thay bằng câu tiếng Việt; chi tiết gốc vẫn giữ trong `errorDetails`.

### 10.4 Đã kiểm chứng bằng cách hỏi AI thật

Bảy lượt hỏi thật qua script chạy đúng đường của endpoint chat. Kết quả: AI xác định đúng trang, mã và tab trong **cả bảy lượt** — ngữ cảnh trang hoạt động đúng thiết kế.

**Còn tồn đọng, chưa kiểm chứng thật:** các tab rổ danh mục ở `/phase`, toàn bộ `/commodities` và `/international`, các tab Tài chính và Tin tức. Kho câu hỏi cho những trang này dựa trên suy luận từ policy, chưa đối chiếu câu trả lời thật.

**Hạn chế nằm ngoài phạm vi tính năng:** AI vẫn xuất thuật ngữ nội bộ ra cho khách ("điểm dòng tiền tuần", "NN/TD", "LSLNH"). Thuộc về system prompt và bộ tri thức, không sửa được từ registry ngữ cảnh.
