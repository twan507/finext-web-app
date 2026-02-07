// finext-nextjs/app/(main)/news/type/[type]/PageContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';

import { NewsBreadcrumb, NewsList } from '../../components';
import CategoryChips, { CategoryInfo } from '../../components/CategoryChips';
import { spacing, fontWeight } from 'theme/tokens';
import { NewsType, NEWS_TYPES_INFO, getTypeInfo } from '../../types';
import { apiClient } from 'services/apiClient';

interface PageContentProps {
    type: NewsType;
}

interface CategoriesApiResponse {
    items: CategoryInfo[];
    total: number;
}

export default function PageContent({ type }: PageContentProps) {
    const router = useRouter();
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    const currentTypeInfo = getTypeInfo(type);
    const typeName = currentTypeInfo?.type_name || type;

    // Fetch categories từ API theo news_type
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await apiClient<CategoriesApiResponse>({
                    url: '/api/v1/sse/rest/news_categories',
                    method: 'GET',
                    queryParams: {
                        news_type: type,
                    },
                    requireAuth: false,
                });

                if (response.data?.items && response.data.items.length > 0) {
                    setCategories(response.data.items);
                } else {
                    setCategories([]);
                }
            } catch (error) {
                console.error('[PageContent] Failed to fetch categories:', error);
                setCategories([]);
            } finally {
                setCategoriesLoading(false);
            }
        };

        // Reset categories when type changes
        setCategories([]);
        setSelectedCategories([]);
        setCategoriesLoading(true);
        fetchCategories();
    }, [type]);

    // Handle category selection
    const handleCategoriesChange = (cats: string[]) => {
        setSelectedCategories(cats);
    };

    // Handle type tab click
    const handleTypeClick = (newType: NewsType | 'all') => {
        if (newType === 'all') {
            router.push('/news');
        } else if (newType === type) {
            // If clicking the same type, just reset the category filter
            setSelectedCategories([]);
        } else {
            // Navigate to different type
            router.push(`/news/type/${newType}`);
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
    // Chỉ hiển thị Category Chips (lv2) cho tin tức "Vĩ mô trong nước" (trong_nuoc)
    const showCategoryChips = categories.length > 0 && type === 'trong_nuoc';

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb
                items={[
                    { label: typeName, href: `/news/type/${type}` },
                    ...(isFilterApplied && showCategoryChips
                        ? [{ label: getCategoryBreadcrumbLabel() }]
                        : [])
                ]}
            />

            {/* Header */}
            <Box sx={{ mb: spacing.xs }}>
                <Typography variant="h1">
                    {typeName}
                </Typography>
                <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                >
                    Cập nhật tin tức tài chính, chứng khoán và các sự kiện nổi bật từ nhiều nguồn uy tín.
                </Typography>
            </Box>

            {/* Type Tabs - First Row */}
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
                    onClick={() => handleTypeClick('all')}
                    color="default"
                    variant="filled"
                    sx={{ fontWeight: fontWeight.medium, border: 'none' }}
                />
                {NEWS_TYPES_INFO.map((typeInfo) => {
                    const isSelected = type === typeInfo.type;
                    return (
                        <Chip
                            key={typeInfo.type}
                            label={typeInfo.type_name}
                            onClick={() => handleTypeClick(typeInfo.type)}
                            color="default"
                            variant="filled"
                            sx={{
                                fontWeight: fontWeight.semibold,
                                border: 'none',
                                ...(isSelected && {
                                    backgroundColor: 'primary.main',
                                    color: '#ffffff',
                                    '&:hover': {
                                        backgroundColor: 'primary.dark',
                                    },
                                }),
                            }}
                        />
                    );
                })}
            </Box>

            {/* Category Chips - Second Row (only show if categories exist for this type) */}
            {showCategoryChips && (
                <CategoryChips
                    categories={categories}
                    selectedCategories={selectedCategories}
                    onCategoriesChange={handleCategoriesChange}
                />
            )}

            {/* News List - Filtered by type and optionally category */}
            <NewsList
                type={type}
                categories={
                    showCategoryChips &&
                        selectedCategories.length > 0 &&
                        selectedCategories.length < categories.length
                        ? selectedCategories
                        : undefined
                }
            />
        </Box>
    );
}
