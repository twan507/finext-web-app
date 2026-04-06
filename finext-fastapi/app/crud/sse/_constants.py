# finext-fastapi/app/crud/sse/_constants.py
"""
Module chứa các constants và helper functions liên quan đến ticker classification.
"""

# Danh sách các index tickers (dùng để phân biệt query từ collection nào)
INDEX_TICKERS = {
    "HNX30",
    "HNXINDEX",
    "UPINDEX",
    "VN30",
    "VNINDEX",
    "VNXALL",
    "VN100F1M",
    "VN100F1Q",
    "VN100F2M",
    "VN100F2Q",
    "VN30F1M",
    "VN30F1Q",
    "VN30F2M",
    "VN30F2Q",
    "FNXINDEX",
    "FNX100",
    "VUOTTROI",
    "ONDINH",
    "SUKIEN",
    "LARGECAP",
    "MIDCAP",
    "SMALLCAP",
}

INDUSTRY_TICKERS = {
    "BANLE",
    "BAOHIEM",
    "BDS",
    "CAOSU",
    "CHUNGKHOAN",
    "CONGNGHE",
    "CONGNGHIEP",
    "DAUKHI",
    "DETMAY",
    "DULICH",
    "HOACHAT",
    "KCN",
    "KHOANGSAN",
    "KIMLOAI",
    "NGANHANG",
    "NHUA",
    "NONGNGHIEP",
    "THUCPHAM",
    "THUYSAN",
    "TIENICH",
    "VANTAI",
    "VLXD",
    "XAYDUNG",
    "YTE",
}

# Projection chung cho chart data (history + today)
CHART_DATA_PROJECTION = {
    "_id": 0,
    # Thông tin cơ bản
    "ticker": 1,
    "ticker_name": 1,
    "date": 1,
    # OHLCV
    "open": 1,
    "high": 1,
    "low": 1,
    "close": 1,
    "volume": 1,
    # Biến động giá
    "diff": 1,
    "pct_change": 1,
    # Dữ liệu bổ sung cho Detail Panel
    "vsi": 1,
    "trading_value": 1,
    "cap_value": 1,
    # ─── Chỉ báo vẽ LINE trên biểu đồ volume ───
    "vsma5": 1,
    "vsma60": 1,
    # ─── Chỉ báo vẽ LINE trên biểu đồ giá ───
    # Moving Averages
    "ma5": 1,
    "ma20": 1,
    "ma60": 1,
    "ma120": 1,
    "ma240": 1,
    # Open / PH / PL / Pivot / R1 / S1 — Tuần
    "w_open": 1,
    "w_ph": 1,
    "w_pl": 1,
    "w_pivot": 1,
    "w_r1": 1,
    "w_s1": 1,
    # Open / PH / PL / Pivot / R1 / S1 — Tháng
    "m_open": 1,
    "m_ph": 1,
    "m_pl": 1,
    "m_pivot": 1,
    "m_r1": 1,
    "m_s1": 1,
    # Open / PH / PL / Pivot / R1 / S1 — Quý
    "q_open": 1,
    "q_ph": 1,
    "q_pl": 1,
    "q_pivot": 1,
    "q_r1": 1,
    "q_s1": 1,
    # Open / PH / PL / Pivot / R1 / S1 — Năm
    "y_open": 1,
    "y_ph": 1,
    "y_pl": 1,
    "y_pivot": 1,
    "y_r1": 1,
    "y_s1": 1,
    # ─── Chỉ báo vẽ AREA (upper/middle/lower) trên biểu đồ giá ───
    # Fibonacci — Tuần / Tháng / Quý / Năm
    "w_f382": 1,
    "w_f500": 1,
    "w_f618": 1,
    "m_f382": 1,
    "m_f500": 1,
    "m_f618": 1,
    "q_f382": 1,
    "q_f500": 1,
    "q_f618": 1,
    "y_f382": 1,
    "y_f500": 1,
    "y_f618": 1,
    # Volume Profile (VAH / POC / VAL) — Tuần / Tháng / Quý / Năm
    "w_vah": 1,
    "w_poc": 1,
    "w_val": 1,
    "m_vah": 1,
    "m_poc": 1,
    "m_val": 1,
    "q_vah": 1,
    "q_poc": 1,
    "q_val": 1,
    "y_vah": 1,
    "y_poc": 1,
    "y_val": 1,
}


def _is_index_ticker(ticker: str) -> bool:
    """Kiểm tra ticker có phải là index hay stock."""
    if not ticker:
        return True  # Mặc định lấy từ index nếu không truyền ticker
    return ticker.upper() in INDEX_TICKERS or ticker.upper() in INDUSTRY_TICKERS


def _is_industry_ticker(ticker: str) -> bool:
    """Kiểm tra ticker có phải là industry hay không."""
    if not ticker:
        return False
    return ticker.upper() in INDUSTRY_TICKERS
