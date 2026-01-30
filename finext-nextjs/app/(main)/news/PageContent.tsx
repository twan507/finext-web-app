// finext-nextjs/app/(main)/news/PageContent.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography } from '@mui/material';

import { NewsBreadcrumb, NewsList, SourceTabs, CategoryInfo } from './components';
import { spacing } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

interface CategoriesApiResponse {
    items: CategoryInfo[];
    total: number;
}

export default function NewsContent() {
    // Use Query for categories
    const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
        queryKey: ['news', 'categories'],
        queryFn: async () => {
            const response = await apiClient<CategoriesApiResponse>({
                url: '/api/v1/sse/rest/news_categories',
                method: 'GET',
                requireAuth: false,
            });
            return response.data;
        },
        staleTime: 10 * 60 * 1000 // Cache for 10 minutes
    });

    const categories = categoriesData?.items || [];

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb items={[]} />

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
                selectedCategory="all"
                onCategoryChange={() => { }}
                loading={categoriesLoading}
                useNavigation
            />

            {/* News List */}
            <NewsList />
        </Box>
    );
}

