'use client';

import { Box, Typography, useTheme, Skeleton, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fontSize, spacing, getResponsiveFontSize, transitions, borderRadius } from 'theme/tokens';
import { apiClient } from 'services/apiClient';
import Link from 'next/link';

// ============================================================================
// TYPES
// ============================================================================

interface NewsArticle {
    article_id: string;
    source: string;
    category: string;
    category_name: string;
    title: string;
    sapo: string;
    created_at: string;
}

interface NewsReport {
    report_id: string;
    title: string;
    category: string;
    category_name: string;
    created_at: string;
}

interface NewsApiResponse {
    items: NewsArticle[];
}

interface ReportApiResponse {
    items: NewsReport[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// MINI NEWS CARD COMPONENT
// ============================================================================

interface MiniNewsCardProps {
    article: NewsArticle;
}

function MiniNewsCard({ article }: MiniNewsCardProps) {
    const theme = useTheme();

    return (
        <Box
            component={Link}
            href={`/news/${article.article_id}`}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                textDecoration: 'none',
                color: 'inherit',
                p: spacing.xs,
                mb: spacing.xs,
                width: '100%',
                overflow: 'hidden',
                backgroundColor: 'background.paper',
                borderRadius: `${borderRadius.lg}px`,
                cursor: 'pointer',
                transition: transitions.card,
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'light'
                        ? '0 4px 12px rgba(0, 0, 0, 0.08)'
                        : '0 4px 12px rgba(0, 0, 0, 0.3)',
                    '& .news-card-title': {
                        color: 'primary.main',
                    },
                },
                '&:last-child': {
                    mb: 0,
                },
            }}
        >
            {/* Title */}
            <Typography
                variant="h6"
                className="news-card-title"
                sx={{
                    fontWeight: 600,
                    fontSize: getResponsiveFontSize('sm'),
                    lineHeight: 1.4,
                    mb: spacing.xs,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    color: 'text.primary',
                    transition: transitions.colors,
                }}
            >
                {article.title}
            </Typography>

            {/* Sapo */}
            <Typography
                variant="body2"
                sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    lineHeight: 1.5,
                    color: 'text.secondary',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {article.sapo}
            </Typography>
        </Box>
    );
}

// ============================================================================
// MINI REPORT CARD COMPONENT
// ============================================================================

interface MiniReportCardProps {
    report: NewsReport;
}

function MiniReportCard({ report }: MiniReportCardProps) {
    const theme = useTheme();

    return (
        <Box
            component={Link}
            href={`/reports/${report.report_id}`}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                textDecoration: 'none',
                color: 'inherit',
                p: spacing.xs,
                mb: spacing.xs,
                width: '100%',
                overflow: 'hidden',
                backgroundColor: 'background.paper',
                borderRadius: `${borderRadius.lg}px`,
                cursor: 'pointer',
                transition: transitions.card,
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'light'
                        ? '0 4px 12px rgba(0, 0, 0, 0.08)'
                        : '0 4px 12px rgba(0, 0, 0, 0.3)',
                    '& .report-card-title': {
                        color: 'primary.main',
                    },
                },
                '&:last-child': {
                    mb: 0,
                },
            }}
        >
            {/* Title */}
            <Typography
                variant="h6"
                className="report-card-title"
                sx={{
                    fontWeight: 600,
                    fontSize: getResponsiveFontSize('sm'),
                    lineHeight: 1.4,
                    mb: spacing.xs,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    color: 'text.primary',
                    transition: transitions.colors,
                }}
            >
                {report.title || 'Bản tin'}
            </Typography>

            {/* Category */}
            {report.category_name && (
                <Typography
                    variant="body2"
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        lineHeight: 1.5,
                        color: 'text.secondary',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {report.category_name}
                </Typography>
            )}
        </Box>
    );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function NewsCardSkeleton() {
    return (
        <Box
            sx={{
                p: spacing.xs,
                mb: spacing.xxs,
                height: 120,
                backgroundColor: 'background.paper',
                borderRadius: `${borderRadius.lg}px`,
            }}
        >
            <Skeleton variant="text" width="95%" height={18} sx={{ mb: spacing.xxs }} />
            <Skeleton variant="text" width="85%" height={18} sx={{ mb: spacing.xxs }} />
            <Skeleton variant="text" width="90%" height={16} />
            <Skeleton variant="text" width="70%" height={16} />
        </Box>
    );
}

// ============================================================================
// NEWS COLUMN COMPONENT
// ============================================================================

interface NewsColumnProps {
    loading: boolean;
    newsItems?: NewsArticle[];
    reportItems?: NewsReport[];
}

function NewsColumn({ loading, newsItems, reportItems }: NewsColumnProps) {
    return (
        <Box>
            {loading ? (
                <>
                    {Array.from({ length: 5 }).map((_, index) => (
                        <NewsCardSkeleton key={index} />
                    ))}
                </>
            ) : (
                <>
                    {newsItems?.map((article) => (
                        <MiniNewsCard key={article.article_id} article={article} />
                    ))}
                    {reportItems?.map((report) => (
                        <MiniReportCard key={report.report_id} report={report} />
                    ))}
                </>
            )}
        </Box>
    );
}

// ============================================================================
// MAIN NEWS SECTION COMPONENT
// ============================================================================

export default function NewsSection() {
    const theme = useTheme();
    const router = useRouter();

    // State for reports
    const [reports, setReports] = useState<NewsReport[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);

    // State for macro news
    const [macroNews, setMacroNews] = useState<NewsArticle[]>([]);
    const [macroLoading, setMacroLoading] = useState(true);

    // State for enterprise news
    const [enterpriseNews, setEnterpriseNews] = useState<NewsArticle[]>([]);
    const [enterpriseLoading, setEnterpriseLoading] = useState(true);

    // Fetch reports
    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await apiClient<ReportApiResponse>({
                    url: '/api/v1/sse/rest/news_report',
                    method: 'GET',
                    queryParams: {
                        page: '1',
                        limit: '5',
                        sort_by: 'created_at',
                        sort_order: 'desc',
                    },
                    requireAuth: false,
                });

                if (response.data?.items) {
                    setReports(response.data.items);
                }
            } catch (error) {
                console.error('[NewsSection] Failed to fetch reports:', error);
            } finally {
                setReportsLoading(false);
            }
        };

        fetchReports();
    }, []);

    // Fetch macro news
    useEffect(() => {
        const fetchMacroNews = async () => {
            try {
                const response = await apiClient<NewsApiResponse>({
                    url: '/api/v1/sse/rest/news_daily',
                    method: 'GET',
                    queryParams: {
                        page: '1',
                        limit: '5',
                        sort_by: 'created_at',
                        sort_order: 'desc',
                        source: 'baochinhphu.vn',
                    },
                    requireAuth: false,
                });

                if (response.data?.items) {
                    setMacroNews(response.data.items);
                }
            } catch (error) {
                console.error('[NewsSection] Failed to fetch macro news:', error);
            } finally {
                setMacroLoading(false);
            }
        };

        fetchMacroNews();
    }, []);

    // Fetch enterprise news
    useEffect(() => {
        const fetchEnterpriseNews = async () => {
            try {
                const response = await apiClient<NewsApiResponse>({
                    url: '/api/v1/sse/rest/news_daily',
                    method: 'GET',
                    queryParams: {
                        page: '1',
                        limit: '5',
                        sort_by: 'created_at',
                        sort_order: 'desc',
                        source: 'findata.vn',
                    },
                    requireAuth: false,
                });

                if (response.data?.items) {
                    setEnterpriseNews(response.data.items);
                }
            } catch (error) {
                console.error('[NewsSection] Failed to fetch enterprise news:', error);
            } finally {
                setEnterpriseLoading(false);
            }
        };

        fetchEnterpriseNews();
    }, []);

    return (
        <Box>
            {/* Title - Tin tức (clickable) */}
            <Box
                onClick={() => router.push('/news')}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 2,
                }}
            >
                <Typography variant="h1">
                    Tin tức
                </Typography>
                <ChevronRightIcon sx={{ fontSize: fontSize.h2.tablet, mt: 1, color: theme.palette.text.secondary }} />
            </Box>

            {/* Three Column Layout */}
            <Grid container spacing={{ xs: 2, md: 3 }}>
                {/* Column 1: Macro News */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <NewsColumn
                        loading={macroLoading}
                        newsItems={macroNews}
                    />
                </Grid>

                {/* Column 2: Enterprise News */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <NewsColumn
                        loading={enterpriseLoading}
                        newsItems={enterpriseNews}
                    />
                </Grid>

                {/* Column 3: Reports */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <NewsColumn
                        loading={reportsLoading}
                        reportItems={reports}
                    />
                </Grid>
            </Grid>
        </Box>
    );
}
