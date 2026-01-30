// finext-nextjs/app/(main)/reports/PageContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

import { ReportList, TypeTabs } from './components';
import NewsBreadcrumb from '../news/components/NewsBreadcrumb';
import { spacing } from 'theme/tokens';
import { apiClient } from 'services/apiClient';
import { ReportCategoryInfo } from './types';

interface CategoriesApiResponse {
    items: ReportCategoryInfo[];
    total: number;
}

export default function ReportsContent() {
    const [categories, setCategories] = useState<ReportCategoryInfo[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    // Fetch categories từ API
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await apiClient<CategoriesApiResponse>({
                    url: '/api/v1/sse/rest/news_report_categories',
                    method: 'GET',
                    requireAuth: false,
                });

                if (response.data?.items) {
                    setCategories(response.data.items);
                }
            } catch (error) {
                console.error('[ReportsContent] Failed to fetch categories:', error);
            } finally {
                setCategoriesLoading(false);
            }
        };

        fetchCategories();
    }, []);

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb sectionLabel="Bản tin" sectionHref="/reports" items={[]} />

            {/* Header */}
            <Box sx={{ mb: spacing.xs }}>
                <Typography variant="h1">
                    Bản tin thị trường
                </Typography>
                <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                >
                    Tổng hợp báo cáo phân tích, bản tin doanh nghiệp và thị trường hàng ngày.
                </Typography>
            </Box>

            {/* Category Tabs */}
            <TypeTabs
                categories={categories}
                selectedCategory="all"
                onCategoryChange={() => { }}
                loading={categoriesLoading}
                useNavigation
            />

            {/* Report List */}
            <ReportList />
        </Box>
    );
}
