// finext-nextjs/app/(main)/news/components/NewsCard.tsx
'use client';

import { Box, Stack, Typography, useTheme } from '@mui/material';
import Link from 'next/link';

import { NewsArticle, getSourceConfigBySource } from '../types';
import { spacing, transitions, getResponsiveFontSize } from 'theme/tokens';

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
    const sourceConfig = getSourceConfigBySource(article.source);
    const { date, time } = parseDateTime(article.created_at);

    return (
        <Box
            component={Link}
            href={`/news/${article.article_id}`}
            sx={{
                display: 'flex',
                gap: { xs: spacing.xs, md: spacing.sm },
                py: spacing.xxs,
                textDecoration: 'none',
                color: 'inherit',
                borderBottom: '1px solid',
                borderColor: 'divider',
                transition: transitions.colors,
                '&:hover': {
                    '& .news-title': {
                        color: 'primary.main',
                    },
                },
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
                        fontWeight: 600,
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

            {/* Cột phải: Tiêu đề + Sapo */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* Tiêu đề */}
                <Typography
                    className="news-title"
                    variant="h6"
                    sx={{
                        fontWeight: 700,
                        fontSize: getResponsiveFontSize('md'),
                        lineHeight: 1.4,
                        mb: 0.5,
                        transition: transitions.colors,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {article.title}
                </Typography>

                {/* Sapo */}
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {article.category_name ? `(${article.category_name}) - ` : ''}{article.sapo}
                </Typography>
            </Box>
        </Box>
    );
}
