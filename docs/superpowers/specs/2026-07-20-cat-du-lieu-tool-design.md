# Cắt dữ liệu tool trung thực — thiết kế

> **Ngày:** 2026-07-20 · **Trạng thái:** đã chốt với owner, sẵn sàng viết plan
> **Thay thế cho:** `docs/finext_agent/10-widget-tham-chieu-chong-bia-so.md` (xem §9 — vì sao doc 10 bị gác lại)

## 1. Nguyên nhân gốc

Trong eval 14 câu ngày 2026-07-20, lượt 6 hỏi *"Lợi nhuận HPG tăng hay giảm so với cùng kỳ?"*. Agent trả lời sai ba con số và bịa một con số không kỳ nào có (doanh thu 34.643 tỷ). Kết luận lúc đó: **model tự chọn sai kỳ và bịa số**, vì gateway đã trả về đủ 9 kỳ (28.026 ký tự, `truncated: False`).

Kết luận đó **sai**, vì được đo sớm hơn một tầng so với chỗ hỏng.

`app/agent/tools/registry.py:77-78` cắt mọi kết quả tool xuống 12.000 ký tự và **giữ phần đầu**:

```python
content = json.dumps(result.data, ensure_ascii=False, default=str)
if len(content) > MAX_TOOL_RESULT_CHARS:
    content = content[:MAX_TOOL_RESULT_CHARS] + " …[đã cắt]"
```

Chạy lại đúng truy vấn đó trên `agent_db` thật (`stock_finstats`, filter `{"ticker":"HPG"}`, projection `{"ticker":1,"financial_statements.quarterly":{"$slice":-9}}`) rồi cắt y hệt:

| | Kỳ có trong dữ liệu |
|---|---|
| Gateway trả về (28.026 ký tự) | 2024_1 … **2026_1** (9 kỳ) |
| **Model thật sự nhận** (12.010 ký tự) | 2024_1 … **2024_4** (4 kỳ) |

**Năm kỳ mới nhất bị vứt.** Chỗ cắt rơi giữa chừng một chuỗi — `"Cash Flo …[đã cắt]` — nên JSON hỏng luôn. Lượt đó agent chỉ gọi **một** tool, nên không có đường nào khác để lấy dữ liệu 2025/2026.

Nghĩa là model **không hề có** dữ liệu để trả lời. Con số 34.643 tỷ không thể sao chép từ đâu — thứ chứa số thật đã bị cắt mất. Và câu mà eval chấm là "tự mâu thuẫn" — model nói *"Q4/2024 mới là kỳ mới nhất DB có"* — hoá ra là **model đang nói thật** về thứ nó nhận được.

Lỗi này đánh vào **mọi câu hỏi dạng chuỗi thời gian**, và luôn cắt đúng phần mới nhất — tức đúng phần khách quan tâm.

### 1.1 Ba tầng cắt

| Tầng | Nơi | Cắt kiểu gì | Model được báo gì |
|---|---|---|---|
| 1 | `gateway/executor.py:27` `_cap_bytes` | **Theo ranh giới document** — đúng cách | **Không gì cả** |
| 2 | `tools/registry.py:77` | Cắt mù giữa chừng ở 12.000 ký tự | `…[đã cắt]` |
| 3 | `agent/loop.py:345` | Cắt mù, ngân sách 30k chia theo thứ tự đến trước | `…[đã cắt do vượt ngân sách]` |

Tầng 1 làm đúng: bỏ trọn document, đặt cờ `truncated`, ghi log. Nhưng `registry.py:72` dựng `meta = {"ok", "ms"}` và **vứt cờ `truncated`**. Tầng duy nhất biết mình đã cắt gì lại là tầng duy nhất không nói ra — nên cũng không đo được tần suất cắt.

Tầng 3 có thêm một cạnh sắc: ngân sách 30.000 ký tự tiêu theo thứ tự gọi, nên trong một loạt gọi song song, tool chạy **thành công** ở cuối hàng có thể nhận về đúng chuỗi `[đã cắt do vượt ngân sách]` — không một byte dữ liệu nào.

## 2. Vì sao không làm guard chống bịa số

Trước khi tìm ra nguyên nhân gốc, hướng đang cân nhắc là dựng "sổ số liệu" rồi đối chiếu mọi con số trong câu trả lời, bỏ cả câu nếu có số không tra được nguồn. Đã đo trên dữ liệu HPG thật và trên kho 195 câu trả lời thật:

- Quy tắc "dung sai theo độ chính xác" bắt được ca bịa doanh thu nhưng **vẫn lọt cả hai ca phần trăm**: sổ 298 số chứa hàng chục tỷ lệ trong dải 0,0x–0,2x, nên số phần trăm hai chữ số **trùng bừa 47,7 %**.
- Sàn báo nhầm không thể chối cãi: **20,8 % số / 72 % câu trả lời** — hằng số Fibonacci 61,8 %, thuế bán 0,1 %, và mọi số model tự cộng/trừ/tính trung bình. Ngân sách để mất ≤5 % câu là **dưới 0,4 % mỗi số**.

Lệch hai bậc độ lớn. Chế độ bỏ câu sẽ giết khoảng bảy trên mười câu trả lời đúng. **Không làm.**

Thu sổ về đúng một chỉ tiêu (biến thể "sổ theo field") đạt 7/7 và giảm trùng bừa mười lần, nhưng đòi hỏi ánh xạ cụm chữ tiếng Việt sang tên field, chỉ phủ được các chỉ tiêu báo cáo tài chính có tên rõ ràng. Gác lại cho tới khi đo xong hiệu quả của việc sửa gốc.

## 3. Mục tiêu

**Nguyên tắc xuyên suốt:** cắt bớt dữ liệu là bình thường — **cắt mà giấu** mới là lỗi. Mọi tầng cắt phải bỏ trọn phần tử và khai báo chính xác cái gì đã mất.

Ba yêu cầu:

1. Không đường nào để dữ liệu bị bỏ mà model không được báo cụ thể là bỏ cái gì.
2. Chuỗi gửi cho model luôn là JSON hợp lệ (với ba tool dữ liệu).
3. Khi phải bỏ bớt chuỗi thời gian, bỏ **kỳ cũ**, giữ **kỳ mới**.

### Phi mục tiêu

Không làm trong dự án này: widget tham chiếu · guard số chế độ bỏ câu · bảng đơn vị theo field · câu trả lời cụt lọt tới khách (eval §4.4) · lạc đề trang quốc tế (eval §4.5) · chặn tích luỹ ngân sách tool qua nhiều vòng lặp (10 vòng đều được cấp lại ngân sách đầy — là chuyện kiểm soát chi phí, hạn mức đã gánh phần nào).

Có gộp một việc nhỏ không liên quan: nhãn `[NGỮ CẢNH TRANG…]` bị chèn trùng hai lần (§7).

## 4. Thiết kế

### 4.1 `app/agent/tools/shrink.py` — một chỗ cắt duy nhất

Module mới, thuần tuý, không phụ thuộc gateway hay Mongo.

```python
MAX_DROPPED_LABELS = 12      # ghi chú chỉ liệt kê tối đa ngần này nhãn
MAX_WALK_DEPTH = 4           # độ sâu tối đa khi dò mảng lồng

@dataclass(frozen=True)
class ShrinkReport:
    shrunk: bool = False
    docs_kept: int = 0
    docs_dropped: int = 0
    array_path: str | None = None      # vd "financial_statements.quarterly"
    items_kept: int = 0
    items_dropped: int = 0
    kept_first: str | None = None      # nhãn phần tử đầu còn lại
    kept_last: str | None = None       # nhãn phần tử cuối còn lại
    dropped_labels: tuple[str, ...] = ()

def shrink_result(
    data: list[dict[str, Any]], max_chars: int
) -> tuple[list[dict[str, Any]], ShrinkReport]: ...

def shrink_note(report: ShrinkReport) -> str | None: ...
```

**Thuật toán `shrink_result`:**

1. Đóng gói thử. Vừa `max_chars` → trả nguyên `data` kèm `ShrinkReport()` mặc định (`shrunk=False`).
2. **Bỏ document từ CUỐI.** Danh sách document đã theo thứ tự `sort` của truy vấn, nên document đầu là liên quan nhất. Tìm nhị phân số document `k` lớn nhất sao cho `data[:k]` vừa trần, với `k ≥ 1`.
3. **Còn đúng một document mà vẫn quá trần** → dò tìm **mảng lồng lớn nhất** (theo kích thước đóng gói) trong document đó, sâu tối đa `MAX_WALK_DEPTH`. Tìm nhị phân số phần tử `m` lớn nhất sao cho giữ **`m` phần tử CUỐI** của mảng đó thì vừa trần. Giữ cuối = giữ kỳ mới, vì mảng trong `agent_db` xếp cũ→mới (đó là lý do policy dùng `$slice: -N` khắp nơi).
4. **Vẫn không vừa** (một phần tử đơn đã quá lớn, hoặc không tìm được mảng nào) → trả `([], report)` với `shrunk=True`. Bên gọi chịu trách nhiệm trả lỗi dạy model.

`data` rỗng đầu vào thì bước 1 luôn thoả (chuỗi `[]` dài 2 ký tự), nên `([], shrunk=True)` là tín hiệu thất bại không nhập nhằng.

**Nhãn phần tử.** Lấy giá trị của khoá đầu tiên khớp, theo thứ tự: `period`, `year_quarter`, `quarter`, `date`, `time`, `year`, `name`, `ticker`. Không khớp khoá nào (hoặc phần tử không phải dict) → dùng `#<chỉ số>`. Không dựng bảng cấu hình.

**Hiệu năng.** Tìm nhị phân thay vì bỏ dần từng phần tử: `O(log n)` lần đóng gói thay vì `O(n)`.

### 4.2 Ghi chú cho model

`shrink_note(report)` trả `None` khi `shrunk=False`. Khi có cắt, trả văn bản dạng:

```
Kết quả quá lớn nên đã lược bớt. Đã giữ 5/9 phần tử của financial_statements.quarterly,
từ 2025_1 đến 2026_1. Đã bỏ: 2024_1, 2024_2, 2024_3, 2024_4.
Cần phần đã bỏ thì truy vấn lại với projection ít field hơn.
Chỉ kết luận trên phần còn lại. Nếu khách hỏi về phần đã bỏ, hãy nói là chưa lấy được — TUYỆT ĐỐI không tự điền số.
```

Bản cho trường hợp bỏ document nêu `Đã giữ 3/12 kết quả đầu tiên, bỏ 9 kết quả còn lại`.

Hai câu cuối là phần chữa hành vi lấp chỗ trống. Chúng chỉ xuất hiện **đúng lúc thật sự có cắt**, khác hẳn luật chung chung nằm thường trú trong system prompt mà M3 hay quên.

Ghi chú đi qua **đúng đường `note` sẵn có** trong `registry.py` (`[GHI CHÚ NỘI BỘ — không đọc cho khách] …`), không phát minh cơ chế mới. Nếu `result.meta` đã có `note` (ví dụ cảnh báo projection sai field) thì nối cả hai, ghi chú cắt đứng trước.

### 4.3 Sửa `tools/registry.py`

```python
async def execute_tool(
    gateway, ctx, call, *, max_chars: int = MAX_TOOL_RESULT_CHARS
) -> tuple[str, dict[str, Any]]:
```

Tham số `max_chars` là **từ khoá, có mặc định**, nên mọi lời gọi và test hiện có chạy nguyên.

Thay khối cắt mù bằng:

1. `data, report = shrink_result(result.data, max_chars)`
2. `data` rỗng mà `report.shrunk` → trả chuỗi lỗi dạy model (cùng giọng với `_ok_result`): *"Kết quả quá lớn nên không trả được. Hãy giảm số phần tử `$slice` hoặc projection ít field hơn."*, `meta["ok"] = False`.
3. Ngược lại `content = json.dumps(data, ...)`, rồi nối `shrink_note(report)` và `result.meta.get("note")` vào phần `[GHI CHÚ NỘI BỘ …]`.

Đồng thời `meta` trả về phải mang thêm `truncated` và `bytes` từ `result.meta` (hiện bị vứt), cộng `shrunk` từ report. Nhờ đó event `tool_end` và log mới đo được tần suất cắt.

### 4.4 Sửa `agent/loop.py`

**Chia ngân sách trước, không cắt sau.** Trong `_run_tools`, trước khi `asyncio.gather`:

```python
per_call = min(MAX_TOOL_RESULT_CHARS, max(1, MAX_TOTAL_TOOL_CHARS // max(1, len(calls))))
```

rồi truyền `max_chars=per_call` vào `execute_tool`. Việc thu gọn do `shrink_result` làm có cấu trúc, ngay tại nguồn. Tổng không thể vượt ngân sách vì mỗi kết quả đã bị chặn ở phần chia đều — hết cảnh tool cuối hàng nhận về rỗng.

**Vẫn giữ một trần phòng thủ, nhưng cắt an toàn.** Hai đường không đi qua `shrink_result`: `read_kb` (trả markdown, không phải JSON) và `get_my_watchlist`. Với các đường này, nếu `content` vượt `per_call` thì cắt **tại ranh giới dòng** rồi nối ghi chú rõ ràng, thay vì cắt giữa chữ:

```
…[đã cắt bớt phần cuối tài liệu do quá dài — hãy đọc mục cần thiết bằng lời gọi hẹp hơn]
```

Bỏ hẳn khối cắt mù `content[:budget]` hiện tại.

### 4.5 Trần mới

| Hằng | Cũ | Mới |
|---|---|---|
| `MAX_TOOL_RESULT_CHARS` | 12.000 | **24.000** |
| `MAX_TOTAL_TOOL_CHARS` | 30.000 | **40.000** |

Nâng trần gần như miễn phí: thêm 12.000 ký tự ≈ 3.000 token ≈ **0,0009 USD**, so với **0,039 USD** một lượt. Kết quả HPG 28.026 ký tự vẫn vượt 24.000, nên **vẫn bị thu gọn** — đó là chủ ý: đường thu gọn phải được dùng thật, không được biến thành nhánh chết.

Con số chốt lại sau bước đo ở §6.1 nếu phân bố thật cho thấy khác.

## 5. Luồng sau khi sửa

```
MongoGateway.find/aggregate/stats
   └─ _cap_bytes: bỏ trọn document nếu vượt max_response_kb → meta.truncated
       └─ execute_tool(max_chars = 40.000 // số lời gọi, tối đa 24.000)
            └─ shrink_result: bỏ document cuối → bỏ phần tử ĐẦU của mảng lồng lớn nhất
                 └─ json.dumps  (luôn hợp lệ)
                      └─ nối [GHI CHÚ NỘI BỘ] = ghi chú cắt + note sẵn có
                           └─ message role="tool" → model đọc ở vòng sau
```

## 6. Kiểm thử và nghiệm thu

### 6.1 Đo phân bố kích thước kết quả

Trước khi chốt trần: chạy một tập truy vấn tiêu biểu trên `agent_db` thật (các collection `stock_finstats`, `history_finratios_*`, `stock_snapshot`, `other_data`, `news`), ghi lại kích thước chuỗi đóng gói. Báo cáo: bao nhiêu phần trăm vượt 12.000 và bao nhiêu phần trăm vượt 24.000. Nếu tỷ lệ vượt 24.000 vẫn cao thì bàn lại con số ở §4.5 **bằng số đo**, không đoán.

### 6.2 Unit test `shrink.py`

- Vừa trần → trả nguyên, `shrunk=False`.
- Nhiều document quá trần → bỏ từ cuối, giữ ít nhất một document, report đúng số.
- Một document chứa mảng dài → bỏ phần tử **đầu**, giữ phần tử **cuối**; `kept_last` là nhãn mới nhất.
- Kết quả sau khi thu **luôn `json.loads` được** — ghim yêu cầu "JSON hợp lệ".
- Nhãn: lấy đúng `period`/`date`; không có khoá nhãn → `#0`, `#1`.
- Một phần tử đơn quá lớn → trả `([], shrunk=True)`.
- `data` rỗng → `shrunk=False`.

### 6.3 Test hồi quy ghim nguyên nhân gốc

Dựng dữ liệu hình dạng đúng như HPG (một document, `financial_statements.quarterly` gồm 9 kỳ `2024_1…2026_1`, mỗi kỳ ~34 chỉ tiêu) sao cho vượt trần, rồi khẳng định:

- kỳ **2026_1 CÒN** trong kết quả,
- kỳ **2024_1 MẤT**,
- ghi chú nêu đúng khoảng còn lại.

Đây là hành vi **ngược hẳn** hôm nay. **Kiểm tra ngược bắt buộc:** gỡ fix ra, test này phải đỏ.

### 6.4 Kiểm chứng trên dữ liệu THẬT

Test ở §6.3 dùng dữ liệu dựng. Bài học phiên 2026-07-20: ba trên bốn lỗi lọt qua hơn 400 test vì test dùng Mongo giả và adapter giả. Nên bắt buộc thêm một bước chạy tay:

- Nạp file thật `hpg_toolresult.json` (28.026 ký tự, đang nằm trong scratchpad) qua `shrink_result` với trần 24.000, in ra các kỳ còn lại và ghi chú sinh ra. Kỳ vọng: 2026_1 còn, ghi chú nêu đúng các kỳ đã bỏ.

### 6.5 Nghiệm thu cuối

Chạy lại bộ 14 câu trong `docs/finext_agent/eval-smoke-2026-07-20.md` trên đường chạy thật, đối chiếu bảng §2:

- **Câu 6 (HPG) phải ĐẠT**: nêu đúng kỳ mới nhất 2026_1, số khớp DB (doanh thu 53.313 tỷ, lợi nhuận +168,9 % so với cùng kỳ).
- Không câu nào đang ĐẠT bị hỏng đi.
- Ghi lại kết quả vào một mục mới trong file eval, không sửa số cũ.

## 7. Việc nhỏ gộp: nhãn ngữ cảnh trang trùng hai lần

`buildPageContext()` trong `finext-nextjs/services/chatPageContext.ts` đã chèn dòng `[NGỮ CẢNH TRANG — …]`, rồi `_page_context_block()` trong `finext-fastapi/app/routers/chat.py` chèn `_PAGE_CONTEXT_HEADER` y hệt lần nữa. Phí khoảng 90 token mỗi lượt.

**Chốt: bỏ ở frontend, giữ ở backend.** Backend là nơi quyết định cách bọc khối ngữ cảnh vào system prompt, nên nó nên sở hữu cái nhãn; frontend chỉ cung cấp nội dung. Cập nhật `chatPageContext.test.ts` cho khớp.

## 8. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Giả định "mảng lồng xếp cũ→mới" sai với một collection nào đó | Ghi chú luôn nêu **nhãn** phần tử còn lại và đã bỏ, nên kể cả giữ nhầm đầu thì model vẫn biết mình đang có gì và truy vấn lại được. Ghi chú là cơ chế an toàn chính, giữ-cuối chỉ là suy đoán mặc định. |
| Nâng trần làm câu trả lời dài/chậm hơn | Trần chỉ chặn trên; kết quả nhỏ không đổi. Chi phí thêm đo được là ~0,0009 USD/lượt ở trường hợp xấu nhất. |
| Model vẫn bịa dù đã có đủ dữ liệu | Đúng là chưa biết. Đó là lý do §6.5 chạy lại đủ 14 câu chứ không chỉ câu 6. Nếu còn bịa, lúc đó mới bàn guard — với số đo mới, không phải suy đoán. |
| Đổi chữ ký `execute_tool` phá test | Tham số mới là từ khoá, có mặc định. |

## 9. Vì sao doc 10 bị gác lại

`docs/finext_agent/10-widget-tham-chieu-chong-bia-so.md` đề xuất đổi widget từ "model điền số" sang "model khai tham chiếu, backend điền số", coi đó là cách diệt tận gốc việc bịa số. Hai phép đo bác bỏ đường đó cho *lúc này*:

- **Widget hiếm khi xuất hiện.** Trong 14 lượt eval: 0 widget. Trong kho 202 câu trả lời `/chat`: **12 câu (5,9 %)**, và chỉ dùng 2 trong 12 template đã viết (`line` 8 lần, `bar` 3 lần). Câu HPG bịa số **không có widget** — nó là văn xuôi thuần. Viết lại toàn bộ 12 template để chữa 6 % bề mặt trong khi lỗi nằm ở 100 % bề mặt là sai chỗ.
- **Nguyên nhân gốc không phải thiếu cơ chế cưỡng chế** mà là model bị bịt mắt (§1).

Doc 10 không sai về nguyên tắc, chỉ sai về thứ tự. Giữ nguyên file đó; quay lại sau khi đo xong hiệu quả của việc sửa gốc.
