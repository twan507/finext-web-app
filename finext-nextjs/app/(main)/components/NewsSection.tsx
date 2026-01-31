'use client';

import { Box, Typography, useTheme, Skeleton, Grid, Divider } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { spacing, getResponsiveFontSize, transitions, borderRadius, fontWeight } from 'theme/tokens';


import { apiClient } from 'services/apiClient';
import Link from 'next/link';
import Carousel from 'components/common/Carousel';

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
    sapo?: string;
    created_at: string;
}

interface NewsApiResponse {
    items: NewsArticle[];
}

interface ReportApiResponse {
    items: NewsReport[];
}


// ============================================================================
// MINI NEWS CARD COMPONENT
// ============================================================================

interface MiniNewsCardProps {
    article: NewsArticle;
}

function MiniNewsCard({ article }: MiniNewsCardProps) {
    const theme = useTheme();

    // Calculate fixed heights based on HOVER font sizes to prevent layout shift
    const titleHeight = {
        xs: `calc(1.4 * ${getResponsiveFontSize('md').xs} * 2)`,
        md: `calc(1.4 * ${getResponsiveFontSize('md').md} * 2)`,
        lg: `calc(1.4 * ${getResponsiveFontSize('md').lg} * 2)`,
    };

    const sapoHeight = {
        xs: `calc(1.5 * ${getResponsiveFontSize('sm').xs} * 2)`,
        md: `calc(1.5 * ${getResponsiveFontSize('sm').md} * 2)`,
        lg: `calc(1.5 * ${getResponsiveFontSize('sm').lg} * 2)`,
    };

    return (
        <Box
            sx={{
                '&:last-of-type .news-divider': {
                    display: 'none',
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    my: spacing.xxs,
                    width: '100%',
                    overflow: 'hidden',
                }}
            >
                {/* Title */}
                <Link href={`/news/${article.article_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Typography
                        variant="h6"
                        className="news-card-title"
                        sx={{
                            fontWeight: fontWeight.semibold,
                            fontSize: getResponsiveFontSize('sm'),
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            color: 'text.primary',
                            transition: transitions.hover,
                            height: titleHeight,
                            '&:hover': {
                                textDecoration: 'underline',
                            },
                        }}
                    >
                        {article.title}
                    </Typography>
                </Link>

                {/* Sapo */}
                <Typography
                    variant="body2"
                    className="news-card-sapo"
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        lineHeight: 1.6,
                        color: 'text.secondary',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: sapoHeight,
                        mt: 0.5, // Add slight margin since flex gap is gone from parent hover effect
                    }}
                >
                    {article.sapo}
                </Typography>
            </Box>
            <Divider className="news-divider" sx={{ borderColor: 'divider' }} />
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

    // Calculate fixed heights based on HOVER font sizes to prevent layout shift
    const titleHeight = {
        xs: `calc(1.4 * ${getResponsiveFontSize('md').xs} * 2)`,
        md: `calc(1.4 * ${getResponsiveFontSize('md').md} * 2)`,
        lg: `calc(1.4 * ${getResponsiveFontSize('md').lg} * 2)`,
    };

    const sapoHeight = {
        xs: `calc(1.5 * ${getResponsiveFontSize('sm').xs} * 2)`,
        md: `calc(1.5 * ${getResponsiveFontSize('sm').md} * 2)`,
        lg: `calc(1.5 * ${getResponsiveFontSize('sm').lg} * 2)`,
    };

    return (
        <Box
            sx={{
                '&:last-of-type .report-divider': {
                    display: 'none',
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    my: spacing.xxs,
                    width: '100%',
                    overflow: 'hidden',
                }}
            >
                {/* Title */}
                <Link href={`/reports/${report.report_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Typography
                        variant="h6"
                        className="report-card-title"
                        sx={{
                            fontWeight: fontWeight.semibold,
                            fontSize: getResponsiveFontSize('sm'),
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            color: 'text.primary',
                            transition: transitions.hover,
                            height: titleHeight,
                            '&:hover': {
                                textDecoration: 'underline',
                            },
                        }}
                    >
                        {report.title || 'Bản tin'}
                    </Typography>
                </Link>

                {/* Sapo */}
                <Typography
                    variant="body2"
                    className="report-card-sapo"
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        lineHeight: 1.6,
                        color: 'text.secondary',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: sapoHeight,
                        mt: 0.5,
                    }}
                >
                    {report.sapo || report.category_name || ''}
                </Typography>
            </Box>
            <Divider className="report-divider" sx={{ borderColor: 'divider' }} />
        </Box>
    );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function NewsCardSkeleton() {
    return (
        <>
            <Box sx={{ py: spacing.sm }}>
                <Skeleton variant="text" width="95%" height={18} sx={{ mb: spacing.xxs }} />
                <Skeleton variant="text" width="85%" height={18} sx={{ mb: spacing.xxs }} />
                <Skeleton variant="text" width="90%" height={16} />
                <Skeleton variant="text" width="70%" height={16} />
            </Box>
            <Divider sx={{ borderColor: 'divider' }} />
        </>
    );
}

// ============================================================================
// NEWS COLUMN COMPONENT
// ============================================================================

interface NewsColumnProps {
    title: string;
    href: string;
    loading: boolean;
    newsItems?: NewsArticle[];
    reportItems?: NewsReport[];
}

function NewsColumn({ title, href, loading, newsItems, reportItems }: NewsColumnProps) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                backgroundColor: 'background.paper',
                borderRadius: `${borderRadius.lg}px`,
                overflow: 'hidden',
                height: '100%',
            }}
        >
            {/* Column Header - Sticky */}
            <Box
                sx={{
                    display: 'block',
                    position: 'sticky',
                    top: 0,
                    px: spacing.xs,
                    py: spacing.xs,
                    zIndex: 1,
                    backgroundColor: 'background.paper',
                }}
            >
                <Link href={href} style={{ textDecoration: 'none' }}>
                    <Typography
                        className="column-title"
                        sx={{
                            fontSize: getResponsiveFontSize('lg'),
                            fontWeight: 'bold',
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            mb: 1,
                            transition: transitions.hover,
                            display: 'inline-block',
                            '&:hover': {
                                color: 'text.primary',
                            },
                        }}
                    >
                        {title}
                    </Typography>
                </Link>
            </Box>

            {/* Content */}
            <Box sx={{ px: spacing.xs }}>
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
        </Box>
    );
}

// ============================================================================
// MAIN NEWS SECTION COMPONENT
// ============================================================================

export default function NewsSection() {
    const theme = useTheme();
    const router = useRouter();

    // Fetch reports
    const { data: reportsData, isLoading: reportsLoading } = useQuery({
        queryKey: ['news', 'reports', 'home'],
        queryFn: async () => {
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
            return response.data;
        }
    });
    const reports = reportsData?.items || [];

    // Fetch macro news
    const { data: macroNewsData, isLoading: macroLoading } = useQuery({
        queryKey: ['news', 'macro', 'home'],
        queryFn: async () => {
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
            return response.data;
        }
    });
    const macroNews = macroNewsData?.items || [];

    // Fetch enterprise news
    const { data: enterpriseNewsData, isLoading: enterpriseLoading } = useQuery({
        queryKey: ['news', 'enterprise', 'home'],
        queryFn: async () => {
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
            return response.data;
        }
    });
    const enterpriseNews = enterpriseNewsData?.items || [];

    // Define the slides content
    const slides = [
        {
            id: 'macro',
            component: (
                <NewsColumn
                    title="TIN TỨC VĨ MÔ"
                    href="/news"
                    loading={macroLoading}
                    newsItems={macroNews}
                />
            )
        },
        {
            id: 'enterprise',
            component: (
                <NewsColumn
                    title="THỊ TRƯỜNG CHỨNG KHOÁN"
                    href="/news/category/ttck"
                    loading={enterpriseLoading}
                    newsItems={enterpriseNews}
                />
            )
        },
        {
            id: 'reports',
            component: (
                <NewsColumn
                    title="BẢN TIN HÀNG NGÀY"
                    href="/reports"
                    loading={reportsLoading}
                    reportItems={reports}
                />
            )
        }
    ];

    return (
        <Box>
            {/* Title - Tin tức (clickable) */}
            <Box
                onClick={() => router.push('/news')}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: spacing.xs,
                }}
            >
                <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1') }}>
                    Tin tức
                </Typography>
                <ChevronRightIcon sx={{ fontSize: getResponsiveFontSize('h2').md, mt: 1, color: theme.palette.text.secondary }} />
            </Box>

            {/* Content Container */}
            <Box>
                {/* 1. Desktop View (Grid) */}
                <Box
                    sx={{
                        display: { xs: 'none', md: 'grid' },
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 3,
                    }}
                >
                    {slides.map((slide) => (
                        <Box key={slide.id}>
                            {slide.component}
                        </Box>
                    ))}
                </Box>

                {/* 2. Mobile View (Carousel) */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <Carousel slides={slides} />
                </Box>
            </Box>
        </Box>
    );
}
