// finext-nextjs/app/(main)/news/components/NewsList.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Pagination,
    Stack,
    Typography,
    Alert,
    Skeleton,
} from '@mui/material';
import { Newspaper } from '@mui/icons-material';

import { apiClient } from 'services/apiClient';
import { NewsApiResponse, NewsArticle, NEWS_PAGE_SIZE, NEWS_SORT_FIELD, NEWS_SORT_ORDER, NewsSource } from '../types';
import NewsCard from './NewsCard';
import { spacing, borderRadius, getResponsiveFontSize } from 'theme/tokens';

interface NewsListProps {
    /** Lọc theo source */
    source?: NewsSource;
    /** Lọc theo category */
    category?: string;
    /** Tiêu đề section */
    title?: string;
    /** Mô tả section */
    description?: string;
    /** Số bài viết mỗi trang */
    pageSize?: number;
    /** Callback khi có danh sách categories */
    onCategoriesLoaded?: (categories: { category: string; category_name: string }[]) => void;
}

/** Loading skeleton cho NewsCard dạng list */
function NewsCardSkeleton() {
    return (
        <Box
            sx={{
                display: 'flex',
                gap: spacing.xs,
                py: spacing.xs,
                borderBottom: '1px solid',
                borderColor: 'divider',
            }}
        >
            <Box sx={{ width: 100 }}>
                <Skeleton variant="text" width={80} height={20} />
                <Skeleton variant="text" width={50} height={16} />
            </Box>
            <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="90%" height={24} />
                <Skeleton variant="text" width="100%" height={18} />
                <Skeleton variant="text" width="70%" height={18} />
            </Box>
        </Box>
    );
}

/** Empty state khi không có tin */
function EmptyState() {
    return (
        <Box
            sx={{
                py: spacing.xxl,
                textAlign: 'center',
            }}
        >
            <Newspaper
                sx={{
                    fontSize: 64,
                    color: 'text.disabled',
                    mb: spacing.xs,
                }}
            />
            <Typography
                variant="h6"
                color="text.secondary"
                sx={{ mb: spacing.xs }}
            >
                Chưa có tin tức
            </Typography>
            <Typography variant="body2" color="text.disabled">
                Tin tức sẽ được cập nhật liên tục. Vui lòng quay lại sau.
            </Typography>
        </Box>
    );
}

export default function NewsList({
    source,
    category,
    title,
    description,
    pageSize = NEWS_PAGE_SIZE,
    onCategoriesLoaded,
}: NewsListProps) {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchNews = useCallback(async (pageNum: number) => {
        setLoading(true);
        setError(null);

        try {
            // Build query params
            const queryParams: Record<string, string> = {
                page: String(pageNum),
                limit: String(pageSize),
                sort_by: NEWS_SORT_FIELD,
                sort_order: NEWS_SORT_ORDER,
            };

            // Thêm filter source nếu có
            if (source) {
                queryParams.source = source;
            }

            // Thêm filter category nếu có
            if (category && category !== 'all') {
                queryParams.category = category;
            }

            const response = await apiClient<NewsApiResponse>({
                url: '/api/v1/sse/rest/news_daily',
                method: 'GET',
                queryParams,
                requireAuth: false,
            });

            if (response.data) {
                const items = response.data.items || [];
                setArticles(items);
                setTotalPages(response.data.pagination?.total_pages || 1);
                setTotal(response.data.pagination?.total || 0);

                // Extract unique categories từ articles và gọi callback
                if (onCategoriesLoaded && pageNum === 1) {
                    const categoryMap = new Map<string, string>();
                    items.forEach((article) => {
                        if (article.category && article.category_name) {
                            categoryMap.set(article.category, article.category_name);
                        }
                    });
                    const categories = Array.from(categoryMap.entries()).map(([cat, name]) => ({
                        category: cat,
                        category_name: name,
                    }));
                    onCategoriesLoaded(categories);
                }
            }
        } catch (err: any) {
            console.error('[NewsList] Fetch error:', err);
            setError(err.message || 'Không thể tải tin tức. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    }, [pageSize, source, category, onCategoriesLoaded]);

    // Reset page về 1 khi category thay đổi
    useEffect(() => {
        setPage(1);
    }, [category]);

    useEffect(() => {
        fetchNews(page);
    }, [fetchNews, page]);

    const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
        setPage(value);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <Box>
            {/* Header */}
            {(title || description) && (
                <Box sx={{ mb: spacing.xs }}>
                    {title && (
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                fontSize: getResponsiveFontSize('h4'),
                                mb: spacing.xs,
                            }}
                        >
                            {title}
                        </Typography>
                    )}
                    {description && (
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            sx={{ fontSize: getResponsiveFontSize('md') }}
                        >
                            {description}
                        </Typography>
                    )}
                    {!loading && total > 0 && (
                        <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ mt: spacing.xs, display: 'block' }}
                        >
                            Tổng cộng {total} bài viết
                        </Typography>
                    )}
                </Box>
            )}

            {/* Error State */}
            {error && (
                <Alert
                    severity="error"
                    sx={{
                        mb: spacing.lg,
                        borderRadius: `${borderRadius.md}px`,
                    }}
                >
                    {error}
                </Alert>
            )}

            {/* Loading State */}
            {loading && (
                <Box>
                    {Array.from({ length: pageSize }).map((_, index) => (
                        <NewsCardSkeleton key={index} />
                    ))}
                </Box>
            )}

            {/* Empty State */}
            {!loading && !error && articles.length === 0 && <EmptyState />}

            {/* News List */}
            {!loading && articles.length > 0 && (
                <>
                    <Box>
                        {articles.map((article) => (
                            <NewsCard
                                key={article.article_id}
                                article={article}
                            />
                        ))}
                    </Box>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Stack
                            direction="row"
                            justifyContent="center"
                            sx={{ mt: spacing.xs }}
                        >
                            <Pagination
                                count={totalPages}
                                page={page}
                                onChange={handlePageChange}
                                color="primary"
                                size="large"
                                showFirstButton
                                showLastButton
                                sx={{
                                    '& .MuiPaginationItem-root': {
                                        borderRadius: `${borderRadius.md}px`,
                                    },
                                }}
                            />
                        </Stack>
                    )}
                </>
            )}
        </Box>
    );
}
