'use client';

import { Box, Typography, useTheme, Skeleton, Divider, keyframes, alpha } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PublicIcon from '@mui/icons-material/Public';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import DescriptionIcon from '@mui/icons-material/Description';
import CampaignIcon from '@mui/icons-material/Campaign';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import { spacing, getResponsiveFontSize, transitions, borderRadius, fontWeight } from 'theme/tokens';

// ============================================================================
// KEYFRAME ANIMATIONS
// ============================================================================

const pulseRing = keyframes`
    0% {
        transform: scale(0.8);
        opacity: 1;
    }
    50% {
        transform: scale(1.5);
        opacity: 0.4;
    }
    100% {
        transform: scale(2);
        opacity: 0;
    }
`;

const pulseCore = keyframes`
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 currentColor;
    }
    50% {
        transform: scale(1.1);
        box-shadow: 0 0 8px 2px currentColor;
    }
`;


import { apiClient } from 'services/apiClient';
import Link from 'next/link';
import Carousel from 'components/common/Carousel';

// ============================================================================
// TYPES
// ============================================================================

interface NewsArticle {
    article_slug: string;
    source: string;
    category: string;
    category_name: string;
    title: string;
    sapo: string;
    created_at: string;
}

interface NewsReport {
    report_slug: string;
    title: string;
    category: string;
    category_name: string;
    sapo?: string;
    created_at: string;
}

interface NewsApiResponse {
    items: NewsArticle[];
    pagination?: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
    };
}

interface ReportApiResponse {
    items: NewsReport[];
    pagination?: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
    };
}

// News count API response interface
interface NewsCountResponse {
    date: string;
    today_start: string;
    sources: {
        'thong_cao'?: number;
        'trong_nuoc'?: number;
        'doanh_nghiep'?: number;
        'quoc_te'?: number;
        'news_report'?: number;
    };
    total: number;
}

// ============================================================================
// LIVE INDICATOR COMPONENT
// ============================================================================

function LiveIndicator() {
    const theme = useTheme();
    const liveColor = theme.palette.primary.main;

    return (
        <Box
            sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 12,
                height: 12,
            }}
        >
            {/* Outer pulse ring */}
            <Box
                sx={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: liveColor,
                    animation: `${pulseRing} 2s ease-out infinite`,
                }}
            />
            {/* Inner core dot */}
            <Box
                sx={{
                    position: 'relative',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: liveColor,
                    color: liveColor,
                    animation: `${pulseCore} 2s ease-in-out infinite`,
                    zIndex: 1,
                }}
            />
        </Box>
    );
}

// ============================================================================
// NEWS STATS CARD COMPONENT
// ============================================================================

interface NewsStatsProps {
    totalNews: number;
    thongcaoCount: number;
    trongnuocCount: number;
    doanhnghiepCount: number;
    quocteCount: number;
    isLoading: boolean;
}

function NewsStatsBar({ totalNews, thongcaoCount, trongnuocCount, doanhnghiepCount, quocteCount, isLoading }: NewsStatsProps) {
    const theme = useTheme();

    const statsItems = [
        {
            label: 'Quốc tế',
            count: quocteCount,
            icon: <PublicIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />,
            color: theme.palette.info.main,
        },
        {
            label: 'Trong nước',
            count: trongnuocCount,
            icon: <NewspaperIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />,
            color: theme.palette.success.main,
        },
        {
            label: 'Doanh nghiệp',
            count: doanhnghiepCount,
            icon: <BusinessCenterIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />,
            color: theme.palette.primary.main,
        },
        {
            label: 'Thông cáo',
            count: thongcaoCount,
            icon: <CampaignIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />,
            color: theme.palette.warning.main,
        },
    ];

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                gap: { xs: 2, md: 3 },
                mb: spacing.sm,
            }}
        >
            {/* Total News with Live Indicator */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    minWidth: { xs: '150px', md: '180px' },
                    flexShrink: 0,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            color: 'text.secondary',
                            fontWeight: fontWeight.medium,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Cập nhật hôm nay
                    </Typography>
                    <LiveIndicator />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('xl'),
                            fontWeight: fontWeight.bold,
                            color: 'text.primary',
                        }}
                    >
                        {isLoading ? <Skeleton width={40} height={32} sx={{ display: 'inline-block' }} /> : totalNews}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        tin tức
                    </Typography>
                </Box>
            </Box>

            {/* Stats by Source */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(2, 1fr)',
                        md: 'repeat(4, minmax(100px, 150px))'
                    },
                    gap: { xs: 2, md: 3, lg: 4 },
                    width: { xs: '100%', md: 'auto' },
                    justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                }}
            >
                {statsItems.map((item) => (
                    <Box
                        key={item.label}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            minWidth: 0,
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: { xs: 40, md: 48 },
                                height: { xs: 40, md: 48 },
                                borderRadius: `${borderRadius.md}px`,
                                backgroundColor: alpha(item.color, 0.12),
                                color: item.color,
                                flexShrink: 0,
                            }}
                        >
                            {item.icon}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    color: 'text.secondary',
                                    lineHeight: 1.3,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {item.label}
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('xl'),
                                    fontWeight: fontWeight.bold,
                                    color: item.color,
                                    lineHeight: 1.2,
                                }}
                            >
                                {isLoading ? <Skeleton width={30} height={28} /> : item.count}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
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
                <Link href={`/news/${article.article_slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                <Link href={`/reports/${report.report_slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                        {report.title || 'Báo cáo'}
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

// Content only (no background wrapper) - for use inside Carousel
function NewsColumnContent({ title, href, loading, newsItems, reportItems }: NewsColumnProps) {
    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', mb: 1 }}>
            {/* Column Header */}
            <Box sx={{ mb: 1 }}>
                <Link href={href} style={{ textDecoration: 'none' }}>
                    <Typography
                        className="column-title"
                        sx={{
                            fontSize: getResponsiveFontSize('lg'),
                            fontWeight: 'bold',
                            color: 'text.secondary',
                            textTransform: 'uppercase',
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
            <Box sx={{ flex: 1 }}>
                {loading ? (
                    <>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <NewsCardSkeleton key={index} />
                        ))}
                    </>
                ) : (
                    <>
                        {newsItems?.map((article) => (
                            <MiniNewsCard key={article.article_slug} article={article} />
                        ))}
                        {reportItems?.map((report) => (
                            <MiniReportCard key={report.report_slug} report={report} />
                        ))}
                    </>
                )}
            </Box>
        </Box>
    );
}

// Full component with background wrapper - for Desktop grid
function NewsColumn({ title, href, loading, newsItems, reportItems }: NewsColumnProps) {
    return (
        <Box
            sx={{
                backgroundColor: 'background.paper',
                borderRadius: `${borderRadius.lg}px`,
                overflow: 'hidden',
                height: '100%',
                p: spacing.xs,
            }}
        >
            <NewsColumnContent
                title={title}
                href={href}
                loading={loading}
                newsItems={newsItems}
                reportItems={reportItems}
            />
        </Box>
    );
}

// ============================================================================
// MAIN NEWS SECTION COMPONENT
// ============================================================================

export default function NewsSection() {
    const theme = useTheme();
    const router = useRouter();

    // ========================================================================
    // STATS API CALL - Fetch news counts for today from BE
    // ========================================================================

    const { data: newsCountData, isLoading: statsLoading } = useQuery({
        queryKey: ['news', 'stats', 'count'],
        queryFn: async () => {
            const response = await apiClient<NewsCountResponse>({
                url: '/api/v1/sse/rest/news_count',
                method: 'GET',
                requireAuth: false,
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });

    // Extract stats from response
    const thongcaoCount = newsCountData?.sources?.['thong_cao'] || 0;
    const trongnuocCount = newsCountData?.sources?.['trong_nuoc'] || 0;
    const doanhnghiepCount = newsCountData?.sources?.['doanh_nghiep'] || 0;
    const quocteCount = newsCountData?.sources?.['quoc_te'] || 0;
    const totalNews = newsCountData?.total || 0;

    // ========================================================================
    // NEWS LIST API CALLS - Fetch news for display (5 items each)
    // ========================================================================

    // Fetch thong cao news
    const { data: thongcaoData, isLoading: thongcaoLoading } = useQuery({
        queryKey: ['news', 'thongcao', 'home'],
        queryFn: async () => {
            const response = await apiClient<NewsApiResponse>({
                url: '/api/v1/sse/rest/news_daily',
                method: 'GET',
                queryParams: {
                    page: '1',
                    limit: '5',
                    sort_by: 'created_at',
                    sort_order: 'desc',
                    news_type: 'thong_cao',
                },
                requireAuth: false,
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });
    const thongcaoNews = thongcaoData?.items || [];

    // Fetch trong nuoc news
    const { data: trongnuocNewsData, isLoading: trongnuocLoading } = useQuery({
        queryKey: ['news', 'trongnuoc', 'home'],
        queryFn: async () => {
            const response = await apiClient<NewsApiResponse>({
                url: '/api/v1/sse/rest/news_daily',
                method: 'GET',
                queryParams: {
                    page: '1',
                    limit: '5',
                    sort_by: 'created_at',
                    sort_order: 'desc',
                    news_type: 'trong_nuoc',
                },
                requireAuth: false,
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });
    const trongnuocNews = trongnuocNewsData?.items || [];

    // Fetch doanh nghiep news
    const { data: doanhnghiepNewsData, isLoading: doanhnghiepLoading } = useQuery({
        queryKey: ['news', 'doanhnghiep', 'home'],
        queryFn: async () => {
            const response = await apiClient<NewsApiResponse>({
                url: '/api/v1/sse/rest/news_daily',
                method: 'GET',
                queryParams: {
                    page: '1',
                    limit: '5',
                    sort_by: 'created_at',
                    sort_order: 'desc',
                    news_type: 'doanh_nghiep',
                },
                requireAuth: false,
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });
    const doanhnghiepNews = doanhnghiepNewsData?.items || [];

    // Fetch quoc te news
    const { data: quocteNewsData, isLoading: quocteLoading } = useQuery({
        queryKey: ['news', 'quocte', 'home'],
        queryFn: async () => {
            const response = await apiClient<NewsApiResponse>({
                url: '/api/v1/sse/rest/news_daily',
                method: 'GET',
                queryParams: {
                    page: '1',
                    limit: '5',
                    sort_by: 'created_at',
                    sort_order: 'desc',
                    news_type: 'quoc_te',
                },
                requireAuth: false,
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });
    const quocteNews = quocteNewsData?.items || [];

    // Define the slides content for Desktop (with bg wrapper)
    const desktopSlides = [
        {
            id: 'quocte',
            component: (
                <NewsColumn
                    title="TÀI CHÍNH QUỐC TẾ"
                    href="/news/type/quoc_te"
                    loading={quocteLoading}
                    newsItems={quocteNews}
                />
            )
        },
        {
            id: 'trongnuoc',
            component: (
                <NewsColumn
                    title="VĨ MÔ TRONG NƯỚC"
                    href="/news/type/trong_nuoc"
                    loading={trongnuocLoading}
                    newsItems={trongnuocNews}
                />
            )
        },
        {
            id: 'doanhnghiep',
            component: (
                <NewsColumn
                    title="DOANH NGHIỆP NIÊM YẾT"
                    href="/news/type/doanh_nghiep"
                    loading={doanhnghiepLoading}
                    newsItems={doanhnghiepNews}
                />
            )
        },
        {
            id: 'thongcao',
            component: (
                <NewsColumn
                    title="THÔNG CÁO CHÍNH PHỦ"
                    href="/news/type/thong_cao"
                    loading={thongcaoLoading}
                    newsItems={thongcaoNews}
                />
            )
        }
    ];

    // Define the slides content for Mobile Carousel (content only, no bg)
    const mobileSlides = [
        {
            id: 'quocte',
            component: (
                <NewsColumnContent
                    title="TÀI CHÍNH QUỐC TẾ"
                    href="/news/type/quoc_te"
                    loading={quocteLoading}
                    newsItems={quocteNews}
                />
            )
        },
        {
            id: 'trongnuoc',
            component: (
                <NewsColumnContent
                    title="VĨ MÔ TRONG NƯỚC"
                    href="/news/type/trong_nuoc"
                    loading={trongnuocLoading}
                    newsItems={trongnuocNews}
                />
            )
        },
        {
            id: 'doanhnghiep',
            component: (
                <NewsColumnContent
                    title="DOANH NGHIỆP NIÊM YẾT"
                    href="/news/type/doanh_nghiep"
                    loading={doanhnghiepLoading}
                    newsItems={doanhnghiepNews}
                />
            )
        },
        {
            id: 'thongcao',
            component: (
                <NewsColumnContent
                    title="THÔNG CÁO CHÍNH PHỦ"
                    href="/news/type/thong_cao"
                    loading={thongcaoLoading}
                    newsItems={thongcaoNews}
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

            {/* News Stats Bar */}
            <NewsStatsBar
                totalNews={totalNews}
                thongcaoCount={thongcaoCount}
                trongnuocCount={trongnuocCount}
                doanhnghiepCount={doanhnghiepCount}
                quocteCount={quocteCount}
                isLoading={statsLoading}
            />

            {/* Content Container */}
            <Box>
                {/* 1. Desktop View (4 columns) - lg and up */}
                <Box
                    sx={{
                        display: { xs: 'none', md: 'none', lg: 'grid' },
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: { lg: 1.5 },
                    }}
                >
                    {desktopSlides.map((slide) => (
                        <Box key={slide.id}>
                            {slide.component}
                        </Box>
                    ))}
                </Box>

                {/* 2. Tablet View (2 carousels side by side) - md only */}
                <Box
                    sx={{
                        display: { xs: 'none', md: 'grid', lg: 'none' },
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: { md: 2 },
                    }}
                >
                    {/* Left Carousel - First 2 slides */}
                    <Box
                        sx={{
                            backgroundColor: 'background.paper',
                            borderRadius: `${borderRadius.lg}px`,
                            p: spacing.xs,
                        }}
                    >
                        <Carousel
                            slides={[mobileSlides[0], mobileSlides[1]]}
                            minHeight="420px"
                        />
                    </Box>

                    {/* Right Carousel - Last 2 slides */}
                    <Box
                        sx={{
                            backgroundColor: 'background.paper',
                            borderRadius: `${borderRadius.lg}px`,
                            p: spacing.xs,
                        }}
                    >
                        <Carousel
                            slides={[mobileSlides[2], mobileSlides[3]]}
                            minHeight="420px"
                        />
                    </Box>
                </Box>

                {/* 3. Mobile View (Single Carousel with 4 slides) - xs to sm */}
                <Box
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        backgroundColor: 'background.paper',
                        borderRadius: `${borderRadius.lg}px`,
                        p: spacing.xs,
                    }}
                >
                    <Carousel slides={mobileSlides} minHeight="420px" />
                </Box>
            </Box>
        </Box>
    );
}
