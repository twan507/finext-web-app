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
import AccessTimeIcon from '@mui/icons-material/AccessTime';
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

/** Format created_at to "13:05 07/02" */
function formatShortDate(isoString?: string): string {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        return `${h}:${m} ${d}/${mo}`;
    } catch {
        return isoString;
    }
}

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
                mb: { xs: spacing.sm, md: spacing.xs },
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

    return (
        <Box
            sx={{
                '&:last-of-type .news-divider': {
                    display: 'none',
                },
                '&:last-of-type .news-card-content': {
                    mb: -0.5,
                },
            }}
        >
            <Box
                className="news-card-content"
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
                            fontSize: getResponsiveFontSize('md'),
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            color: 'text.primary',
                            transition: transitions.hover,
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
                        fontSize: getResponsiveFontSize('sm'),
                        lineHeight: 1.5,
                        color: 'text.secondary',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        mt: 0.5,
                    }}
                >
                    {article.sapo}
                </Typography>

                {/* Source + time */}
                <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        mt: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                    }}
                >
                    {article.created_at && (
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                            <AccessTimeIcon sx={{ fontSize: '0.85em' }} />
                            {formatShortDate(article.created_at)}
                        </Box>
                    )}
                    {article.created_at && article.source && ' | '}
                    {article.source && article.source}
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
            <Box sx={{ py: spacing.xs }}>
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
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', mb: 3 }}>
            {/* Column Header */}
            <Box sx={{ mb: 1, borderBottom: '2px solid', borderColor: 'text.secondary', pb: 0.5 }}>
                <Link href={href} style={{ textDecoration: 'none' }}>
                    <Typography
                        className="column-title"
                        sx={{
                            fontSize: getResponsiveFontSize('lg'),
                            fontWeight: 'bold',
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            transition: transitions.hover,
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
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
                        {Array.from({ length: 4 }).map((_, index) => (
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
// NEWSPAPER LAYOUT COMPONENTS
// ============================================================================

// Section header with thick bottom rule (newspaper style)
function NewspaperSectionHeader({ title, href }: { title: string; href: string }) {
    return (
        <Box sx={{ borderBottom: '2px solid', borderColor: 'text.secondary', pb: 0.5, mb: 1.5 }}>
            <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.bold,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'text.secondary',
                        transition: transitions.hover,
                        '&:hover': { color: 'text.primary' },
                    }}
                >
                    {title}
                </Typography>
            </Link>
        </Box>
    );
}

// Spotlight card for the featured article in wide (2/3) columns
function SpotlightNewsCard({ article }: { article: NewsArticle }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Link href={`/news/${article.article_slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography
                    sx={{
                        fontWeight: fontWeight.bold,
                        fontSize: getResponsiveFontSize('md'),
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        color: 'text.primary',
                        mb: 1,
                        transition: transitions.hover,
                        '&:hover': { textDecoration: 'underline' },
                    }}
                >
                    {article.title}
                </Typography>
            </Link>
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('sm'),
                    lineHeight: 1.6,
                    color: 'text.secondary',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {article.sapo}
            </Typography>
            <Typography
                variant="caption"
                color="text.disabled"
                sx={{ fontSize: getResponsiveFontSize('xs'), mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
                {article.created_at && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        <AccessTimeIcon sx={{ fontSize: '0.85em' }} />
                        {formatShortDate(article.created_at)}
                    </Box>
                )}
                {article.created_at && article.source && ' | '}
                {article.source && article.source}
            </Typography>
        </Box>
    );
}

// Compact news item for the list side of wide columns (title only)
function CompactNewsItem({ article }: { article: NewsArticle }) {
    return (
        <Box
            sx={{
                '&:last-of-type .compact-divider': { display: 'none' },
            }}
        >
            <Box sx={{ py: 0.75 }}>
                <Link href={`/news/${article.article_slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            fontWeight: fontWeight.medium,
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            color: 'text.primary',
                            transition: transitions.hover,
                            '&:hover': { textDecoration: 'underline' },
                        }}
                    >
                        {article.title}
                    </Typography>
                </Link>
                <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ fontSize: getResponsiveFontSize('xs'), mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                    {article.created_at && (
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                            <AccessTimeIcon sx={{ fontSize: '0.85em' }} />
                            {formatShortDate(article.created_at)}
                        </Box>
                    )}
                    {article.created_at && article.source && ' | '}
                    {article.source && article.source}
                </Typography>
            </Box>
            <Divider className="compact-divider" sx={{ borderColor: 'divider' }} />
        </Box>
    );
}

// Narrow column (1/3) — title + source
interface NewspaperNarrowColumnProps {
    title: string;
    href: string;
    loading: boolean;
    newsItems: NewsArticle[];
    position?: 'left' | 'right';
}
function NewspaperNarrowColumn({ title, href, loading, newsItems, position }: NewspaperNarrowColumnProps) {
    return (
        <Box sx={{
            py: { md: 1.5, lg: spacing.xs },
            pl: position === 'left' ? 0 : { md: 1.5, lg: spacing.xs },
            pr: position === 'right' ? 0 : { md: 1.5, lg: spacing.xs },
            height: '100%',
            backgroundColor: 'background.default',
            overflow: 'hidden',
        }}>
            <NewspaperSectionHeader title={title} href={href} />
            {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                    <Box key={i} sx={{ py: 0.75 }}>
                        <Skeleton variant="text" width="90%" height={18} />
                        <Skeleton variant="text" width="40%" height={14} sx={{ mt: 0.25 }} />
                    </Box>
                ))
            ) : (
                newsItems?.map((article) => (
                    <Box
                        key={article.article_slug}
                        sx={{ '&:last-of-type .narrow-divider': { display: 'none' } }}
                    >
                        <Box sx={{ py: 0.75 }}>
                            <Link href={`/news/${article.article_slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography
                                    sx={{
                                        fontWeight: fontWeight.semibold,
                                        fontSize: getResponsiveFontSize('sm'),
                                        lineHeight: 1.4,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        color: 'text.primary',
                                        transition: transitions.hover,
                                        '&:hover': { textDecoration: 'underline' },
                                    }}
                                >
                                    {article.title}
                                </Typography>
                            </Link>
                            <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{ fontSize: getResponsiveFontSize('sm'), mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 }}
                            >
                                {article.created_at && (
                                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                                        <AccessTimeIcon sx={{ fontSize: '0.85em' }} />
                                        {formatShortDate(article.created_at)}
                                    </Box>
                                )}
                                {article.created_at && article.source && ' | '}
                                {article.source && article.source}
                            </Typography>
                        </Box>
                        <Divider className="narrow-divider" sx={{ borderColor: 'divider' }} />
                    </Box>
                ))
            )}
        </Box>
    );
}

// Wide column (2/3) — title + sapo + source
interface NewspaperWideColumnProps {
    title: string;
    href: string;
    loading: boolean;
    newsItems: NewsArticle[];
    position?: 'left' | 'right';
}
function NewspaperWideColumn({ title, href, loading, newsItems, position }: NewspaperWideColumnProps) {
    return (
        <Box sx={{
            py: { md: 1.5, lg: spacing.xs },
            pl: position === 'left' ? 0 : { md: 1.5, lg: spacing.xs },
            pr: position === 'right' ? 0 : { md: 1.5, lg: spacing.xs },
            height: '100%',
            backgroundColor: 'background.default',
            overflow: 'hidden',
        }}>
            <NewspaperSectionHeader title={title} href={href} />
            {loading ? (
                Array.from({ length: 4 }).map((_, i) => <NewsCardSkeleton key={i} />)
            ) : (
                newsItems?.map((article) => (
                    <Box
                        key={article.article_slug}
                        sx={{ '&:last-of-type .wide-divider': { display: 'none' } }}
                    >
                        <Box sx={{ py: 0.75 }}>
                            <Link href={`/news/${article.article_slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography
                                    sx={{
                                        fontWeight: fontWeight.semibold,
                                        fontSize: getResponsiveFontSize('md'),
                                        lineHeight: 1.4,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 1,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        color: 'text.primary',
                                        transition: transitions.hover,
                                        mb: 0.5,
                                        '&:hover': { textDecoration: 'underline' },
                                    }}
                                >
                                    {article.title}
                                </Typography>
                            </Link>
                            <Typography
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
                                {article.sapo}
                            </Typography>
                            <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{ fontSize: getResponsiveFontSize('sm'), mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
                            >
                                {article.created_at && (
                                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                                        <AccessTimeIcon sx={{ fontSize: '0.85em' }} />
                                        {formatShortDate(article.created_at)}
                                    </Box>
                                )}
                                {article.created_at && article.source && ' | '}
                                {article.source && article.source}
                            </Typography>
                        </Box>
                        <Divider className="wide-divider" sx={{ borderColor: 'divider' }} />
                    </Box>
                ))
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
    // Calculate total news by summing individual categories (excluding news_report)
    const totalNews = thongcaoCount + trongnuocCount + doanhnghiepCount + quocteCount;

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
                    limit: '6',
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
                    limit: '6',
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

    // Fetch latest reports for "Báo cáo tổng hợp" section
    const { data: latestReportsData, isLoading: reportsLoading } = useQuery({
        queryKey: ['reports', 'latest', 'home'],
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
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });
    const latestReports = latestReportsData?.items || [];

    // Define the slides content for Mobile Carousel (content only, no bg)
    const mobileSlides = [
        {
            id: 'quocte',
            component: (
                <NewsColumnContent
                    title="TÀI CHÍNH QUỐC TẾ"
                    href="/news/type/quoc_te"
                    loading={quocteLoading}
                    newsItems={quocteNews.slice(0, 5)}
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
                    newsItems={thongcaoNews.slice(0, 5)}
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
                {/* ===== Desktop & Tablet: Asymmetrical Newspaper Grid (md+) ===== */}
                <Box
                    sx={{
                        display: { xs: 'none', md: 'grid' },
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '1px',
                        backgroundColor: 'divider',
                    }}
                >
                    {/* Row 1, Col 1 (1/3): Tài chính quốc tế */}
                    <Box sx={{ gridColumn: 'span 1' }}>
                        <NewspaperNarrowColumn
                            title="Tài chính quốc tế"
                            href="/news/type/quoc_te"
                            loading={quocteLoading}
                            newsItems={quocteNews}
                            position="left"
                        />
                    </Box>

                    {/* Row 1, Col 2 (2/3): Vĩ mô trong nước */}
                    <Box sx={{ gridColumn: 'span 2' }}>
                        <NewspaperWideColumn
                            title="Vĩ mô trong nước"
                            href="/news/type/trong_nuoc"
                            loading={trongnuocLoading}
                            newsItems={trongnuocNews.slice(0, 4)}
                            position="right"
                        />
                    </Box>

                    {/* Row 2, Col 1 (2/3): Doanh nghiệp niêm yết */}
                    <Box sx={{ gridColumn: 'span 2' }}>
                        <NewspaperWideColumn
                            title="Doanh nghiệp niêm yết"
                            href="/news/type/doanh_nghiep"
                            loading={doanhnghiepLoading}
                            newsItems={doanhnghiepNews.slice(0, 4)}
                            position="left"
                        />
                    </Box>

                    {/* Row 2, Col 2 (1/3): Thông cáo chính phủ */}
                    <Box sx={{ gridColumn: 'span 1' }}>
                        <NewspaperNarrowColumn
                            title="Thông cáo chính phủ"
                            href="/news/type/thong_cao"
                            loading={thongcaoLoading}
                            newsItems={thongcaoNews}
                            position="right"
                        />
                    </Box>
                </Box>

                {/* ===== Mobile: Carousel (xs to sm) ===== */}
                <Box
                    sx={{
                        display: { xs: 'block', md: 'none' },
                    }}
                >
                    <Carousel slides={mobileSlides} minHeight="420px" />
                </Box>
            </Box>

            {/* Section 3.5: Báo cáo tổng hợp */}
            <Box
                component={Link}
                href="/reports"
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                    color: 'inherit',
                    mt: spacing.xs,
                    mb: 2,
                }}
            >
                <Typography className="sub-section-title" sx={{ fontSize: getResponsiveFontSize('h4'), fontWeight: fontWeight.bold }}>
                    Báo cáo tổng hợp
                </Typography>
                <ChevronRightIcon sx={{ fontSize: getResponsiveFontSize('h4').md, color: 'text.secondary' }} />
            </Box>

            <Box>
                {reportsLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <Box
                            key={index}
                            sx={{
                                display: 'flex',
                                gap: { xs: spacing.xs, md: spacing.sm },
                                py: spacing.xxs,
                                borderBottom: index < 2 ? '1px solid' : 'none',
                                borderColor: 'divider',
                            }}
                        >
                            <Box sx={{ width: { xs: 80, md: 100 } }}>
                                <Skeleton variant="text" width={80} height={20} />
                                <Skeleton variant="text" width={50} height={16} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Skeleton variant="text" width="90%" height={24} />
                                <Skeleton variant="text" width="60%" height={18} />
                            </Box>
                        </Box>
                    ))
                ) : latestReports.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: spacing.sm, textAlign: 'center' }}
                    >
                        Chưa có báo cáo nào.
                    </Typography>
                ) : (
                    latestReports.map((report, index) => {
                        const reportDate = (() => {
                            try {
                                const d = new Date(report.created_at);
                                return {
                                    date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                                    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                                };
                            } catch {
                                return { date: report.created_at, time: '' };
                            }
                        })();

                        return (
                            <Box
                                key={report.report_slug}
                                component={Link}
                                href={`/reports/${report.report_slug}`}
                                sx={{
                                    display: 'flex',
                                    gap: { xs: spacing.xs, md: spacing.sm },
                                    py: spacing.xxs,
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    borderBottom: index < latestReports.length - 1 ? '1px solid' : 'none',
                                    borderColor: 'divider',
                                    transition: transitions.colors,
                                    '&:hover': {
                                        '& .report-title': {
                                            textDecoration: 'underline',
                                        },
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
                                        {reportDate.date}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.disabled"
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                        }}
                                    >
                                        {reportDate.time}
                                    </Typography>
                                </Box>

                                {/* Cột phải: Tiêu đề + Sapo */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        className="report-title"
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
                                        }}
                                    >
                                        {report.title || 'Báo cáo'}
                                    </Typography>

                                    {(report.sapo || report.category_name) && (
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
                                            {report.category_name ? `(${report.category_name}) - ` : ''}{report.sapo || report.category_name}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Box>
        </Box>
    );
}
