// finext-nextjs/app/(main)/news/category/[category]/PageContent.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';

import { NewsBreadcrumb, NewsList } from '../../components';
import CategoryChips, { CategoryInfo } from '../../components/CategoryChips';
import { spacing, fontWeight } from 'theme/tokens';
import { NewsSource, NEWS_SOURCES_INFO, getSourceInfo } from '../../types';

interface PageContentProps {
    source: NewsSource;
}

// Only show level 2 category chips for this source
const SOURCE_WITH_CATEGORIES = 'trong_nuoc';

export default function PageContent({ source }: PageContentProps) {
    const router = useRouter();
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const categoriesLoadedRef = useRef(false);

    const currentSourceInfo = getSourceInfo(source);
    const sourceName = currentSourceInfo?.source_name || source;
    const showCategoryChips = source === SOURCE_WITH_CATEGORIES;

    // Handle category selection
    const handleCategoriesChange = (cats: string[]) => {
        setSelectedCategories(cats);
    };

    // Handle categories loaded - only set on first load to preserve all chips when filtering
    const handleCategoriesLoaded = useCallback((cats: CategoryInfo[]) => {
        if (!categoriesLoadedRef.current && cats.length > 0) {
            setCategories(cats);
            categoriesLoadedRef.current = true;
        }
    }, []);

    // Handle source tab click
    const handleSourceClick = (newSource: NewsSource | 'all') => {
        if (newSource === 'all') {
            router.push('/news');
        } else if (newSource === source) {
            // If clicking the same source, just reset the category filter
            setSelectedCategories([]);
        } else {
            // Navigate to different source
            router.push(`/news/category/${newSource}`);
        }
    };

    // Generate breadcrumb label for selected categories
    const getCategoryBreadcrumbLabel = () => {
        if (selectedCategories.length === 0) return '';
        if (selectedCategories.length === 1) {
            return categories.find(c => c.category === selectedCategories[0])?.category_name || '';
        }
        return `${selectedCategories.length} chủ đề`;
    };

    // Check if filter is actually applied (not all chips selected)
    const isFilterApplied = selectedCategories.length > 0 && selectedCategories.length < categories.length;

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb
                items={[
                    { label: sourceName, href: `/news/category/${source}` },
                    ...(isFilterApplied && showCategoryChips
                        ? [{ label: getCategoryBreadcrumbLabel() }]
                        : [])
                ]}
            />

            {/* Header */}
            <Box sx={{ mb: spacing.xs }}>
                <Typography variant="h1">
                    {sourceName}
                </Typography>
            </Box>

            {/* Source Tabs - First Row */}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    mb: spacing.xs,
                }}
            >
                <Chip
                    label="Tất cả"
                    onClick={() => handleSourceClick('all')}
                    color="default"
                    variant="filled"
                    sx={{ fontWeight: fontWeight.medium, border: 'none' }}
                />
                {NEWS_SOURCES_INFO.map((sourceInfo) => (
                    <Chip
                        key={sourceInfo.source}
                        label={sourceInfo.source_name}
                        onClick={() => handleSourceClick(sourceInfo.source)}
                        color={source === sourceInfo.source ? 'primary' : 'default'}
                        variant="filled"
                        sx={{ fontWeight: fontWeight.semibold, border: 'none' }}
                    />
                ))}
            </Box>

            {/* Category Chips - Second Row (only show for trong_nuoc source) */}
            {showCategoryChips && categories.length > 0 && (
                <CategoryChips
                    categories={categories}
                    selectedCategories={selectedCategories}
                    onCategoriesChange={handleCategoriesChange}
                />
            )}

            {/* News List - Filtered by source and optionally category */}
            {/* Khi chọn tất cả categories = không filter (hiện hết) */}
            <NewsList
                source={source}
                categories={
                    showCategoryChips &&
                        selectedCategories.length > 0 &&
                        selectedCategories.length < categories.length
                        ? selectedCategories
                        : undefined
                }
                onCategoriesLoaded={showCategoryChips ? handleCategoriesLoaded : undefined}
            />
        </Box>
    );
}
