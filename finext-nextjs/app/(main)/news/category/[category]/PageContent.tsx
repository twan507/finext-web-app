// finext-nextjs/app/(main)/news/category/[category]/PageContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

import { NewsBreadcrumb, NewsList, SourceTabs, CategoryInfo } from '../../components';
import { spacing } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

interface PageContentProps {
    category: string;
}

interface CategoriesApiResponse {
    items: CategoryInfo[];
    total: number;
}

export default function PageContent({ category }: PageContentProps) {
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [categoryName, setCategoryName] = useState<string>(decodeURIComponent(category));

    // Fetch categories từ API riêng
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await apiClient<CategoriesApiResponse>({
                    url: '/api/v1/sse/rest/news_categories',
                    method: 'GET',
                    requireAuth: false,
                });

                if (response.data?.items) {
                    setCategories(response.data.items);
                    // Tìm tên category từ danh sách
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
                loading={categoriesLoading}
                items={categoriesLoading ? [] : [{ label: categoryName }]}
            />

            {/* Header */}
            <Box sx={{ mb: spacing.xs }}>
                <Typography variant="h1">
                    Tin tức thị trường
                </Typography>
                <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                >
                    Cập nhật tin tức tài chính, chứng khoán và các sự kiện nổi bật từ nhiều nguồn uy tín.
                </Typography>
            </Box>

            {/* Category Tabs */}
            <SourceTabs
                categories={categories}
                selectedCategory={category}
                onCategoryChange={() => { }}
                loading={categoriesLoading}
                useNavigation
            />

            {/* News List - Filtered by category */}
            <NewsList category={category} />
        </Box>
    );
}
