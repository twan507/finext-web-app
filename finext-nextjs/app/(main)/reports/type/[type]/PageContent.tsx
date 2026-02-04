// finext-nextjs/app/(main)/reports/type/[type]/PageContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';

import { ReportList } from '../../components';
import NewsBreadcrumb from '../../../news/components/NewsBreadcrumb';
import CategoryChips from '../../../news/components/CategoryChips';
import { spacing, fontWeight } from 'theme/tokens';
import { apiClient } from 'services/apiClient';
import { ReportCategoryInfo, ReportType, REPORT_TYPES_INFO, getReportTypeInfo } from '../../types';

interface PageContentProps {
    type: ReportType;
}

interface CategoriesApiResponse {
    items: ReportCategoryInfo[];
    total: number;
}

export default function PageContent({ type }: PageContentProps) {
    const router = useRouter();
    const [categories, setCategories] = useState<ReportCategoryInfo[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    const currentTypeInfo = getReportTypeInfo(type);
    const typeName = currentTypeInfo?.type_name || type;
    const showCategoryChips = categories.length > 0;

    // Fetch categories từ API theo report_type
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await apiClient<CategoriesApiResponse>({
                    url: '/api/v1/sse/rest/news_report_categories',
                    method: 'GET',
                    queryParams: {
                        report_type: type,
                    },
                    requireAuth: false,
                });

                if (response.data?.items) {
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

    // Handle type tab click
    const handleTypeClick = (newType: ReportType | 'all') => {
        if (newType === 'all') {
            router.push('/reports');
        } else if (newType === type) {
            // If clicking the same type, just reset the category filter
            setSelectedCategories([]);
        } else {
            // Navigate to different type
            router.push(`/reports/type/${newType}`);
        }
    };

    // Handle category selection (multiple)
    const handleCategoriesChange = (cats: string[]) => {
        setSelectedCategories(cats);
    };

    // Generate breadcrumb label for selected categories
    const getCategoryBreadcrumbLabel = () => {
        if (selectedCategories.length === 0) return '';
        if (selectedCategories.length === 1) {
            return categories.find(c => c.category === selectedCategories[0])?.category_name || '';
        }
        return `${selectedCategories.length} danh mục`;
    };

    // Check if filter is actually applied
    const isFilterApplied = selectedCategories.length > 0 && selectedCategories.length < categories.length;

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb
                sectionLabel="Báo cáo"
                sectionHref="/reports"
                items={[
                    { label: typeName, href: `/reports/type/${type}` },
                    ...(isFilterApplied
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
                    Tổng hợp và phân tích tin tức thị trường theo ngày, tuần và tháng.
                </Typography>
            </Box>

            {/* Type Tabs - Level 1 */}
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
                {REPORT_TYPES_INFO.map((typeInfo) => {
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
                                    color: 'text.primary',
                                    '&:hover': {
                                        backgroundColor: 'primary.dark',
                                    },
                                }),
                            }}
                        />
                    );
                })}
            </Box>

            {/* Category Chips - Level 2 (multiple selection) */}
            {showCategoryChips && (
                <CategoryChips
                    categories={categories}
                    selectedCategories={selectedCategories}
                    onCategoriesChange={handleCategoriesChange}
                />
            )}

            {/* Report List - Filtered by type and optionally categories */}
            <ReportList
                type={type}
                categories={
                    isFilterApplied
                        ? selectedCategories
                        : undefined
                }
            />
        </Box>
    );
}
