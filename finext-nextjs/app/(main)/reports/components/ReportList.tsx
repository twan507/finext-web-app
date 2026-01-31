// finext-nextjs/app/(main)/reports/components/ReportList.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { ReportApiResponse, NewsReport, REPORT_PAGE_SIZE, REPORT_SORT_FIELD, REPORT_SORT_ORDER } from '../types';
import ReportCard from './ReportCard';
import { spacing, borderRadius, getResponsiveFontSize, fontWeight } from 'theme/tokens';

interface ReportListProps {
    /** Lọc theo category */
    category?: string;
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
                Bản tin sẽ được cập nhật liên tục. Vui lòng quay lại sau.
            </Typography>
        </Box>
    );
}

export default function ReportList({
    category,
    title,
    description,
    pageSize = REPORT_PAGE_SIZE,
}: ReportListProps) {
    const [reports, setReports] = useState<NewsReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchReports = useCallback(async (pageNum: number) => {
        setLoading(true);
        setError(null);

        try {
            // Build query params
            const queryParams: Record<string, string> = {
                page: String(pageNum),
                limit: String(pageSize),
                sort_by: REPORT_SORT_FIELD,
                sort_order: REPORT_SORT_ORDER,
            };

            // Thêm filter category nếu có
            if (category && category !== 'all') {
                queryParams.category = category;
            }

            const response = await apiClient<ReportApiResponse>({
                url: '/api/v1/sse/rest/news_report',
                method: 'GET',
                queryParams,
                requireAuth: false,
            });

            if (response.data) {
                const items = response.data.items || [];
                setReports(items);
                setTotalPages(response.data.pagination?.total_pages || 1);
                setTotal(response.data.pagination?.total || 0);
            }
        } catch (err: any) {
            console.error('[ReportList] Fetch error:', err);
            setError(err.message || 'Không thể tải bản tin. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    }, [pageSize, category]);

    // Reset page về 1 khi category thay đổi
    useEffect(() => {
        setPage(1);
    }, [category]);

    useEffect(() => {
        fetchReports(page);
    }, [fetchReports, page]);

    const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
        setPage(value);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
                                key={report.report_id}
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
