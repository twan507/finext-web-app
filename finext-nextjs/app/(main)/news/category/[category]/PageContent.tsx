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
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
    const categoriesLoadedRef = useRef(false);

    const currentSourceInfo = getSourceInfo(source);
    const sourceName = currentSourceInfo?.source_name || source;
    const showCategoryChips = source === SOURCE_WITH_CATEGORIES;

    // Handle category selection
    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category);
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
            setSelectedCategory(undefined);
        } else {
            // Navigate to different source
            router.push(`/news/category/${newSource}`);
        }
    };

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb
                items={[
                    { label: sourceName, href: `/news/category/${source}` },
                    ...(selectedCategory && showCategoryChips
                        ? [{ label: categories.find(c => c.category === selectedCategory)?.category_name || '' }]
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
                    selectedCategory={selectedCategory}
                    onCategoryChange={handleCategoryChange}
                />
            )}

            {/* News List - Filtered by source and optionally category */}
            <NewsList
                source={source}
                category={showCategoryChips ? selectedCategory : undefined}
                onCategoriesLoaded={showCategoryChips ? handleCategoriesLoaded : undefined}
            />
        </Box>
    );
}
