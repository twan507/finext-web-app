# finext-fastapi/app/crud/sse/__init__.py
"""
SSE Query Package - Mỗi keyword tương ứng 1 file Python riêng biệt.
Module này re-export execute_sse_query và get_available_keywords
để giữ backward compatibility với router.
"""

import logging
from typing import Any, Dict, List, Optional

# Import tất cả keyword functions từ các sub-modules
from app.crud.sse.home_itd_index import home_itd_index
from app.crud.sse.home_itd_stock import home_itd_stock
from app.crud.sse.home_today_index import home_today_index
from app.crud.sse.home_hist_index import home_hist_index
from app.crud.sse.home_hist_stock import home_hist_stock
from app.crud.sse.home_today_stock import home_today_stock
from app.crud.sse.home_nn_stock import home_nn_stock
from app.crud.sse.nntd_stock import nntd_stock
from app.crud.sse.nntd_index import nntd_index
from app.crud.sse.home_today_industry import home_today_industry
from app.crud.sse.home_hist_industry import home_hist_industry
from app.crud.sse.home_history_trend import home_history_trend
from app.crud.sse.home_today_trend import home_today_trend
from app.crud.sse.chart_ticker import chart_ticker
from app.crud.sse.chart_history_data import chart_history_data
from app.crud.sse.chart_today_data import chart_today_data
from app.crud.sse.phase_signal import phase_signal
from app.crud.sse.finratios_stock import finratios_stock
from app.crud.sse.finratios_industry import finratios_industry
from app.crud.sse.finstats_map import finstats_map
from app.crud.sse.finstats_industry import finstats_industry
from app.crud.sse.finstats_stock import finstats_stock
from app.crud.sse.info_stock import info_stock
from app.crud.sse.news_daily import news_daily
from app.crud.sse.news_categories import news_categories
from app.crud.sse.news_count import news_count
from app.crud.sse.news_article import news_article
from app.crud.sse.news_report import news_report
from app.crud.sse.news_report_categories import news_report_categories
from app.crud.sse.report_article import report_article
from app.crud.sse.screener_stock_data import screener_stock_data
from app.crud.sse.screener_stock_meta import screener_stock_meta
# Search keywords
from app.crud.sse.search_stocks import search_stocks
from app.crud.sse.search_index import search_index
from app.crud.sse.search_news import search_news
from app.crud.sse.search_reports import search_reports
# Market meta keywords
from app.crud.sse.market_update_time import market_update_time
# Other Ticker (Commodities, World, Crypto)
from app.crud.sse.latest_other_ticker import latest_other_ticker
from app.crud.sse.other_ticker import other_ticker

logger = logging.getLogger(__name__)

# ==============================================================================
# REGISTRY - Đăng ký các keyword và hàm query tương ứng
# ==============================================================================

SSE_QUERY_REGISTRY: Dict[str, Any] = {
    # Index queries
    "home_today_index": home_today_index,
    "home_itd_index": home_itd_index,
    "home_itd_stock": home_itd_stock,
    "home_hist_index": home_hist_index,
    # Stock queries
    "home_hist_stock": home_hist_stock,
    "home_today_stock": home_today_stock,
    "home_nn_stock": home_nn_stock,
    "nntd_stock": nntd_stock,
    "nntd_index": nntd_index,
    # Industry queries
    "home_today_industry": home_today_industry,
    "home_hist_industry": home_hist_industry,
    # Phase signal
    "phase_signal": phase_signal,
    # Trend queries
    "home_history_trend": home_history_trend,
    "home_today_trend": home_today_trend,
    # Chart queries
    "chart_history_data": chart_history_data,
    "chart_today_data": chart_today_data,
    "chart_ticker": chart_ticker,
    # News queries
    "news_daily": news_daily,
    "news_categories": news_categories,
    "news_count": news_count,
    "news_article": news_article,
    # News report queries
    "news_report": news_report,
    "news_report_categories": news_report_categories,
    "report_article": report_article,
    # Finratios queries
    "finratios_stock": finratios_stock,
    "finratios_industry": finratios_industry,
    "finstats_map": finstats_map,
    "finstats_industry": finstats_industry,
    "finstats_stock": finstats_stock,
    # Stock info
    "info_stock": info_stock,
    # Screener queries
    "screener_stock_data": screener_stock_data,
    "screener_stock_meta": screener_stock_meta,
    # Search queries
    "search_stocks": search_stocks,
    "search_index": search_index,
    "search_news": search_news,
    "search_reports": search_reports,
    # Market meta
    "market_update_time": market_update_time,
    # Other Ticker
    "latest_other_ticker": latest_other_ticker,
    "other_ticker": other_ticker,
}


def get_available_keywords() -> List[str]:
    """Lấy danh sách tất cả các keyword có sẵn."""
    return list(SSE_QUERY_REGISTRY.keys())


async def execute_sse_query(
    keyword: str,
    ticker: Optional[str] = None,
    nntd_type: Optional[str] = None,
    news_type: Optional[str] = None,
    report_type: Optional[str] = None,
    categories: Optional[str] = None,
    article_slug: Optional[str] = None,
    report_slug: Optional[str] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None,
    skip: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    projection: Optional[Dict[str, Any]] = None,
    search: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Thực thi query dựa trên keyword.
    Mỗi hàm query sẽ tự chọn database phù hợp.

    Args:
        keyword: Từ khóa xác định loại query
        ticker: Mã ticker (VD: VNINDEX, VN30, ...)
        news_type: Loại tin tức (VD: thong_cao, trong_nuoc, doanh_nghiep, quoc_te)
        report_type: Loại bản tin (VD: daily, weekly, monthly)
        categories: Danh mục để filter, có thể 1 hoặc nhiều cách nhau bởi dấu phẩy
        article_slug: Slug của bài viết tin tức
        report_slug: Slug của báo cáo
        page: Số trang (bắt đầu từ 1)
        limit: Số lượng bản ghi mỗi trang
        sort_by: Tên field để sắp xếp
        sort_order: Thứ tự sắp xếp (asc/desc)

    Returns:
        Dict chứa data và pagination info (nếu có)

    Raises:
        ValueError: Nếu keyword không hợp lệ
    """
    if keyword not in SSE_QUERY_REGISTRY:
        available = ", ".join(get_available_keywords())
        raise ValueError(f"Keyword '{keyword}' không hợp lệ. Các keyword có sẵn: {available}")

    query_func = SSE_QUERY_REGISTRY[keyword]
    logger.debug(
        f"Executing SSE query for keyword: {keyword}, ticker: {ticker}, news_type: {news_type}, report_type: {report_type}, categories: {categories}, page: {page}, limit: {limit}"
    )

    # Tạo dict params để truyền vào hàm query
    query_params = {
        "ticker": ticker,
        "nntd_type": nntd_type,
        "news_type": news_type,
        "report_type": report_type,
        "categories": categories,
        "article_slug": article_slug,
        "report_slug": report_slug,
        "page": page,
        "limit": limit,
        "skip": skip,
        "sort_by": sort_by,
        "sort_order": sort_order,
        "projection": projection,
        "search": search,
    }

    # Gọi hàm query với các params
    return await query_func(**query_params)
