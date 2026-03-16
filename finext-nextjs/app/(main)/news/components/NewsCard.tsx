// finext-nextjs/app/(main)/news/components/NewsCard.tsx
'use client';

import { useState } from 'react';
import { Box, Snackbar, Typography, useTheme } from '@mui/material';
import Link from 'next/link';

import { apiClient } from 'services/apiClient';
import { NewsArticle, getTypeConfigByType } from '../types';
import { spacing, transitions, getResponsiveFontSize, fontWeight } from 'theme/tokens';

interface NewsCardProps {
    article: NewsArticle;
}

/** Parse date và trả về ngày + giờ */
const parseDateTime = (dateStr: string): { date: string; time: string } => {
    try {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }),
            time: date.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
            }),
        };
    } catch {
        return { date: dateStr, time: '' };
    }
};

export default function NewsCard({ article }: NewsCardProps) {
    const theme = useTheme();
    const typeConfig = getTypeConfigByType(article.news_type);
    const { date, time } = parseDateTime(article.created_at);
    const [copied, setCopied] = useState(false);

    const handleCopyContent = async () => {
        try {
            const response = await apiClient<{ article: NewsArticle | null }>({
                url: '/api/v1/sse/rest/news_article',
                method: 'GET',
                queryParams: { article_slug: article.article_slug },
                requireAuth: false,
            });
            const full = response.data?.article;
            if (!full) return;
            const copyData = {
                title: full.title,
                sapo: full.sapo || '',
                content: full.plain_content || '',
                created_at: full.created_at,
            };
            await navigator.clipboard.writeText(JSON.stringify(copyData));
            setCopied(true);
        } catch (err) {
            console.error('Failed to copy content:', err);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                gap: { xs: spacing.xs, md: spacing.sm },
                py: spacing.xxs,
                borderBottom: '1px solid',
                borderColor: 'divider',
                transition: transitions.colors,
                '&:last-child': {
                    borderBottom: 'none',
                },
            }}
        >
            {/* Cột trái: Ngày + Giờ */}
            <Box
                sx={{
                    flexShrink: 0,
                    width: { xs: 80, md: 100 },
                    textAlign: 'left',
                }}
            >
                <Typography
                    variant="body2"
                    color="primary.main"
                    sx={{
                        fontWeight: fontWeight.medium,
                        fontSize: getResponsiveFontSize('sm'),
                    }}
                >
                    {date}
                </Typography>
                <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                    }}
                >
                    {time}
                </Typography>
            </Box>

            {/* Cột giữa: Tiêu đề + Sapo */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* Tiêu đề - click để vào bài */}
                <Typography
                    className="news-title"
                    component={Link}
                    href={`/news/${article.article_slug}`}
                    variant="h6"
                    sx={{
                        fontWeight: fontWeight.semibold,
                        fontSize: getResponsiveFontSize('md'),
                        lineHeight: 1.4,
                        mb: 0.5,
                        transition: transitions.colors,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        '&:hover': {
                            textDecoration: 'underline',
                        },
                    }}
                >
                    {article.title}
                </Typography>

                {/* Sapo - double click để copy */}
                <Typography
                    variant="body2"
                    color="text.secondary"
                    onDoubleClick={handleCopyContent}
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        userSelect: 'none',
                    }}
                >
                    {article.category_name ? `(${article.category_name}) - ` : ''}{article.sapo}
                </Typography>

                {/* Source - nguồn tin */}
                {article.source && (
                    <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            mt: 0.5,
                            display: 'block',
                        }}
                    >
                        Nguồn: {article.source}
                    </Typography>
                )}
            </Box>

            {/* Cột phải: Ảnh đại diện */}
            {article.image && (
                <Box
                    sx={{
                        flexShrink: 0,
                        width: { xs: 100, sm: 140, md: 180 },
                        height: { xs: 70, sm: 90, md: 110 },
                        borderRadius: `${theme.shape.borderRadius}px`,
                        overflow: 'hidden',
                        alignSelf: 'center',
                    }}
                >
                    <Box
                        component="img"
                        src={article.image}
                        alt={article.title}
                        sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                        }}
                    />
                </Box>
            )}

            <Snackbar
                open={copied}
                autoHideDuration={1500}
                onClose={() => setCopied(false)}
                message="Đã copy nội dung bài viết"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Box>
    );
}
