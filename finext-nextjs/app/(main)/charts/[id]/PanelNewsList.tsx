// finext-nextjs/app/(main)/charts/[id]/PanelNewsList.tsx
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Skeleton, useTheme } from '@mui/material';
import { Newspaper } from '@mui/icons-material';
import Link from 'next/link';

import { apiClient } from 'services/apiClient';
import { NewsApiResponse, NewsArticle, NEWS_SORT_FIELD, NEWS_SORT_ORDER } from 'app/(main)/news/types';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

// ─── Props ───────────────────────────────────────────────────────────────────
interface PanelNewsListProps {
    /** Filter by ticker (for stocks) */
    ticker?: string;
    /** Max items to fetch (default 10) */
    limit?: number;
}

// ─── DateTime parser ─────────────────────────────────────────────────────────
function formatRelativeDate(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Vừa xong';
        if (diffMin < 60) return `${diffMin} phút trước`;
        if (diffHour < 24) return `${diffHour} giờ trước`;
        if (diffDay < 7) return `${diffDay} ngày trước`;

        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function formatDateTime(dateStr: string): { date: string; time: string } {
    try {
        const d = new Date(dateStr);
        return {
            date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
    } catch {
        return { date: dateStr, time: '' };
    }
}

// ─── Compact News Card for Panel ─────────────────────────────────────────────
function PanelNewsCard({ article }: { article: NewsArticle }) {
    const theme = useTheme();
    const { date, time } = formatDateTime(article.created_at);

    return (
        <Box
            sx={{
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
                '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                },
                transition: 'background-color 0.15s ease',
            }}
        >
            {/* Date + Time row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: fontWeight.medium,
                        color: 'primary.main',
                        lineHeight: 1,
                    }}
                >
                    {date}
                </Typography>
                <Typography
                    sx={{
                        fontSize: '11px',
                        color: 'text.disabled',
                        lineHeight: 1,
                    }}
                >
                    {time}
                </Typography>
            </Box>

            {/* Title */}
            <Typography
                component={Link}
                href={`/news/${article.article_slug}`}
                sx={{
                    fontSize: getResponsiveFontSize('sm'),
                    fontWeight: fontWeight.semibold,
                    lineHeight: 1.4,
                    color: 'text.primary',
                    textDecoration: 'none',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    '&:hover': {
                        textDecoration: 'underline',
                    },
                }}
            >
                {article.title}
            </Typography>

            {/* Sapo */}
            {article.sapo && (
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        lineHeight: 1.4,
                        color: 'text.secondary',
                        mt: 0.25,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {article.category_name ? `(${article.category_name}) - ` : ''}{article.sapo}
                </Typography>
            )}

            {/* Source */}
            {article.source && (
                <Typography
                    sx={{
                        fontSize: '11px',
                        color: 'text.disabled',
                        mt: 0.25,
                        lineHeight: 1.2,
                    }}
                >
                    Nguồn: {article.source}
                </Typography>
            )}
        </Box>
    );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────
function PanelNewsCardSkeleton() {
    return (
        <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="text" width="60%" height={16} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width="100%" height={18} />
            <Skeleton variant="text" width="90%" height={18} />
            <Skeleton variant="text" width="100%" height={15} sx={{ mt: 0.25 }} />
            <Skeleton variant="text" width="75%" height={15} />
            <Skeleton variant="text" width="40%" height={14} sx={{ mt: 0.25 }} />
        </Box>
    );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
            <Newspaper sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
            <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                Chưa có tin tức
            </Typography>
        </Box>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PanelNewsList({ ticker, limit = 10 }: PanelNewsListProps) {
    const queryKey = ['news', 'panel', { ticker, limit }];

    const { data: newsData, isLoading, error } = useQuery({
        queryKey,
        queryFn: async () => {
            const queryParams: Record<string, string> = {
                page: '1',
                limit: String(limit),
                sort_by: NEWS_SORT_FIELD,
                sort_order: NEWS_SORT_ORDER,
                projection: JSON.stringify({
                    title: 1,
                    sapo: 1,
                    article_slug: 1,
                    source: 1,
                    category_name: 1,
                    created_at: 1,
                }),
            };

            if (ticker) {
                queryParams.ticker = ticker;
            }

            const response = await apiClient<NewsApiResponse>({
                url: '/api/v1/sse/rest/news_daily',
                method: 'GET',
                queryParams,
                requireAuth: false,
            });

            return response.data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });

    const articles = newsData?.items || [];

    // Loading
    if (isLoading) {
        return (
            <Box>
                {Array.from({ length: 5 }).map((_, i) => (
                    <PanelNewsCardSkeleton key={i} />
                ))}
            </Box>
        );
    }

    // Error
    if (error) {
        return (
            <Box sx={{ py: 2, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '12px', color: 'error.main' }}>
                    Không thể tải tin tức
                </Typography>
            </Box>
        );
    }

    // Empty
    if (articles.length === 0) {
        return <EmptyState />;
    }

    // List
    return (
        <Box>
            {articles.map((article) => (
                <PanelNewsCard key={article.article_slug} article={article} />
            ))}
        </Box>
    );
}
