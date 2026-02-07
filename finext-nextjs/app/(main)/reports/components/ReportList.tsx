// finext-nextjs/app/(main)/reports/components/ReportList.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
    Box,
    Pagination,
    Stack,
    Typography,
    Alert,
    Skeleton,
} from '@mui/material';
import { Article } from '@mui/icons-material';

import { apiClient } from 'services/apiClient';
import { ReportApiResponse, NewsReport, REPORT_PAGE_SIZE, REPORT_SORT_FIELD, REPORT_SORT_ORDER, ReportType } from '../types';
import ReportCard from './ReportCard';
import { spacing, borderRadius, getResponsiveFontSize, fontWeight } from 'theme/tokens';

interface ReportListProps {
    /** Lọc theo type (daily, weekly, monthly) */
    type?: ReportType;
    /** Lọc theo categories (multiple) */
    categories?: string[];
    /** Tiêu đề section */
    title?: string;
    /** Mô tả section */
    description?: string;
    /** Số bản tin mỗi trang */
    pageSize?: number;
}

/** Loading skeleton cho ReportCard dạng list */
function ReportCardSkeleton() {
    return (
        <Box
            sx={{
                display: 'flex',
                gap: spacing.xs,
                py: spacing.xs,
                borderBottom: '1px solid',
                borderColor: 'divider',
            }}
        >
            <Box sx={{ width: 100 }}>
                <Skeleton variant="text" width={80} height={20} />
                <Skeleton variant="text" width={50} height={16} />
            </Box>
            <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="90%" height={24} />
                <Skeleton variant="text" width="60%" height={18} />
            </Box>
        </Box>
    );
}

/** Empty state khi không có bản tin */
function EmptyState() {
    return (
        <Box
            sx={{
                py: spacing.xxl,
                textAlign: 'center',
            }}
        >
            <Article
                sx={{
                    fontSize: 64,
                    color: 'text.disabled',
                    mb: spacing.xs,
                }}
            />
            <Typography
                variant="h6"
                color="text.secondary"
                sx={{ mb: spacing.xs }}
            >
                Chưa có bản tin
            </Typography>
            <Typography variant="body2" color="text.disabled">
                Báo cáo sẽ được cập nhật liên tục. Vui lòng quay lại sau.
            </Typography>
        </Box>
    );
}

export default function ReportList({
    type,
    categories,
    title,
    description,
    pageSize = REPORT_PAGE_SIZE,
}: ReportListProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Get page from URL
    const page = Number(searchParams.get('page')) || 1;

    // React Query Key
    const queryKey = ['reports', 'list', {
        page,
        limit: pageSize,
        type,
        categories: categories?.join(','),
        sort_by: REPORT_SORT_FIELD,
        sort_order: REPORT_SORT_ORDER
    }];

    // Use Query
    const { data: reportsData, isLoading, error: queryError } = useQuery({
        queryKey,
        queryFn: async () => {
            // Build query params
            const queryParams: Record<string, string> = {
                page: String(page),
                limit: String(pageSize),
                sort_by: REPORT_SORT_FIELD,
                sort_order: REPORT_SORT_ORDER,
                exclude_fields: 'report_html,report_markdown',
            };

            // Thêm filter type nếu có (daily, weekly, monthly)
            if (type) {
                queryParams.report_type = type;
            }

            // Gửi categories (backend hỗ trợ multiple với comma-separated)
            if (categories && categories.length > 0) {
                queryParams.categories = categories.join(',');
            }

            const response = await apiClient<ReportApiResponse>({
                url: '/api/v1/sse/rest/news_report',
                method: 'GET',
                queryParams,
                requireAuth: false,
            });

            return response.data;
        },
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
    });

    // Reports from API
    const reports = reportsData?.items || [];

    const loading = isLoading;
    const error = queryError ? (queryError as Error).message : null;

    // Pagination from API
    const totalPages = reportsData?.pagination?.total_pages || 1;
    const total = reportsData?.pagination?.total || 0;

    const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
        // Update URL
        const params = new URLSearchParams(searchParams.toString());
        if (value === 1) {
            params.delete('page');
        } else {
            params.set('page', value.toString());
        }

        router.push(`${pathname}?${params.toString()}`, { scroll: true });
    };

    return (
        <Box>
            {/* Header */}
            {(title || description) && (
                <Box sx={{ mb: spacing.xs }}>
                    {title && (
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: fontWeight.bold,
                                fontSize: getResponsiveFontSize('h4'),
                                mb: spacing.xs,
                            }}
                        >
                            {title}
                        </Typography>
                    )}
                    {description && (
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            sx={{ fontSize: getResponsiveFontSize('md') }}
                        >
                            {description}
                        </Typography>
                    )}
                    {!loading && total > 0 && (
                        <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ mt: spacing.xs, display: 'block' }}
                        >
                            Tổng cộng {total} bản tin
                        </Typography>
                    )}
                </Box>
            )}

            {/* Error State */}
            {error && (
                <Alert
                    severity="error"
                    sx={{
                        mb: spacing.lg,
                        borderRadius: `${borderRadius.md}px`,
                    }}
                >
                    {error}
                </Alert>
            )}

            {/* Loading State */}
            {loading && (
                <Box>
                    {Array.from({ length: pageSize }).map((_, index) => (
                        <ReportCardSkeleton key={index} />
                    ))}
                </Box>
            )}

            {/* Empty State */}
            {!loading && !error && reports.length === 0 && <EmptyState />}

            {/* Report List */}
            {!loading && reports.length > 0 && (
                <>
                    <Box>
                        {reports.map((report) => (
                            <ReportCard
                                key={report.report_slug}
                                report={report}
                            />
                        ))}
                    </Box>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Stack
                            direction="row"
                            justifyContent="center"
                            sx={{ mt: spacing.xs }}
                        >
                            <Pagination
                                count={totalPages}
                                page={page}
                                onChange={handlePageChange}
                                color="primary"
                                size="large"
                                showFirstButton
                                showLastButton
                                sx={{
                                    '& .MuiPaginationItem-root': {
                                        borderRadius: `${borderRadius.md}px`,
                                    },
                                }}
                            />
                        </Stack>
                    )}
                </>
            )}
        </Box>
    );
}
