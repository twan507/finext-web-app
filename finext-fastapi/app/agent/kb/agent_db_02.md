# agent_db_02 — Query Patterns

Tài liệu chứa các mẫu query MongoDB sẵn dùng cho agent. Mỗi mẫu có: mục đích, pipeline, ghi chú về tham số.

**Quy ước placeholder:** mọi giá trị agent cần thay đổi được bao bằng `<...>`. Ví dụ `<ticker>` → thay bằng "VNM".

**Scope:** mọi truy vấn chạy trên kho dữ liệu `agent_db` (đã bind cứng — 2 tool truy vấn KHÔNG nhận tham số chọn kho).

> **v2 (2026-07-12):** mọi `*_pct`/`pct_change` trong kết quả đã là **điểm %** (đọc thẳng, không nhân 100);
> `industry_rank_pct`/`market_rank_pct` thang 0–100; field thiếu dữ liệu bị omit (không còn null).
> `stock_info` đổi tên 5 field sở hữu (`free_float_pct`...). `data_briefing` chỉ còn 2 doc — xem mục 10.
> Thêm **Workflow M** (phase & danh mục). Ngưỡng số trong các pipeline mẫu dưới đây đã cập nhật theo thang mới.

**Công cụ (3 tool, KHÔNG có tham số `database`):**
- `db_find({collection, filter, projection, sort?, limit?})` — đọc document.
- `db_aggregate({collection, pipeline})` — chạy pipeline thống kê / xếp hạng.
- `read_kb({doc})` — đọc tài liệu phương pháp khác.

Mỗi ví dụ dưới đây là **tham số** gọi 1 trong 2 tool truy vấn: khối có `pipeline:` → gọi `db_aggregate`; khối có `filter:` / `projection:` / `sort:` / `limit:` → gọi `db_find`.

**Projection không cần khai báo `_id`** — hệ thống tự loại `_id` khỏi mọi kết quả. **Collection lớn** (`stock_*`, `industry_*`, `news_*`, `phase_trading`, `phase_perf`...) bắt buộc projection liệt kê field cụ thể (không đọc full document); collection nhỏ có thể bỏ projection để lấy cả doc.

---

## Mục lục

1. [Tra cứu cơ bản 1 ticker](#1-tra-cứu-cơ-bản-1-ticker)
2. [Tra cứu 1 ngành, 1 nhóm, thị trường](#2-tra-cứu-1-ngành-1-nhóm-thị-trường)
3. [Top N theo tiêu chí](#3-top-n-theo-tiêu-chí)
4. [Screening — lọc cổ phiếu đa tiêu chí](#4-screening--lọc-cổ-phiếu-đa-tiêu-chí)
5. [So sánh nhiều ticker](#5-so-sánh-nhiều-ticker)
6. [Phân tích BCTC — YoY, QoQ, tăng trưởng](#6-phân-tích-bctc--yoy-qoq-tăng-trưởng)
7. [Phân tích dòng tiền khối ngoại / tự doanh](#7-phân-tích-dòng-tiền-khối-ngoại--tự-doanh)
8. [Tin tức và báo cáo](#8-tin-tức-và-báo-cáo)
9. [Intraday](#9-intraday)
10. [Briefing — toàn cảnh thị trường](#10-briefing--toàn-cảnh-thị-trường)
11. [Vĩ mô, hàng hoá & quốc tế (`other_data`)](#11-vĩ-mô-hàng-hoá--quốc-tế-other_data)
12. [Workflow tổng hợp theo use case](#12-workflow-tổng-hợp-theo-use-case)
13. [Workflow M — Phase & danh mục hệ thống](#workflow-m--phase--danh-mục-hệ-thống)

---

## 1. Tra cứu cơ bản 1 ticker

### 1.1. Thông tin tĩnh doanh nghiệp

```
# gọi db_find
collection: stock_info
filter: { "ticker": "<ticker>" }
projection: { <field cần lấy> }
```

Khi chỉ cần thông tin phân loại không cần prose dài:

```
# gọi db_find
collection: stock_info
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "ticker_name": 1, "exchange": 1,
              "industry": 1, "marketcap": 1, "category": 1,
              "outstandingShare": 1, "free_float_pct": 1,
              "foreign_pct": 1, "foreignerRoom": 1 }
```

### 1.2. Snapshot phiên mới nhất

```
# gọi db_find
collection: stock_snapshot
filter: { "ticker": "<ticker>" }
projection: { <field cần lấy> }
```

Chỉ cần giá + điểm dòng tiền (bỏ PTKT):

```
# gọi db_find
collection: stock_snapshot
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "snapshot_date": 1,
              "price": 1, "money_flow_score": 1, "change": 1 }
```

Chỉ cần vùng kỹ thuật tổng hợp:

```
# gọi db_find
collection: stock_snapshot
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "technical_zone.overall": 1 }
```

### 1.3. Chuỗi N phiên gần nhất

Lấy N phiên (series đã sort mới→cũ):

```
# gọi db_find
collection: stock_recent
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "series": { "$slice": <N> } }
```

Ví dụ `<N>` = 5 để lấy 5 phiên gần nhất.

### 1.4. BCTC và định giá

Đầy đủ:

```
# gọi db_find
collection: stock_finstats
filter: { "ticker": "<ticker>" }
projection: { <field cần lấy> }
```

Chỉ lấy định giá hiện tại:

```
# gọi db_find
collection: stock_finstats
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "type": 1, "valuation_ratios": 1 }
```

Chỉ lấy BCTC quarterly, N kỳ gần nhất:

```
# gọi db_aggregate
collection: stock_finstats
pipeline: [
  { "$match": { "ticker": "<ticker>" } },
  { "$project": {
      "ticker": 1, "type": 1,
      "quarterly_recent": { "$slice": [ "$financial_statements.quarterly", -<N> ] }
  } }
]
```

Lưu ý: `quarterly` đã sort cũ→mới, nên `$slice: [-N]` lấy N kỳ **mới nhất**. Đây là ngoại lệ — khác với các `*_recent.series` (sort mới→cũ).

### 1.5. Khối ngoại / Tự doanh 1 mã

```
# gọi db_find
collection: stock_nntd
filter: { "ticker": "<ticker>" }
projection: { <field cần lấy> }
```

---


### 1.6. Định giá lịch sử — P/E hôm nay đắt hay rẻ so với chính nó?

Câu hỏi kiểu "HPG đang đắt hay rẻ?" chỉ trả lời được khi có **mốc so sánh lịch sử**. `stock_finstats` chỉ có P/E hôm nay; lịch sử nằm ở `history_finratios_stock` (điểm dữ liệu theo **TUẦN**).

```
# gọi db_find
// 104 điểm cuối ≈ 2 năm gần nhất (52 tuần/năm)
collection: history_finratios_stock
filter: { "ticker": "HPG" }
projection: { "ticker": 1, "type": 1, "series": { "$slice": -104 } }
```

Rồi tự tính **phân vị** của `pe` hiện tại trong chuỗi. **Cách đọc + thang phân vị + luật phân rã giá-vs-lợi-nhuận + fail-soft: `agent_db_04` mục D6** (canonical — đừng tự chế ngưỡng ở đây).

⚠ `eps` nhảy bậc thang theo kỳ BCTC (`period`) là bình thường — chỉ `marketcap`/`pe`/`pb` biến động theo giá tuần.

### 1.7. Định giá ngành và toàn thị trường qua nhiều năm

```
# gọi db_find
// P/E toàn thị trường 3 năm gần nhất
collection: history_finratios_industry
filter: { "industry_name": "Toàn bộ thị trường" }
projection: { "series": { "$slice": -156 } }

// So sánh mặt bằng P/E các ngành tại 1 thời điểm quá khứ:
// lấy 24 doc + $slice rồi tự lọc theo date ở tầng ứng dụng
collection: history_finratios_industry
filter: { "industry_name": { "$in": ["Tài chính ngân hàng", "Bất động sản Dân dụng"] } }
projection: { "industry_name": 1, "series": { "$slice": -52 } }
```

P/E ngành là **cap-weighted**, không phải trung bình P/E các mã. NH/BH thiếu `pcf`/`ev_ebitda` là có chủ đích.

## 2. Tra cứu 1 ngành, 1 nhóm, thị trường

### 2.1. Tổng quan ngành

```
# gọi db_find
collection: industry_info
filter: { "industry_name": "<tên ngành>" }
projection: { <field cần lấy> }
```

Chỉ lấy danh sách mã:

```
# gọi db_find
collection: industry_info
filter: { "industry_name": "<tên ngành>" }
projection: { "industry_name": 1, "full_ticker_list": 1 }
```

### 2.2. Snapshot ngành

```
# gọi db_find
collection: industry_snapshot
filter: { "industry_name": "<tên ngành>" }
projection: { <field cần lấy> }
```

### 2.3. Snapshot nhóm vốn hoá / dòng tiền

```
# gọi db_find
collection: group_snapshot
filter: { "group_name": "<tên nhóm>" }
```

Giá trị khả dĩ của `<tên nhóm>`: `LargeCaps`, `MidCaps`, `SmallCaps`, `Dòng tiền Vượt trội`, `Dòng tiền Ổn định`, `Dòng tiền Sự kiện`.

### 2.4. Tất cả nhóm vốn hoá hoặc dòng tiền

Dùng regex (`group_snapshot` không có field `group_type`):

```
# gọi db_find
// Nhóm vốn hoá
collection: group_snapshot
filter: { "group_name": { "$regex": "Caps$" } }

// Nhóm dòng tiền
collection: group_snapshot
filter: { "group_name": { "$regex": "^Dòng tiền " } }
```

Hoặc dùng `group_recent` (có sẵn `group_type`):

```
# gọi db_find
collection: group_recent
filter: { "group_type": "Nhóm vốn hoá" }
projection: { "group_name": 1, "group_type": 1 }
```

### 2.5. VNINDEX

```
# gọi db_find
collection: market_snapshot
```

Collection chỉ có 1 doc, không cần filter.

---

## 3. Top N theo tiêu chí

### 3.1. Top tăng/giảm trong 1 ngành — tự aggregate từ `stock_snapshot`

> Collection `stock_highlight` (pre-compute) đã bị loại bỏ khỏi schema. Top tăng/giảm trong ngành tự aggregate từ `stock_snapshot` filter theo `industry`.

Top 10 tăng mạnh nhất trong 1 ngành (volume + thanh khoản lọc tối thiểu):

```
# gọi db_aggregate
collection: stock_snapshot
pipeline: [
  { "$match": { "industry": "<tên ngành>",
                "price.volume": { "$gt": 100000 },
                "price.trading_value": { "$gt": 1 },
                "price.pct_change": { "$gt": 0 } } },
  { "$project": { "ticker": 1,
                  "close": "$price.close", "pct_change": "$price.pct_change",
                  "volume": "$price.volume", "trading_value": "$price.trading_value",
                  "day_score": "$money_flow_score.day_score",
                  "week_score": "$money_flow_score.week_score",
                  "industry_rank_pct": "$money_flow_score.industry_rank_pct" } },
  { "$sort": { "pct_change": -1 } },
  { "$limit": 10 }
]
```

Top 10 giảm mạnh nhất: đổi `pct_change: { "$gt": 0 }` thành `{ "$lt": 0 }` và `sort: { "pct_change": 1 }`.

**Filter ngành whitelist 18 áp dụng:** khi screen cho phân tích pack, `industry` phải ∈ 18 ngành whitelist (xem `agent_db_01` Section B).

Top theo nhóm vốn hoá / nhóm dòng tiền: dùng `group_snapshot` filter `group_name` hoặc query `stock_snapshot` join qua `stock_info.marketcap` / `stock_info.category`.

### 3.2. Top tăng/giảm toàn thị trường (không pre-compute — phải tự sort)

Top 10 tăng mạnh nhất, volume lọc tối thiểu:

```
# gọi db_aggregate
collection: stock_snapshot
pipeline: [
  { "$match": { "price.volume": { "$gt": 100000 },
                "price.trading_value": { "$gt": 1 },
                "price.pct_change": { "$gt": 0 } } },
  { "$project": { "ticker": 1, "snapshot_date": 1,
                  "close": "$price.close", "pct_change": "$price.pct_change",
                  "volume": "$price.volume", "trading_value": "$price.trading_value",
                  "day_score": "$money_flow_score.day_score" } },
  { "$sort": { "pct_change": -1 } },
  { "$limit": 10 }
]
```

Top 10 giảm mạnh nhất: đổi `$gt` thành `$lt` cho `pct_change` và `$sort` sang `1`.

### 3.3. Top volume spike (VSI cao)

```
# gọi db_aggregate
collection: stock_snapshot
pipeline: [
  { "$match": { "price.volume_strength_index": { "$gte": 2 },
                "price.volume": { "$gt": 500000 } } },
  { "$project": { "ticker": 1,
                  "vsi": "$price.volume_strength_index",
                  "volume": "$price.volume",
                  "pct_change": "$price.pct_change",
                  "day_score": "$money_flow_score.day_score" } },
  { "$sort": { "vsi": -1 } },
  { "$limit": 15 }
]
```

### 3.4. Top điểm dòng tiền ngày

```
# gọi db_aggregate
collection: stock_snapshot
pipeline: [
  { "$match": { "price.volume": { "$gt": 100000 } } },
  { "$project": { "ticker": 1,
                  "day_score": "$money_flow_score.day_score",
                  "week_score": "$money_flow_score.week_score",
                  "close": "$price.close",
                  "pct_change": "$price.pct_change" } },
  { "$sort": { "day_score": -1 } },
  { "$limit": 20 }
]
```

Thay `day_score` bằng `week_score` để xem top tích luỹ tuần.

### 3.5. Top mua/bán ròng của khối ngoại trong tuần

```
# gọi db_aggregate
collection: stock_nntd
pipeline: [
  { "$project": { "ticker": 1,
                  "nn_week_net": "$nn.week.net_value",
                  "nn_week_buy": "$nn.week.buy_value",
                  "nn_week_sell": "$nn.week.sell_value" } },
  { "$sort": { "nn_week_net": -1 } },
  { "$limit": 15 }
]
```

Top bán ròng: `$sort: 1`.

### 3.6. Ngành mạnh nhất / yếu nhất theo điểm dòng tiền — TỰ TỔNG HỢP RANK

> DB **không lưu** `industry_rank` ngành-vs-ngành. Agent tự sort theo `week_score` (dòng tiền tuần) qua scope phân tích (default: 18 ngành whitelist).

```
# gọi db_aggregate
collection: industry_snapshot
pipeline: [
  { "$match": { "industry_name": { "$in": [<18 tên chuẩn whitelist>] } } },   // default mode; bỏ $match khi override
  { "$project": { "industry_name": 1,
                  "day_score": "$money_flow_score.day_score",
                  "week_score": "$money_flow_score.week_score",
                  "pct_change": "$price.pct_change",
                  "breadth_in": "$breadth.breadth_in",
                  "breadth_out": "$breadth.breadth_out" } },
  { "$sort": { "week_score": -1 } }   // rank theo dòng tiền tuần — field chuẩn để rank ngành
]
```

Agent gán rank 1..N trong-flight theo thứ tự sort. Rank 1 = ngành dòng tiền tuần mạnh nhất trong scope.

Khi user yêu cầu rank theo tiêu chí khác (vd biến động giá), đổi `"$sort": { "pct_change": -1 }` hoặc field tương ứng.

---

## 4. Screening — lọc cổ phiếu đa tiêu chí

### 4.1. Momentum mạnh: dòng tiền ngày cao + zone tuần tích cực + VSI đột biến

```
# gọi db_aggregate
collection: stock_snapshot
pipeline: [
  { "$match": {
      "money_flow_score.day_score": { "$gte": 30 },
      "technical_zone.overall.w": { "$in": ["AA", "AAA"] },
      "price.volume_strength_index": { "$gte": 1.5 },
      "price.trading_value": { "$gte": 10 }
  } },
  { "$project": { "ticker": 1,
                  "close": "$price.close",
                  "pct_change": "$price.pct_change",
                  "vsi": "$price.volume_strength_index",
                  "day_score": "$money_flow_score.day_score",
                  "zone_w": "$technical_zone.overall.w" } },
  { "$sort": { "day_score": -1 } },
  { "$limit": 20 }
]
```

### 4.2. Oversold có khả năng hồi: zone tuần yếu nhưng week_score bắt đầu dương

```
# gọi db_aggregate
collection: stock_snapshot
pipeline: [
  { "$match": {
      "technical_zone.overall.w": { "$in": ["B", "C"] },
      "money_flow_score.week_score": { "$gte": 0 },
      "money_flow_score.day_score": { "$gte": 10 },
      "price.trading_value": { "$gte": 5 }
  } },
  { "$project": { "ticker": 1,
                  "close": "$price.close",
                  "day_score": "$money_flow_score.day_score",
                  "week_score": "$money_flow_score.week_score",
                  "zone_w": "$technical_zone.overall.w",
                  "zone_m": "$technical_zone.overall.m" } },
  { "$sort": { "day_score": -1 } },
  { "$limit": 20 }
]
```

### 4.3. Lọc mã trong 1 ngành + điều kiện dòng tiền

Cần 2 bước: (a) lấy `full_ticker_list` từ `industry_info`, (b) lọc trong `stock_snapshot`.

**Bước a:**

```
# gọi db_find
collection: industry_info
filter: { "industry_name": "<tên ngành>" }
projection: { "full_ticker_list": 1 }
```

**Bước b:** dùng mảng ticker trả về ở bước a:

```
# gọi db_aggregate
collection: stock_snapshot
pipeline: [
  { "$match": {
      "ticker": { "$in": ["<ticker1>", "<ticker2>", ...] },
      "money_flow_score.day_score": { "$gte": 20 }
  } },
  { "$project": { "ticker": 1,
                  "close": "$price.close",
                  "pct_change": "$price.pct_change",
                  "day_score": "$money_flow_score.day_score",
                  "industry_rank_pct": "$money_flow_score.industry_rank_pct" } },
  { "$sort": { "day_score": -1 } }
]
```

### 4.4. Khối ngoại đang tích luỹ (mua ròng tuần + tháng)

```
# gọi db_aggregate
collection: stock_nntd
pipeline: [
  { "$match": {
      "nn.week.net_value": { "$gte": 50 },
      "nn.month.net_value": { "$gte": 200 }
  } },
  { "$project": { "ticker": 1,
                  "nn_week_net": "$nn.week.net_value",
                  "nn_month_net": "$nn.month.net_value",
                  "nn_latest_net": "$nn.latest.net_value" } },
  { "$sort": { "nn_month_net": -1 } },
  { "$limit": 20 }
]
```

### 4.5. Screening định giá rẻ (cần 2 collection)

`stock_finstats` lưu valuation dưới dạng array `[{vi_name, value}]`, không sort được trực tiếp bằng field name. Phải `$unwind` hoặc dùng `$filter`:

```
# gọi db_aggregate
collection: stock_finstats
pipeline: [
  { "$match": { "type": "SXKD" } },
  { "$project": {
      "ticker": 1, "industry": 1,
      "pe": { "$let": {
        "vars": { "item": { "$arrayElemAt": [
          { "$filter": {
              "input": "$valuation_ratios",
              "as": "r",
              "cond": { "$eq": ["$$r.en_name", "Price-to-Earnings (P/E)"] }
          } }, 0 ] } },
        "in": "$$item.value"
      } },
      "pb": { "$let": {
        "vars": { "item": { "$arrayElemAt": [
          { "$filter": {
              "input": "$valuation_ratios",
              "as": "r",
              "cond": { "$eq": ["$$r.en_name", "Price-to-Book (P/B)"] }
          } }, 0 ] } },
        "in": "$$item.value"
      } }
  } },
  { "$match": { "pe": { "$gt": 0, "$lt": 10 },
                "pb": { "$gt": 0, "$lt": 1.5 } } },
  { "$sort": { "pe": 1 } },
  { "$limit": 30 }
]
```

Pattern này dài nhưng robust. Agent có thể tái dùng để trích chỉ tiêu bất kỳ từ `valuation_ratios`.

---

## 5. So sánh nhiều ticker

### 5.1. Lấy snapshot cho nhiều mã cùng lúc

```
# gọi db_find
collection: stock_snapshot
filter: { "ticker": { "$in": ["<t1>", "<t2>", "<t3>"] } }
projection: { "ticker": 1, "snapshot_date": 1,
              "price.close": 1, "price.pct_change": 1, "price.volume_strength_index": 1,
              "money_flow_score": 1,
              "change": 1,
              "technical_zone.overall": 1 }
```

### 5.2. So sánh định giá n mã cùng ngành

```
# gọi db_aggregate
collection: stock_finstats
pipeline: [
  { "$match": { "ticker": { "$in": ["VCB", "BID", "CTG", "TCB", "MBB"] } } },
  { "$project": {
      "ticker": 1, "industry": 1,
      "valuation": {
        "$arrayToObject": {
          "$map": {
            "input": "$valuation_ratios",
            "as": "r",
            "in": { "k": "$$r.en_name", "v": "$$r.value" }
          }
        }
      }
  } }
]
```

Output có field `valuation` là object với key là tên chỉ tiêu.

### 5.3. So sánh chuỗi giá 20 phiên

```
# gọi db_find
collection: stock_recent
filter: { "ticker": { "$in": ["<t1>", "<t2>", "<t3>"] } }
projection: { "ticker": 1,
              "series.date": 1,
              "series.price.close": 1,
              "series.price.pct_change": 1 }
```

### 5.4. Benchmark 1 mã vs ngành

Cần 2 query:

**Mã:**
```
# gọi db_find
collection: stock_snapshot
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "money_flow_score": 1, "change": 1,
              "technical_zone.overall": 1 }
```

**Ngành chứa mã** (lấy từ `stock_info.industry`):
```
# gọi db_find
collection: industry_snapshot
filter: { "industry_name": "<industry lấy từ stock_info>" }
projection: { "industry_name": 1, "money_flow_score": 1, "change": 1,
              "technical_zone.overall": 1, "trend": 1, "breadth": 1 }
```

Sau đó so sánh `change.m_pct`, `money_flow_score.week_score`, `technical_zone.overall` giữa 2 kết quả.

---

## 6. Phân tích BCTC — YoY, QoQ, tăng trưởng

### 6.1. Lấy chỉ tiêu cụ thể qua nhiều quý

```
# gọi db_aggregate
collection: stock_finstats
pipeline: [
  { "$match": { "ticker": "<ticker>" } },
  { "$project": {
      "ticker": 1, "type": 1,
      "revenue_series": {
        "$map": {
          "input": "$financial_statements.quarterly",
          "as": "q",
          "in": {
            "period": "$$q.period",
            "value": { "$let": {
              "vars": { "item": { "$arrayElemAt": [
                { "$filter": {
                    "input": "$$q.data",
                    "as": "d",
                    "cond": { "$eq": ["$$d.en_name", "Net Revenue"] }
                } }, 0 ] } },
              "in": "$$item.value"
            } }
          }
        }
      }
  } }
]
```

Thay `"Net Revenue"` bằng tên chỉ tiêu khác. Danh sách `en_name` phổ biến: `Net Revenue`, `Return on Equity (ROE)`, `Return on Assets (ROA)`, `Gross Margin`, `Net Margin`, `Revenue Growth YoY`, `NPAT Growth YoY`, `Total Assets`, `Total Equity`, `Cash and Cash Equivalents`.

### 6.2. Tính YoY thủ công khi DB không có sẵn

DB đã có `Revenue Growth YoY` và `NPAT Growth YoY` trong từng kỳ quarterly. Dùng trực tiếp, không cần tính lại.

Nếu cần YoY của chỉ tiêu khác (ví dụ ROE YoY), phải lấy 5 kỳ (kỳ N và kỳ N-4), rồi agent tự tính:

```
# gọi db_aggregate
collection: stock_finstats
pipeline: [
  { "$match": { "ticker": "<ticker>" } },
  { "$project": {
      "ticker": 1,
      "recent_5q": { "$slice": [ "$financial_statements.quarterly", -5 ] }
  } }
]
```

Output trả về 5 kỳ (cũ→mới). Agent đọc `recent_5q[0]` và `recent_5q[4]`, extract giá trị ROE, tự tính ratio.

### 6.3. So sánh ROE của 1 mã với trung bình ngành

**Mã** (lấy ROE kỳ gần nhất):

```
# gọi db_aggregate
collection: stock_finstats
pipeline: [
  { "$match": { "ticker": "<ticker>" } },
  { "$project": {
      "ticker": 1, "industry": 1,
      "latest_q": { "$arrayElemAt": [ "$financial_statements.quarterly", -1 ] }
  } },
  { "$project": {
      "ticker": 1, "industry": 1,
      "period": "$latest_q.period",
      "roe": { "$let": {
        "vars": { "item": { "$arrayElemAt": [
          { "$filter": {
              "input": "$latest_q.data",
              "as": "d",
              "cond": { "$eq": ["$$d.en_name", "Return on Equity (ROE)"] }
          } }, 0 ] } },
        "in": "$$item.value"
      } }
  } }
]
```

**Ngành:**

```
# gọi db_aggregate
collection: industry_finstats
pipeline: [
  { "$match": { "industry_name": "<industry lấy từ bước trước>" } },
  { "$project": {
      "industry_name": 1,
      "latest_q": { "$arrayElemAt": [ "$financial_statements.quarterly", -1 ] }
  } },
  { "$project": {
      "industry_name": 1,
      "period": "$latest_q.period",
      "roe": { "$let": {
        "vars": { "item": { "$arrayElemAt": [
          { "$filter": {
              "input": "$latest_q.data",
              "as": "d",
              "cond": { "$eq": ["$$d.en_name", "Return on Equity (ROE)"] }
          } }, 0 ] } },
        "in": "$$item.value"
      } }
  } }
]
```

### 6.4. BCTC theo năm — 6 năm gần nhất

```
# gọi db_aggregate
collection: stock_finstats
pipeline: [
  { "$match": { "ticker": "<ticker>" } },
  { "$project": {
      "ticker": 1,
      "yearly": "$financial_statements.yearly"
  } }
]
```

`yearly` có 6 kỳ, sort cũ→mới: `[2020_5, 2021_5, 2022_5, 2023_5, 2024_5, 2025_5]`.

---

## 7. Phân tích dòng tiền khối ngoại / tự doanh

### 7.1. Bức tranh NN/TD 1 mã

```
# gọi db_find
collection: stock_nntd
filter: { "ticker": "<ticker>" }
projection: { <field cần lấy> }
```

### 7.2. Top mua ròng NN tháng + còn room

Ghép 2 collection trong 2 query:

**Lấy top mua ròng tháng:**
```
# gọi db_aggregate
collection: stock_nntd
pipeline: [
  { "$match": { "nn.month.net_value": { "$gte": 100 } } },
  { "$project": { "ticker": 1, "nn_month_net": "$nn.month.net_value" } },
  { "$sort": { "nn_month_net": -1 } },
  { "$limit": 30 }
]
```

**Kiểm tra room:**
```
# gọi db_find
collection: stock_info
filter: { "ticker": { "$in": [ <list từ bước trên> ] } }
projection: { "ticker": 1, "foreign_pct": 1, "foreignerRoom": 1,
              "max_foreign_pct": 1 }
```

Sau đó agent ghép: mã có `foreignerRoom > 0` là còn room mua.

### 7.3. Bức tranh NN toàn thị trường

```
# gọi db_find
collection: market_nntd
```

So sánh `nn.latest.net_value` với `nn.week.net_value / 5` để biết xu hướng hôm nay đặc biệt hay không.

### 7.4. Chênh lệch mua bán NN tuần

```
# gọi db_aggregate
collection: stock_nntd
pipeline: [
  { "$project": {
      "ticker": 1,
      "buy_week": "$nn.week.buy_value",
      "sell_week": "$nn.week.sell_value",
      "net_week": "$nn.week.net_value",
      "total_week": { "$subtract": [ "$nn.week.buy_value", "$nn.week.sell_value" ] }
  } },
  { "$match": { "total_week": { "$gte": 500 } } },
  { "$sort": { "net_week": -1 } },
  { "$limit": 30 }
]
```

Filter `total_week >= 500` để loại mã có giao dịch NN nhỏ (noise). `net_week / total_week` gần 1 = mua ròng mạnh, gần -1 = bán ròng mạnh.

---

## 8. Tin tức và báo cáo

### 8.1. Tin mới nhất hôm nay, theo ticker

```
# gọi db_find
collection: news_today_feed
filter: { "tickers": "<ticker>" }
sort: { "created_at": -1 }
projection: { "title": 1, "sapo": 1, "article_slug": 1, "link": 1,
              "category_name": 1, "created_at": 1, "tickers": 1 }
```

`link` = URL bài gốc nguồn ngoài (v2) — kèm khi liệt kê để khách bấm đọc.

### 8.2. Tin mới nhất hôm nay, theo loại

```
# gọi db_find
collection: news_today_feed
filter: { "news_type": "doanh_nghiep" }
sort: { "created_at": -1 }
limit: 20
projection: { "title": 1, "sapo": 1, "article_slug": 1, "tickers": 1 }
```

4 giá trị `news_type` thực tế trong DB: `doanh_nghiep` (~55% tổng tin, `category_name` duy nhất "Doanh nghiệp niêm yết"), `quoc_te` (~25%, `category_name` duy nhất "Tài chính quốc tế"), `trong_nuoc` (~25%, bucket rộng với 11 `category_name` con — xem ghi chú dưới), `thong_cao` (~1%, `category_name` duy nhất "Thông cáo chính phủ", là tổng hợp chỉ đạo điều hành Chính phủ/Thủ tướng hàng ngày, hầu hết không có ticker).

Ghi chú về `trong_nuoc`: đây KHÔNG đồng nghĩa "tin vĩ mô". Bucket này gồm Kinh tế, Chính trị, Chỉ đạo-quyết định Chính phủ-Thủ tướng, Thời sự, Khoa học-Công nghệ, Tham vấn chính sách, Pháp luật, Đối ngoại, Chính sách mới, Thị trường, Ngân hàng. Khi cần tin vĩ mô/chính sách thực sự ảnh hưởng TTCK, lọc thêm `category_name` trong `["Kinh tế", "Thị trường", "Chính sách mới", "Ngân hàng", "Chỉ đạo, quyết định của Chính phủ - Thủ tướng Chính phủ", "Pháp luật", "Tham vấn chính sách"]`. Các category "Chính trị", "Đối ngoại", "Thời sự", "Khoa học - Công nghệ" mặc định skip trừ khi user hỏi đích danh.

### 8.3. Đọc nội dung 1 tin (sau khi đã screen feed)

```
# gọi db_find
collection: news_today_content
filter: { "article_slug": "<slug-từ-bước-trước>" }
projection: { <field cần lấy> }
```

### 8.4. Tin lịch sử về ticker trong 30 ngày

```
# gọi db_find
collection: news_history_feed
filter: { "tickers": "<ticker>", "type": "news_feed" }
sort: { "created_at": -1 }
limit: 30
projection: { "title": 1, "sapo": 1, "article_slug": 1, "link": 1,
              "category_name": 1, "created_at": 1 }
```

Lưu ý: phải filter `type: "news_feed"` để không lẫn báo cáo.

### 8.5. Báo cáo tổng hợp lịch sử

```
# gọi db_find
collection: news_history_feed
filter: { "type": "report_feed" }
sort: { "created_at": -1 }
limit: 20
projection: { "title": 1, "sapo": 1, "report_slug": 1,
              "category_name": 1, "report_type": 1, "tickers": 1, "created_at": 1 }
```

Đọc markdown:

```
# gọi db_find
collection: news_history_content
filter: { "report_slug": "<slug>", "type": "report_content" }
projection: { "report_markdown": 1 }
```

### 8.6. Tin lịch sử theo ngành

Cần 2 bước: lấy `full_ticker_list` từ `industry_info` → filter trong `news_history_feed`:

```
# gọi db_find
collection: news_history_feed
filter: {
  "tickers": { "$in": [<list ticker ngành>] },
  "type": "news_feed"
}
sort: { "created_at": -1 }
limit: 50
projection: { "title": 1, "sapo": 1, "tickers": 1, "created_at": 1 }
```

---

## 9. Intraday

### 9.1. Intraday 1 mã, N snapshot gần nhất

```
# gọi db_find
collection: stock_itd
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "series": { "$slice": <N> } }
```

`<N>` thường 10-20 là đủ.

### 9.2. Intraday VNINDEX

```
# gọi db_find
collection: market_itd
projection: { "index": 1, "series": { "$slice": 20 } }
```

### 9.3. Tìm thời điểm volume spike trong phiên

`stock_itd` không hỗ trợ `db_aggregate` (chuỗi intraday rất dài) — không dùng `$unwind`. Lấy 30 snapshot gần nhất bằng `db_find` rồi **agent tự lọc các phút có VSI cao** (`series[i].vsi >= 2`) trong kết quả:

```
# gọi db_find
collection: stock_itd
filter: { "ticker": "<ticker>" }
projection: { "ticker": 1, "series": { "$slice": 30 } }
```

---

## 10. Briefing — toàn cảnh thị trường

> **v2:** `data_briefing` chỉ còn 2 doc (`core` + `news_report`) — 4 block clone cũ đã xoá. Cần bảng 24 ngành /
> 70 chỉ số vĩ mô / 6 nhóm → query collection gốc (`industry_snapshot`, `other_data`, `group_snapshot`).

### 10.1. Doc core — NẠP ĐẦU MỌI PHIÊN CHAT

```
# gọi db_find
collection: data_briefing
filter: { "type": "core" }
```

Trả về ~1.5k token: thị trường (giá + breadth + trend + zone) + **phase headline** (`phase.label`,
`phase.exposure`, `phase.as_of`) + money flow NN/TD + 6 nhóm + top moves. `as_of` = mốc dữ liệu.

### 10.2. Báo cáo tổng hợp mới nhất

```
# gọi db_find
collection: data_briefing
filter: { "type": "news_report" }
projection: { "data.title": 1, "data.sapo": 1, "data.report_type": 1,
              "data.created_at": 1, "data.tickers": 1 }
```

Cần nội dung đầy đủ → thêm `"data.report_markdown": 1` (dài — chỉ khi user thật sự hỏi nội dung báo cáo).

---

## 11. Vĩ mô, hàng hoá & quốc tế (`other_data`)

### 11.1. Lấy 1 chỉ số cụ thể theo tên

```
# gọi db_find
collection: other_data
filter: { "name": "<tên chỉ số>" }
```

Ví dụ `<tên chỉ số>`: `"Dầu Brent"`, `"Vàng thế giới"`, `"Bitcoin (BTC)"`, `"USD NHTM bán"`, `"LS tái cấp vốn"`, `"CPI (Tỷ lệ lạm phát)"`, `"S&P 500"`.

### 11.2. Lấy nhiều chỉ số theo danh sách

```
# gọi db_find
collection: other_data
filter: { "name": { "$in": ["Dầu Brent", "Dầu WTI", "Khí tự nhiên"] } }
```

### 11.3. Lấy tất cả chỉ số trong 1 category

```
# gọi db_find
collection: other_data
filter: { "group": "commodities", "category": "energy" }
```

Các cặp `group + category` hợp lệ:
- `commodities` + `metals` / `energy` / `agriculture` / `chemical`
- `international` + `global_index` / `fx` / `crypto` / `bonds`
- `macro` + `exchange_rate` / `monetary` / `economy`

### 11.4. Lấy toàn bộ 1 group

```
# gọi db_find
collection: other_data
filter: { "group": "macro" }
```

### 11.5. Lọc chỉ số biến động mạnh trong tuần (top gainer/loser hàng hoá)

```
# gọi db_aggregate
collection: other_data
pipeline: [
  { "$match": { "group": "commodities" } },
  { "$project": { "name": 1, "category": 1, "value": 1, "unit": 1,
                  "w_pct": 1, "m_pct": 1, "update_date": 1 } },
  { "$sort": { "w_pct": -1 } }
]
```

Đổi `w_pct` sang `m_pct` / `q_pct` / `y_pct` cho khung khác.

### 11.6. Các chỉ số vĩ mô mới nhất (lãi suất + tỷ giá)

```
# gọi db_find
collection: other_data
filter: { "group": "macro", "category": { "$in": ["monetary", "exchange_rate"] } }
projection: { "name": 1, "value": 1, "unit": 1,
              "pct_change": 1, "m_pct": 1, "update_date": 1 }
```

### 11.7. Thị trường quốc tế — S&P 500, Nikkei, BTC cùng lúc

```
# gọi db_find
collection: other_data
filter: { "name": { "$in": ["S&P 500", "Nikkei 225", "Bitcoin (BTC)", "Shanghai Composite"] } }
projection: { "name": 1, "value": 1, "unit": 1,
              "pct_change": 1, "w_pct": 1, "m_pct": 1, "update_date": 1 }
```

### 11.8. Chỉ số có `update_date` cũ hơn N ngày (lọc độ tươi)

```
# gọi db_find
collection: other_data
filter: {
  "update_date": { "$lt": "<ngày cut-off>" }
}
projection: { "name": 1, "update_date": 1, "group": 1, "category": 1 }
```

Dùng để cảnh báo user nếu số liệu vĩ mô đang cũ.

### 11.9. Gọn — "4 chỉ số vĩ mô đại diện" cho briefing nhanh

Khi user hỏi nhanh "bối cảnh vĩ mô thế nào", lấy 4-6 chỉ số đại diện:

```
# gọi db_find
collection: other_data
filter: { "name": { "$in": [
  "USD NHTM bán",
  "Vàng thế giới",
  "Dầu Brent",
  "S&P 500",
  "LS tái cấp vốn",
  "CPI (Tỷ lệ lạm phát)"
] } }
projection: { "name": 1, "value": 1, "unit": 1,
              "pct_change": 1, "w_pct": 1, "m_pct": 1, "update_date": 1 }
```

---

## 12. Workflow tổng hợp theo use case

Phần này mô tả chuỗi query cần thiết cho các phân tích hay gặp. Số thứ tự trong từng workflow là trình tự query agent nên chạy.

### Workflow A — Phân tích toàn diện 1 ticker

**Mục tiêu:** trả lời câu "phân tích mã X".

1. `stock_info` lấy thông tin doanh nghiệp, ngành (xem 1.1).
2. `stock_snapshot` lấy trạng thái hôm nay (xem 1.2).
3. `stock_recent` lấy chuỗi 5-10 phiên (xem 1.3 với `<N>` = 5).
4. `stock_nntd` lấy dòng tiền NN/TD (xem 1.5).
5. `stock_finstats` lấy 4 kỳ quarterly gần nhất + valuation (xem 1.4 version "N kỳ").
6. `industry_snapshot` của ngành chứa ticker, để benchmark (xem 2.2).
7. `news_today_feed` theo ticker (xem 8.1) — agent duyệt title, nếu có tin quan trọng thì đọc content bằng 8.3.
8. Nếu cần chiều sâu lịch sử: `news_history_feed` (xem 8.4).
9. Nếu mã thuộc ngành nhạy vĩ mô → thêm `other_data` (xem Workflow I).

**Tổng 5-9 query.** Mỗi query projection chặt để không kéo thừa data.

### Workflow B — So sánh n mã cùng ngành

**Mục tiêu:** trả lời "so sánh MWG, FRT, DGW".

1. `stock_snapshot` với `$in` (xem 5.1).
2. `stock_finstats` với `$in` + project valuation (xem 5.2).
3. `stock_nntd` với `$in`:
   ```
   # gọi db_find
   collection: stock_nntd
   filter: { "ticker": { "$in": [...] } }
   projection: { "ticker": 1, "nn.week.net_value": 1, "nn.month.net_value": 1 }
   ```
4. `industry_snapshot` của ngành chung (xem 2.2) để có baseline.

**Tổng 4 query.**

### Workflow C — Tóm tắt thị trường hôm nay

**Mục tiêu:** trả lời "thị trường hôm nay thế nào", "ngành nào mạnh nhất".

1. `data_briefing` doc core (xem 10.1) — bức tranh + **phase headline** (nếu chưa nạp đầu phiên).
2. Trạng thái pha của hệ: đọc `core.phase` (sâu hơn → `market_phase`, Workflow M) — nêu làm bối cảnh. Đánh giá
   trend/breadth độc lập theo Workflow K; nếu kết luận lệch với nhãn pha của hệ, trình bày cả hai góc nhìn.
3. "Ngành nào mạnh/yếu nhất" → `industry_snapshot` tự tổng hợp rank (xem 3.6).
4. Cần vĩ mô → `other_data` (mục 11); cần tin nổi bật → doc news_report (10.2).
5. Câu trả lời cần đánh giá xu hướng → thêm `market_recent` 20 phiên (Workflow K).

**Tổng 1-4 query.**

### Workflow D — Screening cổ phiếu tiềm năng

**Mục tiêu:** "tìm mã có tín hiệu mua".

1. `stock_snapshot` với điều kiện momentum (xem 4.1).
2. Với n mã lọt sàng: `stock_nntd` với `$in` để xem có được NN mua ròng không.
3. `stock_finstats` với `$in` để check valuation không quá đắt.
4. `news_today_feed` theo từng ticker candidate để xem có tin bất thường không (có thể bỏ qua nếu danh sách >15 mã).

**Tổng 3-4 query + 1 vài query điều kiện cho top candidate.**

### Workflow E — Phân tích ngành

**Mục tiêu:** "phân tích ngành ngân hàng".

1. `industry_info` lấy tổng quan, chuỗi giá trị, danh sách mã (xem 2.1).
2. `industry_snapshot` (xem 2.2).
3. `industry_recent` để xem chuỗi 20 phiên:
   ```
   # gọi db_find
   collection: industry_recent
   filter: { "industry_name": "<tên>" }
   projection: { "industry_name": 1,
                 "series": { "$slice": 10 } }
   ```
4. `industry_finstats` lấy valuation và BCTC kỳ gần nhất (xem 6.3 version ngành).
5. Top tăng/giảm trong ngành: aggregate từ `stock_snapshot` filter `industry` (xem 3.1).
6. Top 3-5 mã đầu ngành: query song song `stock_snapshot` với `$in` (xem 5.1).
7. Tin ngành: `news_history_feed` với `tickers $in full_ticker_list` (xem 8.6).
8. Nếu ngành nhạy vĩ mô: thêm chỉ số `other_data` liên quan (xem Workflow I).

**Tổng 5-8 query.**

### Workflow F — Phân tích dòng tiền thị trường

**Mục tiêu:** "khối ngoại đang làm gì".

1. `market_nntd` cho bức tranh chung (xem 7.3).
2. `stock_nntd` top mua ròng tuần/tháng (xem 3.5, 7.2).
3. `stock_info` kèm theo cho các mã candidate để lấy `foreignerRoom` (xem 7.2).
4. Ngành nào được NN mua nhiều nhất: cần tự aggregate từ kết quả bước 2 + mapping ticker→industry từ `stock_info`.

**Tổng 3-4 query + 1 bước tính toán ở agent side.**

### Workflow G — Xu hướng 1 mã theo thời gian

**Mục tiêu:** "VNM đi như thế nào 1 tháng qua".

1. `stock_recent` lấy 20 phiên (xem 1.3).
2. `stock_itd` lấy intraday hôm nay:
   ```
   # gọi db_find
   collection: stock_itd
   filter: { "ticker": "VNM" }
   projection: { "ticker": 1, "series": { "$slice": 30 } }
   ```
3. `news_history_feed` theo ticker trong 30 ngày (xem 8.4).

**Tổng 3 query.**

### Workflow H — Screening theo định giá rẻ trong nhóm vốn hoá lớn

**Mục tiêu:** "tìm LargeCap có P/E < 10, ROE > 15%".

1. `stock_info` lấy danh sách LargeCap:
   ```
   # gọi db_find
   collection: stock_info
   filter: { "marketcap": "LargeCaps" }
   projection: { "ticker": 1, "industry": 1 }
   ```
2. `stock_finstats` với `ticker $in` danh sách trên, extract P/E + ROE (dùng pattern ở 4.5).
3. Với 5-10 mã lọt sàng: `stock_snapshot` để check trạng thái kỹ thuật hiện tại.

**Tổng 3 query.**

### Workflow I — Phân tích mã/ngành nhạy vĩ mô

**Mục tiêu:** phân tích mã/ngành có độ nhạy cao với giá hàng hoá, lãi suất, hoặc tỷ giá. Ví dụ: "PVS phân tích giúp", "nên nghĩ gì về thép hôm nay", "ngân hàng với lãi suất hiện tại ra sao".

**Mapping ngành ⟷ chỉ số vĩ mô cần pull:**

| Ngành / nhóm mã | Chỉ số cần kéo từ `other_data` |
|---|---|
| Dầu khí (PVS, PVD, BSR, PLX, GAS) | `name`: Dầu Brent, Dầu WTI |
| Thép (HPG, HSG, NKG, POM) | `name`: Quặng sắt, Thép HRC, Than cốc |
| Phân bón (DCM, DPM, BFC, LAS) | `name`: Urea Trung Đông, Urea Trung Quốc, Phốt pho vàng |
| Ngân hàng (VCB, BID, CTG, TCB, MBB, ACB...) | `category`: monetary + exchange_rate |
| Bất động sản (VHM, VIC, NVL, DXG, PDR) | `category`: monetary (lãi suất huy động, cho vay) |
| Xuất khẩu (dệt may, thuỷ sản, đồ gỗ) | `name`: USD NHTM bán, EUR/USD |
| Vàng / trang sức (PNJ) | `name`: Vàng thế giới, Vàng trong nước bán ra |
| Nông nghiệp (DBC, HAG, HNG, PAN) | `category`: agriculture |
| Cao su (GVR, PHR, DPR, TRC) | `name`: Cao su, Dầu Brent (cao su tổng hợp) |
| Hoá chất / nhựa (DGC, AAA, NTP) | `category`: chemical |

**Workflow chạy:**

1. Chạy **Workflow A** cho ticker (hoặc **Workflow E** cho ngành) để có bức tranh cơ bản.
2. Kéo chỉ số `other_data` liên quan theo bảng mapping. Ví dụ PVS → query 11.2 với `name $in ["Dầu Brent", "Dầu WTI"]`.
3. Phân tích: so sánh biến động 1 tháng của mã vs biến động 1 tháng của chỉ số nhạy; kiểm tra `m_pct` của chỉ số vĩ mô.
4. Kết luận: mã có đang đi cùng chiều/ngược chiều với chỉ số nhạy không? Nếu ngược chiều, giải thích lý do (ví dụ: dầu tăng nhưng PVS giảm có thể do yếu tố riêng công ty).

**Tổng 6-10 query** (kế thừa từ Workflow A/E + 1-2 query `other_data`).

### Workflow J — Trả lời câu hỏi thuần vĩ mô

**Mục tiêu:** "giá vàng hôm nay sao", "lãi suất liên ngân hàng thế nào", "USD/VND đi đâu", "S&P 500 ảnh hưởng gì tới thị trường Việt".

1. Query `other_data` theo mục 11 (thường chỉ cần 1 query với `name` cụ thể).
2. Nếu câu hỏi có liên hệ với chứng khoán VN: thêm `market_snapshot` + `industry_snapshot` ngành liên quan (xem mapping ở Workflow I) để tạo nhận định.

**Tổng 1-3 query.**

### Workflow K — Phân tích vận động trend thị trường/ngành/nhóm (BẮT BUỘC khi trả lời về trend)

**Mục tiêu:** bất cứ khi nào câu hỏi liên quan tới xu hướng/trend của thị trường, ngành, hoặc nhóm — VD "thị trường đang thế nào", "ngành X mạnh yếu ra sao", "VNINDEX rally có bền không", "nhóm LargeCaps đi đâu".

**Lưu ý phase (v2):** nhãn pha của hệ (`data_briefing.core.phase` hoặc `market_phase`) là tín hiệu tham chiếu
hữu ích khi phân tích trend — trích làm bối cảnh nếu liên quan. Đánh giá trend độc lập theo B1.5 vẫn là kết
luận của agent; nếu lệch với nhãn pha của hệ, nêu cả hai góc nhìn (system prompt mục 5).

**Nguyên tắc:** theo `agent_db_04` mục B1.5, snapshot một mình không đủ — phải xem vận động 20 phiên để phân loại 1 trong 5 pattern (đang rơi từ vùng quá mua / đang bật từ đáy / dao động biên độ lớn / ổn định / tăng đều hoặc giảm đều).

**Query bắt buộc:**

Thị trường (VNINDEX):
```
# gọi db_find
collection: market_snapshot
filter: {}
projection: { "snapshot_date": 1, "price": 1, "breadth": 1,
              "change": 1, "trend": 1 }

collection: market_recent
filter: {}
projection: { "index": 1, "series.date": 1, "series.trend": 1 }
```
*(1 doc duy nhất; `series` mới→cũ, mỗi item có `trend` 4 khung — cấu trúc thống nhất với industry/group_recent.)*

Ngành (nếu user hỏi về ngành cụ thể):
```
# gọi db_find
collection: industry_snapshot
filter: { "industry_name": "<tên ngành>" }
projection: { "industry_name": 1, "snapshot_date": 1,
              "money_flow_score": 1, "change": 1, "trend": 1 }

collection: industry_recent
filter: { "industry_name": "<tên ngành>" }
projection: { "industry_name": 1,
              "series": { "$slice": 20 } }
```

Nhóm (nếu user hỏi về nhóm vốn hoá/dòng tiền):
```
# gọi db_find
collection: group_snapshot
filter: { "group_name": "<tên nhóm>" }
projection: { "group_name": 1, "money_flow_score": 1,
              "change": 1, "trend": 1 }

collection: group_recent
filter: { "group_name": "<tên nhóm>" }
projection: { "group_name": 1, "group_type": 1,
              "series": { "$slice": 20 } }
```

**Lưu ý cấu trúc `market_recent`:** trend nằm NGAY TRONG `series[].trend` (cùng item với price) — cấu trúc thống nhất cả 3 cấp. Xem `agent_db_01` khối D.

**Phân tích:** với 20 phiên trend, đọc theo 5 pattern của B1.5 `agent_db_04` cho từng khung (w/m/q/y). Mô tả vận động trước khi đưa kết luận về vị trí hiện tại.

**Tổng 2 query** (mỗi cấp cần snapshot + recent).

**Khi nào Workflow K bắt buộc:**
- Câu hỏi có chữ "trend", "xu hướng", "đang rally không", "đỉnh hay đáy", "còn tăng được không"
- Câu hỏi tổng quan thị trường/ngành/nhóm ("thị trường thế nào", "ngành X sao")
- Khi chuẩn bị đưa khuyến nghị hành động dựa trên trend
- Khi chạy Workflow D (screening) hoặc B6/B7 trong `agent_db_04` — Step 1 cần Workflow K cho thị trường/ngành

**Workflow C (tóm tắt thị trường hôm nay) dùng `data_briefing` doc core** vẫn giữ nguyên, nhưng nếu câu trả lời cần đánh giá trend/xu hướng thì phải query thêm `market_recent` theo Workflow K. Doc core chỉ có ảnh hiện tại (+ phase headline), không có 20 phiên.

---

### Workflow L — Phân tích tin tức theo loại (BẮT BUỘC khi câu hỏi liên quan tin)

**Mục tiêu:** khi user hỏi về tin tức mới hôm nay, tin lịch sử về một sự kiện, tác động của một chính sách, hoặc diễn biến tin của một cổ phiếu — agent query đúng collection tin theo loại và thời gian, sau đó diễn giải theo methodology ở `agent_db_05`.

**Bốn loại tin trong hệ thống:**

- `doanh_nghiep` — tin doanh nghiệp niêm yết cụ thể (BCTC, giao dịch cổ đông, M&A, ESOP, thay đổi lãnh đạo, công bố thông tin bất thường). `category_name` duy nhất "Doanh nghiệp niêm yết". Chiếm ~55% tổng tin.
- `quoc_te` — tin tài chính quốc tế (Fed, ECB, địa chính trị, giá hàng hoá, chỉ số toàn cầu, FX, khủng hoảng tài chính). `category_name` duy nhất "Tài chính quốc tế". Chiếm ~25%.
- `trong_nuoc` — BUCKET RỘNG gồm mọi tin nội địa, KHÔNG đồng nghĩa "tin vĩ mô". Có 11 `category_name` con: Kinh tế, Chính trị, Chỉ đạo-quyết định Chính phủ-Thủ tướng, Thời sự, Khoa học-Công nghệ, Tham vấn chính sách, Pháp luật, Đối ngoại, Chính sách mới, Thị trường, Ngân hàng. Chiếm ~25%. Agent BẮT BUỘC lọc thêm qua `category_name` để tách tin vĩ mô/chính sách thực sự ảnh hưởng TTCK khỏi tin chính trị/đối ngoại/thời sự không liên quan.
- `thong_cao` — tổng hợp chỉ đạo, điều hành của Chính phủ/Thủ tướng hàng ngày. `category_name` duy nhất "Thông cáo chính phủ". Chiếm ~1% volume nhưng chứa định hướng chính sách cấp cao nhiều ngành cùng lúc trong 1 tin, hầu hết không có ticker. Agent phải parse full `plain_content` để tách từng chỉ đạo và map vào ngành tương ứng.

Chi tiết methodology diễn giải từng loại xem `agent_db_05`.

**Lưu ý schema quan trọng (tham chiếu `agent_db_01` phần E):**
- Khoá nối giữa feed và content là `article_slug` (tin thường) hoặc `report_slug` (báo cáo tổng hợp) — KHÔNG PHẢI `news_id`.
- Trường thời gian là `created_at` — KHÔNG PHẢI `published_at`.
- Nội dung đầy đủ nằm ở field `plain_content` — KHÔNG PHẢI `content`.
- KHÔNG có field `source`, `sub_category`, `industries` riêng — thông tin nguồn nằm trong `category_name` hoặc trong `plain_content`; phân loại nhỏ hơn news_type là công việc logic của agent (đọc title/sapo/content để tự classify), không phải field DB; lọc theo ngành phải dùng pipeline 2 bước qua `industry_info.full_ticker_list`.
- Khi query `news_history_feed`, BẮT BUỘC thêm filter `type: "news_feed"` để không lẫn với các `report_feed`.

**Query templates theo mục đích:**

Tin mới hôm nay theo loại cơ bản (ví dụ lấy tin trong nước hôm nay):
```
# gọi db_find
collection: news_today_feed
filter: { "news_type": "trong_nuoc" }
projection: { "title": 1, "sapo": 1, "article_slug": 1, "link": 1,
              "category_name": 1, "created_at": 1, "tickers": 1 }
sort: { "created_at": -1 }
limit: 20
```

Tin trong nước lọc chỉ category liên quan TTCK (vĩ mô/chính sách/thị trường — loại bỏ tin chính trị thuần, đối ngoại, thời sự):
```
# gọi db_find
collection: news_today_feed
filter: {
  "news_type": "trong_nuoc",
  "category_name": { "$in": [
    "Kinh tế", "Thị trường", "Chính sách mới", "Ngân hàng",
    "Chỉ đạo, quyết định của Chính phủ - Thủ tướng Chính phủ",
    "Pháp luật", "Tham vấn chính sách"
  ]}
}
projection: { "title": 1, "sapo": 1, "article_slug": 1, "link": 1,
              "category_name": 1, "created_at": 1, "tickers": 1 }
sort: { "created_at": -1 }
limit: 20
```

Tin thông cáo Chính phủ (volume nhỏ nhưng chứa định hướng cấp cao — luôn đọc khi phân tích chính sách):
```
# gọi db_find
collection: news_today_feed
filter: { "news_type": "thong_cao" }
projection: { "title": 1, "sapo": 1, "article_slug": 1,
              "created_at": 1 }
sort: { "created_at": -1 }
```

Tin mới hôm nay cho một ticker cụ thể:
```
# gọi db_find
collection: news_today_feed
filter: { "tickers": "<ticker>" }
projection: { "title": 1, "sapo": 1, "article_slug": 1,
              "news_type": 1, "category_name": 1, "created_at": 1 }
sort: { "created_at": -1 }
```

Nội dung đầy đủ một tin sau khi đã chọn từ feed:
```
# gọi db_find
collection: news_today_content
filter: { "article_slug": "<slug từ feed>" }
projection: { "plain_content": 1, "article_slug": 1 }
```

Tin lịch sử về một ticker (30 ngày gần nhất — mặc định):
```
# gọi db_find
collection: news_history_feed
filter: { 
  "tickers": "<ticker>",
  "type": "news_feed",
  "created_at": { "$gte": "<30 ngày trước>" }
}
projection: { "title": 1, "sapo": 1, "article_slug": 1,
              "news_type": 1, "category_name": 1, "created_at": 1 }
sort: { "created_at": -1 }
```

Tin lịch sử theo loại + theo ngành (pipeline 2 bước vì không có field `industries`):
```
# gọi db_find
# Bước 1: lấy danh sách ticker trong ngành
collection: industry_info
filter: { "industry_name": "<tên ngành>" }
projection: { "full_ticker_list": 1 }

# Bước 2: filter news_history_feed theo list ticker + loại tin
# Ví dụ: tin doanh nghiệp — dùng news_type "doanh_nghiep"
# Tin vĩ mô/chính sách liên quan ngành — dùng trong_nuoc + category_name filter
collection: news_history_feed
filter: { 
  "news_type": "doanh_nghiep",
  "type": "news_feed",
  "tickers": { "$in": [<full_ticker_list>] },
  "created_at": { "$gte": "<ngày bắt đầu>" }
}
projection: { "title": 1, "sapo": 1, "article_slug": 1,
              "category_name": 1, "created_at": 1, "tickers": 1 }
sort: { "created_at": -1 }
limit: 30
```

Tin lịch sử về một sự kiện cụ thể (search theo keyword trong title hoặc sapo):
```
# gọi db_find
collection: news_history_feed
filter: {
  "type": "news_feed",
  "$or": [
    { "title": { "$regex": "<keyword>", "$options": "i" } },
    { "sapo":  { "$regex": "<keyword>", "$options": "i" } }
  ],
  "created_at": { "$gte": "<ngày bắt đầu>" }
}
projection: { "title": 1, "sapo": 1, "article_slug": 1,
              "news_type": 1, "category_name": 1, "created_at": 1, "tickers": 1 }
sort: { "created_at": -1 }
```

**Pipeline 2 bước chuẩn:** hầu hết use case, agent query `feed` trước để lấy danh sách tin (title, sapo, article_slug, loại, ticker, ngày), user hoặc agent chọn tin quan tâm, sau đó query `content` theo `article_slug` để lấy full text. Không query toàn bộ `content` ngay từ đầu vì volume lớn.

**Phân loại chi tiết hơn news_type — công việc logic của agent:** Mỗi loại tin có thể được phân thành các chủ đề nhỏ hơn (ví dụ `trong_nuoc` subset vĩ mô/chính sách có thể gồm chính sách tiền tệ, chính sách tài khóa, luật mới, số liệu vĩ mô; `quoc_te` gồm Fed, ECB, hàng hoá, địa chính trị; `doanh_nghiep` gồm BCTC, giao dịch cổ đông, M&A, thay đổi lãnh đạo). Các phân loại nhỏ này KHÔNG phải field DB độc lập — agent phân loại bằng cách đọc `title`, `sapo`, `plain_content`, hoặc dùng `category_name` (string chuẩn từ nguồn tin, đặc biệt quan trọng với `trong_nuoc` để tách tin relevant TTCK khỏi tin chính trị/văn hoá thuần). Chi tiết phân loại logic xem phần 3, 4, 5 `agent_db_05`.

**Sau khi có tin — bắt buộc áp methodology `agent_db_05`:**

1. Phân loại logic (`doanh_nghiep`/`quoc_te`/`trong_nuoc`/`thong_cao` và chủ đề nhỏ hơn) — xem phần 3, 4, 5 `agent_db_05`
2. Đánh giá nguồn tin — ưu tiên nguồn chính thống (đọc trong `plain_content` hoặc `category_name`), loại nhiễu
3. Chạy framework chấm điểm nội bộ (phần 2 `agent_db_05`) — công cụ tư duy, không lộ nhãn
4. Xác định kênh truyền dẫn và nhóm ngành tác động
5. Kiểm tra price-in bằng cách query giá 30-45 ngày trước (dùng Workflow G hoặc K)
6. Kết hợp với dòng tiền và trend để xác nhận hay bác bỏ hướng tác động
7. Output theo ngôn ngữ tự nhiên — mô tả tác động cụ thể, cơ chế, hành động, không dùng nhãn HIGH/MID/LOW

**Khi nào Workflow L bắt buộc:**
- Câu hỏi có chữ "tin", "news", "tin tức", "hôm nay có gì", "tin mới"
- Câu hỏi về chính sách, nghị định, thông tư, quyết định cơ quan nhà nước
- Câu hỏi về tác động của một sự kiện (Fed tăng/giảm lãi suất, chiến tranh, khủng hoảng)
- Câu hỏi về sự kiện doanh nghiệp cụ thể (BCTC, M&A, ESOP, khởi tố lãnh đạo)
- Khi Workflow A (phân tích toàn diện ticker) cần bối cảnh tin gần đây

**Kết hợp với workflow khác:** Workflow L thường không đứng độc lập — nó bổ sung bối cảnh tin cho các workflow phân tích chính. Ví dụ Workflow A cần query thêm tin về ticker (Workflow L phần tin ticker) để có bối cảnh; Workflow E phân tích ngành cần query thêm tin liên quan ngành đó (Workflow L phần tin theo ngành); Workflow J về vĩ mô cần query `trong_nuoc` (lọc category Kinh tế/Thị trường/Chính sách mới/Ngân hàng/Chỉ đạo Chính phủ/Pháp luật) + `thong_cao` gần nhất. Các query cơ bản khác về tin (tin theo ngày, đọc báo cáo tổng hợp, tin theo ngành) cũng có thể tham khảo section 8 cùng file này vốn đã có pattern đúng với schema.

---

---

## Workflow M — Phase & danh mục hệ thống

**Mục tiêu:** mọi câu về pha thị trường, tỷ lệ nắm giữ, 3 danh mục (Phòng Thủ / Sóng Ngành / Mạo Hiểm),
sổ lệnh, hiệu suất. Ngữ nghĩa + luật trình bày + ngưỡng: `agent_db_06`. Schema: `agent_db_01` Section I.

### M.1. Pha hiện tại + diễn giải (câu "thị trường đang pha nào / nên cầm bao nhiêu %")

```
# gọi db_find
collection: market_phase
projection: { "history_60": 0 }
```

1 doc: `phase`/`exposure`/`held_days` + 7 chỉ số (kèm comment) + 4 đoạn `comments`. Trả lời nhanh chỉ cần
headline có sẵn ở `data_briefing.core.phase` — query này khi khách hỏi SÂU (chỉ số nào, vì sao, sắp đổi chưa).

### M.2. Lịch sử pha (câu "2022 hệ làm gì", "lần downtrend gần nhất")

```
# gọi db_find
collection: market_phase_history
filter: { "date": { "$gte": "2022-01-01", "$lte": "2022-12-31" } }
projection: { "date": 1, "phase_label": 1, "market_exposure": 1 }
sort: { "date": 1 }
```

Kể chuyện chuyển pha: nhóm các đoạn `phase_label` liên tục + mốc exposure về 0/bật lại. LUÔN filter date range.

### M.3. Danh mục hiện tại (câu "đang cầm gì", "sao mã X bị loại", "mã Y sắp vào chưa")

```
# gọi db_find
collection: phase_basket
filter: { "product": "CORE" }        // CONSERVATIVE | CORE | AGGRESSIVE — tên nói = display_name_vi
```

Doc tự đủ: `held`/`book`/`adds`/`removes` + `rank` (status từng mã/ngành) + `stock_cmt`/`sector_cmt` +
`next_rebalance_in`. Trình bày: nhóm "chờ vào"/"sắp ra" nêu TRƯỚC nhóm nắm giữ ổn định; downtrend (`held={}`)
→ "100% tiền mặt", `book`/`rank` là danh mục THAM KHẢO.

### M.4. Sổ lệnh 1 mã / thống kê lệnh (dán nhãn BACKTEST)

```
# gọi db_find
collection: phase_trading
filter: { "ticker": "VCB" }                            // + "product" nếu hỏi riêng 1 danh mục
projection: { <field cần lấy> }
sort: { "entry_date": -1 }
```

Lệnh đang mở: `filter: { "status": "open" }`. Thống kê ("tỷ lệ thắng"): tự đếm `return_pct > 0` / tổng,
nêu định nghĩa dùng (lãi TB = TB lệnh thắng · lỗ TB = TB lệnh thua · kỳ vọng/lệnh = TB tất cả).

### M.5. Sóng ngành (câu "hệ đang đánh ngành nào")

```
# gọi db_find
collection: phase_industry
projection: { "history_60": 0 }
```

`states` ≥ 2 = đang giữ; 1 = vào kỳ cơ cấu tới; map mã ngắn → tên ngành đầy đủ khi nói. KHÁC với rank
dòng tiền ngành (3.6) — một cái là danh mục hệ, một cái là dòng tiền; đừng trộn.

### M.6. Hiệu suất cửa sổ ngắn (câu "tuần này/tháng này danh mục chạy sao")

```
# gọi db_find
collection: phase_perf
filter: { "product": { "$in": ["CORE", "FNX"] }, "date": { "$gte": "<ngày đầu cửa sổ>" } }
projection: { <field cần lấy> }
sort: { "date": 1 }
```

Compound từng product: `hiệu suất = Π(1 + ret_1d_1x) − 1` (×100 khi nói) — so CORE với FNX cùng cửa sổ.
BẮT BUỘC nhãn *"gross chưa phí/thuế — số chính thức NET xem bảng công bố"*. Số dài hạn/tổng kết: KHÔNG tính
từ đây — trích bảng FROZEN `agent_db_06` mục 4.

### Khi nào Workflow M bắt buộc

- Câu có: "pha", "uptrend/downtrend", "nên cầm bao nhiêu", "danh mục", "rổ", "hệ thống mua/bán gì",
  "sao mã X bị loại/được thêm", "hiệu suất", "tỷ lệ thắng", "sóng ngành".
- Khi khuyến nghị TRÚNG trigger nêu-bối-cảnh (system prompt mục 5.2: exposure = 0 mà gợi ý mở vị thế, hoặc gợi ý
  margin) — headline phase/exposure có sẵn trong doc core, không cần query thêm. Ngoài trigger: đọc để tự định vị,
  KHÔNG nhắc phase trong output.

---

## Checklist trước khi trả lời user

Trước khi trả về câu trả lời cuối, agent nên tự hỏi:

1. Đã dùng số liệu mới nhất chưa? Kiểm tra `snapshot_date`, `latest.date`, hoặc `update_date` trong data.
2. Có trình bày đơn vị rõ ràng không? `*_pct` ĐÃ là điểm % — không nhân 100 (ngoại lệ cần nhân: `*_trend`, `exposure`, tỷ trọng, ratio finstats cũ); tiền tỷ đồng; `other_data.value` đọc kèm `unit`.
3. Có lỡ dùng ký hiệu nội bộ không? 3 nhóm cần dịch theo K hygiene (system prompt mục 8.5/9): (a) ký hiệu DB raw (VSI, zone AAA, day_score, f382, POC, w_trend...), (b) taxonomy nội bộ (Kịch bản A-G/E1-E3, Pitfall F1-F12, B5/B6/B7, D1-D4, HIGH/MID/LOW impact, logic gate, framework chấm điểm), (c) thuật ngữ tiếng Anh chưa dịch (mean-reversion, exhaustion, Value Area, DuPont, sell on news, priced-in, confluence, divergence, smart money, hawkish/dovish). Xem bảng dịch đầy đủ ở system prompt mục 9, `agent_db_04` các phần A-F, `agent_db_05` phần 9, và `agent_db_06` (phase).
4. Có đưa ít nhất một luận điểm dòng tiền không? DB này mạnh về dòng tiền — không tận dụng là bỏ phí.
5. Nếu câu hỏi nhạy vĩ mô (mã/ngành thuộc bảng mapping Workflow I), có dùng `other_data` chưa?
6. **Nếu câu hỏi liên quan trend (thị trường/ngành/nhóm), đã chạy Workflow K chưa?** Query cả snapshot và recent 20 phiên, đọc theo 5 pattern (B1.5 `agent_db_04`)?
7. **Nếu câu hỏi liên quan tin tức hoặc sự kiện, đã chạy Workflow L chưa?** Query đúng loại tin (`doanh_nghiep`/`quoc_te`/`trong_nuoc`/`thong_cao`), áp methodology `agent_db_05` để diễn giải, không lộ nhãn HIGH/MID/LOW trong output? Nếu dùng `trong_nuoc`, có lọc thêm `category_name` để tách tin relevant TTCK không?
8. Có cân bằng giữa lập luận ủng hộ và phản đối chưa? Tránh một chiều khi người dùng hỏi "nên mua không".
9. Có nhắc người dùng về giới hạn tư vấn không? Nhất là với câu hỏi quyết định mua/bán trực tiếp.
10. **Có số hiệu suất danh mục: đúng luật 2 tầng chưa** (dài hạn = bảng FROZEN `agent_db_06`; cửa sổ ngắn = compound `phase_perf` kèm nhãn gross)?
