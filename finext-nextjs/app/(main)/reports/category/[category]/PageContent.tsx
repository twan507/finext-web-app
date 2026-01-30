// finext-nextjs/app/(main)/reports/category/[category]/PageContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

import { ReportList, TypeTabs } from '../../components';
import NewsBreadcrumb from '../../../news/components/NewsBreadcrumb';
import { spacing } from 'theme/tokens';
import { apiClient } from 'services/apiClient';
import { ReportCategoryInfo } from '../../types';

interface PageContentProps {
    category: string;
}

interface CategoriesApiResponse {
    items: ReportCategoryInfo[];
    total: number;
}

export default function PageContent({ category }: PageContentProps) {
    const [categories, setCategories] = useState<ReportCategoryInfo[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [categoryName, setCategoryName] = useState<string>(category);

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
                    // Cập nhật tên category nếu tìm thấy
                    const found = response.data.items.find((c) => c.category === category);
                    if (found) {
                        setCategoryName(found.category_name);
                    }
                }
            } catch (error) {
                console.error('[PageContent] Failed to fetch categories:', error);
            } finally {
                setCategoriesLoading(false);
            }
        };

        fetchCategories();
    }, [category]);

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb - đợi load xong mới hiển thị category_name */}
            <NewsBreadcrumb
                sectionLabel="Bản tin"
                sectionHref="/reports"
                loading={categoriesLoading}
                items={categoriesLoading ? [] : [{ label: categoryName }]}
            />

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
                selectedCategory={category}
                onCategoryChange={() => { }}
                loading={categoriesLoading}
                useNavigation
            />

            {/* Report List - Filtered by category */}
            <ReportList category={category} />
        </Box>
    );
}
