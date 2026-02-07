// finext-nextjs/app/(main)/news/components/CategoryChips.tsx
'use client';

import { Box, Chip, Skeleton } from '@mui/material';

import { spacing, fontWeight } from 'theme/tokens';

/** Category info */
export interface CategoryInfo {
    category: string;
    category_name: string;
}

interface CategoryChipsProps {
    categories: CategoryInfo[];
    selectedCategories?: string[];
    onCategoriesChange: (categories: string[]) => void;
    loading?: boolean;
}

export default function CategoryChips({
    categories,
    selectedCategories = [],
    onCategoriesChange,
    loading = false,
}: CategoryChipsProps) {
    const handleChipClick = (category: string) => {
        // Toggle the category selection
        if (selectedCategories.includes(category)) {
            // Remove from selection
            onCategoriesChange(selectedCategories.filter(c => c !== category));
        } else {
            // Add to selection
            onCategoriesChange([...selectedCategories, category]);
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    mb: spacing.xs,
                }}
            >
                {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton
                        key={index}
                        variant="rounded"
                        width={80}
                        height={32}
                        sx={{ borderRadius: '16px' }}
                    />
                ))}
            </Box>
        );
    }

    if (categories.length === 0) {
        return null;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                mb: spacing.xs,
            }}
        >
            {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.category);
                return (
                    <Chip
                        key={cat.category}
                        label={cat.category_name}
                        onClick={() => handleChipClick(cat.category)}
                        color="default"
                        variant="filled"
                        sx={{
                            fontWeight: fontWeight.medium,
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
    );
}
