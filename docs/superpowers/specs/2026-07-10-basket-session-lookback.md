# Spec — Reorder tab rổ + "Vận hành danh mục" với lookback 20 phiên (2026-07-10)

> **HISTORICAL — IMPLEMENTED / EVOLVED:** Lookback 20 phiên và bố cục vận hành danh mục đã có trong `BasketTab`/`SessionStrip`; code `/phase` hiện tại là nguồn thật.

> Tab rổ PAID (Phòng Thủ/Mạo Hiểm/Sóng Ngành): đảo thứ tự phần trên + thêm thanh chọn phiên (20 ô) để xem lại snapshot 3 bảng trong quá khứ. Chốt với owner qua chat.

## 1. Thứ tự mới trong `BasketTab`

1. `ChartSectionTitle` "Lịch sử Hiệu suất danh mục" (giữ text hiện tại owner đã đặt)
2. `BasketPerformanceChart`
3. `BasketAiHero` (nhận định FINEXT AI) — **dưới** biểu đồ
4. **Tiêu đề lớn "Vận hành danh mục"** (`ChartSectionTitle`, description: chi tiết nắm giữ, chờ vào và sổ lệnh theo từng phiên) + **`SessionStrip`** (thanh 20 ô) cùng hàng (title trái, strip phải; wrap trên mobile)
5. HoldingsTable → [RankTable | OrderBook] — **theo phiên đang chọn**
6. (CORE) IndustrySection cuối — KHÔNG bị ảnh hưởng bởi phiên chọn

Hero + chart (mục 1–3) KHÔNG bị ảnh hưởng bởi thanh chọn phiên.

## 2. SessionStrip (component mới)

- 20 ô (tối đa; ít hơn nếu data ít), mỗi ô = 1 phiên, **cũ → mới** trái → phải; style giống dải "10 phiên gần nhất" của `PhaseHero`: ô ~14×20, bo 4px, **màu theo pha** của phiên đó (map từ `phase_daily.phase_label` qua `getPhaseMeta`; thiếu → xám disabled).
- Ô đang chọn: alpha đậm + ring/glow; ô khác dịu. Click ô → chọn phiên. Mặc định = phiên mới nhất (ô cuối).
- Kèm nhãn ngày phiên đang chọn (dd/mm/yyyy) + nhãn phụ "Xem lại tối đa 20 phiên"; đang xem quá khứ → hiện nút/chip "Về phiên mới nhất".
- Danh sách phiên = distinct `date` từ `phase_basket` (desc, lấy 20) — khớp data thật của bảng.

## 3. Data theo phiên đang chọn (`selectedDate`)

| Bảng | Nguồn | Cách lọc |
|---|---|---|
| Holdings | `phase_basket` | row `product + date === selectedDate` |
| Rank (chờ vào) + heldRanks | `phase_rank` | `date === selectedDate` (thay vì latest) |
| OrderBook | `phase_trading` (full, client-side) | closed + `exit_date <= selectedDate`; stats tính trên tập đó |

**Phiên quá khứ (selected ≠ latest):** không có giá/lãi tại thời điểm đó →
- HoldingsTable: ẩn cột **Hiện tại · Số phiên · Lãi/lỗ** (giữ Mã · Tỷ trọng · Giá vào · Trạng thái). Giá vào lấy từ trade mở tại phiên đó (`entry_date <= S` và (`exit_date` null hoặc `> S`)).
- Stats header Holdings: ẩn ô "Lãi/lỗ danh mục"; Số mã nắm giữ/sắp ra/chờ vào tính theo phiên đó.
- Prop gợi ý: `isLatest: boolean` truyền xuống HoldingsTable.

## 4. Backend (2 file, cần restart BE + user tự test)

- `finext-fastapi/app/crud/sse/phase_basket.py`: limit 3 → **60** (20 phiên × 3 rổ). Update docstring.
- `finext-fastapi/app/crud/sse/phase_rank.py`: trả **20 phiên gần nhất** (limit 500 hiện ≈ 4 phiên). Cách sạch: distinct dates desc lấy 20 → filter `date >= min`; nếu `_helpers.get_collection_records` không hỗ trợ filter thì query Motor trực tiếp trong file (theo idiom repo) hoặc mở rộng helper (tối thiểu). Giữ projection an toàn (KHÔNG thêm field).

## 5. Frontend files

- Sửa: `hooks/useBasketData.ts` (thêm fetch `phase_daily` — useCache dedupe với Tab ①, cho màu pha strip), `components/BasketTab.tsx` (reorder + state `selectedDate` + lọc), `components/HoldingsTable.tsx` (prop `isLatest`, ẩn cột quá khứ), `components/OrderBook.tsx` (nhận trades đã lọc — stats theo tập lọc, xem lại xem có cần đổi gì không).
- Mới: `components/SessionStrip.tsx`.

## 6. Ràng buộc & verify

- TS strict; Python type hints; không dependency mới; không đụng file ngoài phạm vi; không đọc `phase_signal`.
- Verify FE: `tsc --noEmit` = 0 lỗi. BE: import-check bằng chạy `uv run python -c "import app.crud.sse.phase_rank, app.crud.sse.phase_basket"` (nếu môi trường cho phép). KHÔNG `next build`, KHÔNG browser — owner tự test (cần restart BE dev).
- Không commit.
