// finext-nextjs/app/(main)/reports/[reportId]/PageContent.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Box,
    IconButton,
    Skeleton,
    Stack,
    Tooltip,
    Typography,
    Alert,
    Button,
    Divider,
} from '@mui/material';
import {
    AccessTime,
    ArrowBack,
    Share,
    ContentCopy,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

import { apiClient } from 'services/apiClient';
import { ReportApiResponse, NewsReport } from '../types';
import NewsBreadcrumb from '../../news/components/NewsBreadcrumb';
import { spacing, borderRadius, getResponsiveFontSize } from 'theme/tokens';

interface PageContentProps {
    reportId: string;
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

/** Extract title from report_html or use title field */
const getTitle = (report: NewsReport): string => {
    // Ưu tiên dùng title từ API
    if (report.title) return report.title;

    // Fallback: extract từ HTML
    if (!report.report_html) return 'Bản tin';
    const h2Match = report.report_html.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (h2Match) {
        return h2Match[1].replace(/<[^>]*>/g, '').trim();
    }
    return 'Bản tin';
};

/** Loading skeleton */
function ReportSkeleton() {
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

export default function PageContent({ reportId }: PageContentProps) {
    const router = useRouter();
    const [report, setReport] = useState<NewsReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch tất cả reports và tìm theo report_id
            const response = await apiClient<ReportApiResponse>({
                url: '/api/v1/sse/rest/news_report',
                method: 'GET',
                queryParams: {
                    limit: '100',
                },
                requireAuth: false,
            });

            if (response.data?.items) {
                const found = response.data.items.find(
                    (item) => item.report_id === reportId
                );

                if (found) {
                    setReport(found);
                } else {
                    setError('Không tìm thấy bản tin');
                }
            }
        } catch (err: any) {
            console.error('[ReportDetail] Fetch error:', err);
            setError(err.message || 'Không thể tải bản tin');
        } finally {
            setLoading(false);
        }
    }, [reportId]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleShare = async () => {
        if (navigator.share && report) {
            try {
                await navigator.share({
                    title: getTitle(report),
                    url: window.location.href,
                });
            } catch (err) {
                // User cancelled or error
            }
        } else {
            handleCopyLink();
        }
    };

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
                    onClick={() => router.push('/reports')}
                >
                    Quay lại bản tin
                </Button>
            </Box>
        );
    }

    const title = report ? getTitle(report) : 'Bản tin';
    const categoryName = report?.category_name || '';

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumbs */}
            <NewsBreadcrumb
                sectionLabel="Bản tin"
                sectionHref="/reports"
                items={
                    report
                        ? [
                            { label: categoryName, href: `/reports/category/${report.category}` },
                            { label: title },
                        ]
                        : [{ label: loading ? 'Đang tải...' : 'Bản tin' }]
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
            {loading && <ReportSkeleton />}

            {/* Report content */}
            {!loading && report && (
                <Box>
                    {/* Header */}
                    <Box>
                        {/* Meta info */}
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={2}
                            sx={{ mb: spacing.xs }}
                        >
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <AccessTime sx={{ fontSize: getResponsiveFontSize('md'), color: 'text.secondary' }} />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontSize: getResponsiveFontSize('md') }}
                                >
                                    {formatDate(report.created_at)}
                                </Typography>
                            </Stack>

                            {/* Actions */}
                            <Stack direction="row" spacing={1}>
                                <Tooltip title={copied ? 'Đã sao chép!' : 'Sao chép link'}>
                                    <IconButton
                                        size="small"
                                        onClick={handleCopyLink}
                                        sx={{
                                            bgcolor: 'action.hover',
                                            '&:hover': { bgcolor: 'action.selected' },
                                        }}
                                    >
                                        <ContentCopy sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Chia sẻ">
                                    <IconButton
                                        size="small"
                                        onClick={handleShare}
                                        sx={{
                                            bgcolor: 'action.hover',
                                            '&:hover': { bgcolor: 'action.selected' },
                                        }}
                                    >
                                        <Share sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Box>

                    <Divider sx={{ my: spacing.xs }} />

                    {/* Content - Render HTML directly */}
                    <Box
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
                            lineHeight: 1.8,
                            color: 'text.primary',
                            '& h2': {
                                fontSize: getResponsiveFontSize('h5'),
                                fontWeight: 700,
                                mt: 4,
                                mb: 2,
                            },
                            '& h3': {
                                fontSize: getResponsiveFontSize('h6'),
                                fontWeight: 600,
                                mt: 3,
                                mb: 2,
                            },
                            '& p': {
                                mb: 2,
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
                            '& strong': {
                                fontWeight: 700,
                            },
                            '& hr': {
                                my: 3,
                                border: 'none',
                                borderTop: '1px solid',
                                borderColor: 'divider',
                            },
                        }}
                        dangerouslySetInnerHTML={{ __html: report.report_html }}
                    />

                    {/* Tickers as hashtags */}
                    {report.tickers && report.tickers.length > 0 && (
                        <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ mt: spacing.sm }}
                        >
                            {report.tickers.map((ticker) => (
                                <Typography
                                    key={ticker}
                                    component="span"
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        fontWeight: 500,
                                        color: 'text.secondary',
                                    }}
                                >
                                    #{ticker}
                                </Typography>
                            ))}
                        </Stack>
                    )}

                    {/* Links */}
                    {report.links && report.links.length > 0 && (
                        <Box sx={{ mt: spacing.sm }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                Liên kết liên quan:
                            </Typography>
                            <Stack spacing={0.5}>
                                {report.links.map((link, index) => {
                                    // Handle both string and object formats
                                    const linkUrl = typeof link === 'string' ? link : link.url;
                                    const linkTitle = typeof link === 'string' ? link : (link.title || link.url);

                                    if (!linkUrl) return null;

                                    return (
                                        <Typography
                                            key={index}
                                            component="a"
                                            href={linkUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            sx={{
                                                color: 'primary.main',
                                                textDecoration: 'none',
                                                fontSize: getResponsiveFontSize('sm'),
                                                display: 'block',
                                                '&:hover': {
                                                    textDecoration: 'underline',
                                                },
                                            }}
                                        >
                                            • {linkTitle}
                                        </Typography>
                                    );
                                })}
                            </Stack>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}
