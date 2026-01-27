---
name: Lightweight Charts
description: TradingView Lightweight Charts v5 documentation - Financial charting library for web applications
---

# Lightweight Charts™ Skill

Tài liệu tham khảo cho thư viện [Lightweight Charts™](https://tradingview.github.io/lightweight-charts/) - thư viện biểu đồ tài chính của TradingView.

## Khi nào sử dụng skill này?

Sử dụng skill này khi cần:
- Tạo biểu đồ tài chính (candlestick, line, area, bar, histogram, baseline)
- Tùy chỉnh price scale, time scale
- Tạo custom series hoặc plugins
- Xử lý real-time data updates
- Tạo các indicators hoặc overlays

## Quick Reference

### Installation
```bash
npm install --save lightweight-charts
```

### Basic Usage (v5 Syntax)
```typescript
import { createChart, LineSeries, CandlestickSeries, AreaSeries } from 'lightweight-charts';

const chart = createChart(document.getElementById('container'), {
    layout: { 
        textColor: 'black', 
        background: { type: 'solid', color: 'white' } 
    }
});

// Add series using v5 syntax: addSeries(SeriesType, options)
const lineSeries = chart.addSeries(LineSeries, { color: '#2962FF' });
const candlestickSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
});

// Set data
lineSeries.setData([
    { time: '2018-12-22', value: 32.51 },
    { time: '2018-12-23', value: 31.11 },
]);

// Fit content to view
chart.timeScale().fitContent();
```

### Series Types
| Type | Import | Data Format |
|------|--------|-------------|
| Line | `LineSeries` | `{ time, value }` |
| Area | `AreaSeries` | `{ time, value }` |
| Candlestick | `CandlestickSeries` | `{ time, open, high, low, close }` |
| Bar | `BarSeries` | `{ time, open, high, low, close }` |
| Histogram | `HistogramSeries` | `{ time, value, color? }` |
| Baseline | `BaselineSeries` | `{ time, value }` |

### Real-time Updates
```typescript
// Update existing bar or add new
series.update({ time: '2019-01-01', value: 25 });
```

### v4 → v5 Migration
```typescript
// OLD (v4)
chart.addLineSeries({ color: 'red' });
chart.addCandlestickSeries(options);

// NEW (v5)
import { LineSeries, CandlestickSeries } from 'lightweight-charts';
chart.addSeries(LineSeries, { color: 'red' });
chart.addSeries(CandlestickSeries, options);
```

### Series Markers (v5)
```typescript
import { createSeriesMarkers } from 'lightweight-charts';

const markers = createSeriesMarkers(series, [
    {
        time: '2019-04-09',
        position: 'aboveBar',
        color: 'black',
        shape: 'arrowDown',
    },
]);
```

### Watermark (v5)
```typescript
import { createTextWatermark } from 'lightweight-charts';

const firstPane = chart.panes()[0];
createTextWatermark(firstPane, {
    horzAlign: 'center',
    vertAlign: 'center',
    lines: [{ text: 'Watermark', color: 'rgba(255,0,0,0.5)', fontSize: 50 }],
});
```

## Tài liệu chi tiết

Xem file [documentation.md](./documentation.md) để có đầy đủ thông tin về:
- Chart types (Standard, Yield Curve, Options Chart)
- Price Scale & Time Scale configuration
- Panes management
- Time zones handling
- Custom Series & Plugins development
- Canvas rendering best practices
- Pixel perfect rendering techniques

## License Attribution

> Charts powered by [TradingView Lightweight Charts™](https://www.tradingview.com)
