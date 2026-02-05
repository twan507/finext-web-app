// finext-nextjs/app/(main)/reports/[reportId]/PageContent.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Box,
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
    Share,
    ContentCopy,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

import { apiClient } from 'services/apiClient';
import { ReportApiResponse, NewsReport, getReportTypeInfo } from '../types';
import NewsBreadcrumb from '../../news/components/NewsBreadcrumb';
import { spacing, borderRadius, getResponsiveFontSize, fontWeight } from 'theme/tokens';

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
    if (!report.report_html) return 'Báo cáo';
    const h2Match = report.report_html.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (h2Match) {
        return h2Match[1].replace(/<[^>]*>/g, '').trim();
    }
    return 'Báo cáo';
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
    const [copiedContent, setCopiedContent] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch trực tiếp 1 báo cáo theo report_slug (tối ưu hơn nhiều)
            const response = await apiClient<{ report: NewsReport | null; error?: string }>({
                url: '/api/v1/sse/rest/report_article',
                method: 'GET',
                queryParams: {
                    report_slug: reportId,
                },
                requireAuth: false,
            });

            if (response.data?.report) {
                setReport(response.data.report);
            } else {
                setError('Không tìm thấy bản tin');
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

    const handleCopyContent = async () => {
        if (!report) return;
        try {
            // Use report_markdown if available, otherwise extract from HTML
            let content = '';
            if (report.report_markdown) {
                content = report.report_markdown;
            } else {
                // Fallback: extract plain text from HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = report.report_html;
                content = `${getTitle(report)}\n\n${report.sapo || ''}\n\n${tempDiv.textContent || tempDiv.innerText || ''}`;
            }

            await navigator.clipboard.writeText(content);
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

    const title = report ? getTitle(report) : 'Báo cáo';
    const reportTypeInfo = report ? getReportTypeInfo(report.report_type) : null;

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumbs */}
            <NewsBreadcrumb
                sectionLabel="Báo cáo"
                sectionHref="/reports"
                loading={loading}
                items={
                    report
                        ? [
                            ...(reportTypeInfo
                                ? [{ label: reportTypeInfo.type_name, href: `/reports/type/${report.report_type}` }]
                                : []),
                            { label: title.length > 50 ? title.substring(0, 50) + '...' : title },
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
            {loading && <ReportSkeleton />}

            {/* Report content */}
            {!loading && report && (
                <Box>
                    {/* Header */}
                    <Box sx={{}}>
                        {/* Title */}
                        <Typography
                            variant="h4"
                            component="h1"
                            sx={{
                                fontWeight: fontWeight.bold,
                                fontSize: getResponsiveFontSize('h3'),
                                lineHeight: 1.3,
                                mb: spacing.xxs,
                            }}
                        >
                            {title}
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
                                    {formatDate(report.created_at)}
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
                            </Stack>
                        </Stack>
                    </Box>

                    <Divider sx={{ my: spacing.xs }} />

                    {/* Sapo */}
                    {report.sapo && (
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: fontWeight.medium,
                                fontSize: getResponsiveFontSize('md'),
                                lineHeight: 1.7,
                                mb: spacing.xs,
                                color: 'text.primary',
                                fontStyle: 'italic',
                            }}
                        >
                            {report.sapo}
                        </Typography>
                    )}

                    {/* Content - Render HTML directly */}
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
                                fontWeight: fontWeight.bold,
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
                            '& strong': {
                                fontWeight: fontWeight.bold,
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
                                        fontWeight: fontWeight.medium,
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
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: fontWeight.medium }}>
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
