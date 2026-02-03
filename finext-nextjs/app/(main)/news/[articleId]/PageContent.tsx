// finext-nextjs/app/(main)/news/[articleId]/PageContent.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Skeleton,
    Stack,
    Tooltip,
    Typography,
    Alert,
    Button,
} from '@mui/material';
import {
    AccessTime,
    ArrowBack,
    Launch,
    Share,
    ContentCopy,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

import { apiClient } from 'services/apiClient';
import { NewsApiResponse, NewsArticle, getSourceConfigBySource } from '../types';
import { NewsBreadcrumb } from '../components';
import { spacing, borderRadius, getResponsiveFontSize, shadows, fontWeight } from 'theme/tokens';

interface PageContentProps {
    articleId: string;
}

/** Format date từ ISO string */
const formatDate = (dateStr: string): string => {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).replace('lúc ', '');
    } catch {
        return dateStr;
    }
};

/** Loading skeleton */
function ArticleSkeleton() {
    return (
        <Box>
            <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <Skeleton variant="rounded" width={100} height={28} />
                <Skeleton variant="text" width={200} />
            </Stack>
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
            <Box sx={{ my: 4 }}>
                <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 2 }} />
            </Box>
            {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="text" width={i % 3 === 0 ? '90%' : '100%'} />
            ))}
        </Box>
    );
}

export default function PageContent({ articleId }: PageContentProps) {
    const router = useRouter();
    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedContent, setCopiedContent] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const fetchArticle = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch tất cả news và tìm theo article_id
            // TODO: Backend nên có endpoint GET /news/{article_id} riêng
            const response = await apiClient<NewsApiResponse>({
                url: '/api/v1/sse/rest/news_daily',
                method: 'GET',
                queryParams: {
                    limit: '100', // Lấy nhiều để tìm
                },
                requireAuth: false,
            });

            if (response.data?.items) {
                const found = response.data.items.find(
                    (item) => item.article_id === articleId
                );

                if (found) {
                    setArticle(found);
                } else {
                    setError('Không tìm thấy bài viết');
                }
            }
        } catch (err: any) {
            console.error('[ArticleDetail] Fetch error:', err);
            setError(err.message || 'Không thể tải bài viết');
        } finally {
            setLoading(false);
        }
    }, [articleId]);

    useEffect(() => {
        fetchArticle();
    }, [fetchArticle]);

    const handleCopyContent = async () => {
        if (!article) return;
        try {
            // Extract plain text from HTML content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = article.html_content;
            const plainText = `${article.title}\n\n${article.sapo || ''}\n\n${tempDiv.textContent || tempDiv.innerText || ''}`;

            await navigator.clipboard.writeText(plainText);
            setCopiedContent(true);
            setTimeout(() => setCopiedContent(false), 2000);
        } catch (err) {
            console.error('Failed to copy content:', err);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    const sourceConfig = article ? getSourceConfigBySource(article.source) : null;

    // Error state
    if (error) {
        return (
            <Box sx={{ py: spacing.sm, textAlign: 'center' }}>
                <Alert
                    severity="error"
                    sx={{
                        mb: spacing.sm,
                        maxWidth: 500,
                        mx: 'auto',
                        borderRadius: `${borderRadius.md}px`,
                    }}
                >
                    {error}
                </Alert>
                <Button
                    variant="contained"
                    startIcon={<ArrowBack />}
                    onClick={() => router.push('/news')}
                >
                    Quay lại tin tức
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumbs */}
            <NewsBreadcrumb
                loading={loading}
                items={
                    article
                        ? [
                            {
                                label: sourceConfig?.label || article.source,
                                href: `/news/category/${article.source}`
                            },
                            ...(article.category_name
                                ? [{ label: article.category_name }]
                                : []),
                        ]
                        : []
                }
            />

            {/* Back button */}
            <Button
                variant="text"
                startIcon={<ArrowBack />}
                onClick={() => router.back()}
                sx={{
                    mb: spacing.xs,
                    color: 'text.secondary',
                    '&:hover': {
                        color: 'primary.main',
                    },
                }}
            >
                Quay lại
            </Button>

            {/* Loading */}
            {loading && <ArticleSkeleton />}

            {/* Article content */}
            {!loading && article && (
                <Box>
                    {/* Header */}
                    <Box sx={{}}>
                        {/* Title */}
                        <Typography
                            variant="h4"
                            component="h1"
                            sx={{
                                fontWeight: fontWeight.extrabold,
                                fontSize: getResponsiveFontSize('h3'),
                                lineHeight: 1.3,
                                mb: spacing.xxs,
                            }}
                        >
                            {article.title}
                        </Typography>

                        {/* Meta info */}
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={2}
                        >
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <AccessTime sx={{ fontSize: getResponsiveFontSize('md'), color: 'text.secondary' }} />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontSize: getResponsiveFontSize('md') }}
                                >
                                    {formatDate(article.created_at)}
                                </Typography>
                            </Stack>

                            {/* Actions */}
                            <Stack direction="row" spacing={1}>
                                <Tooltip title={copiedContent ? 'Đã sao chép!' : 'Sao chép nội dung'}>
                                    <IconButton
                                        size="small"
                                        onClick={handleCopyContent}
                                        sx={{
                                            bgcolor: 'action.hover',
                                            '&:hover': { bgcolor: 'action.selected' },
                                        }}
                                    >
                                        <ContentCopy sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={copiedLink ? 'Đã sao chép!' : 'Sao chép link'}>
                                    <IconButton
                                        size="small"
                                        onClick={handleCopyLink}
                                        sx={{
                                            bgcolor: 'action.hover',
                                            '&:hover': { bgcolor: 'action.selected' },
                                        }}
                                    >
                                        <Share sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Xem bài gốc">
                                    <IconButton
                                        size="small"
                                        component="a"
                                        href={article.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{
                                            bgcolor: 'action.hover',
                                            '&:hover': { bgcolor: 'action.selected' },
                                        }}
                                    >
                                        <Launch sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Box>

                    <Divider sx={{ my: spacing.xs }} />

                    {/* Sapo */}
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: fontWeight.semibold,
                            fontSize: getResponsiveFontSize('md'),
                            lineHeight: 1.7,
                            mb: spacing.xs,
                            color: 'text.primary',
                            fontStyle: 'italic',
                        }}
                    >
                        {article.sapo}
                    </Typography>

                    {/* Content */}
                    <Box
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
                            lineHeight: 1.8,
                            color: 'text.primary',
                            '& h2': {
                                fontSize: getResponsiveFontSize('xl'),
                                fontWeight: fontWeight.bold,
                                mt: 4,
                                mb: 2,
                            },
                            '& h3': {
                                fontSize: getResponsiveFontSize('lg'),
                                fontWeight: fontWeight.semibold,
                                mt: 3,
                                mb: 2,
                            },
                            '& p': {
                                mb: 2,
                            },
                            '& img': {
                                maxWidth: '100%',
                                height: 'auto',
                                borderRadius: `${borderRadius.md}px`,
                                my: 2,
                            },
                            '& a': {
                                color: 'primary.main',
                                textDecoration: 'none',
                                '&:hover': {
                                    textDecoration: 'underline',
                                },
                            },
                            '& ul, & ol': {
                                pl: 3,
                                mb: 2,
                            },
                            '& li': {
                                mb: 1,
                            },
                            '& blockquote': {
                                borderLeft: '4px solid',
                                borderColor: 'primary.main',
                                pl: 2,
                                py: 1,
                                my: 2,
                                bgcolor: 'action.hover',
                                borderRadius: `0 ${borderRadius.sm}px ${borderRadius.sm}px 0`,
                            },
                        }}
                        dangerouslySetInnerHTML={{ __html: article.html_content }}
                    />

                    {/* Tickers as hashtags */}
                    {article.tickers && article.tickers.length > 0 && (
                        <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: spacing.sm }}
                        >
                            {article.tickers.map((ticker) => (
                                <Typography
                                    key={ticker}
                                    component="span"
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        fontWeight: fontWeight.medium,
                                        color: 'text.secondary',
                                    }}
                                >
                                    #{ticker}
                                </Typography>
                            ))}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
}
