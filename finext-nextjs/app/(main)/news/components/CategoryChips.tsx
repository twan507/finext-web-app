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
    selectedCategory?: string;
    onCategoryChange: (category: string) => void;
    loading?: boolean;
}

export default function CategoryChips({
    categories,
    selectedCategory,
    onCategoryChange,
    loading = false,
}: CategoryChipsProps) {
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
            {categories.map((cat) => (
                <Chip
                    key={cat.category}
                    label={cat.category_name}
                    onClick={() => onCategoryChange(cat.category)}
                    color={selectedCategory === cat.category ? 'primary' : 'default'}
                    variant="filled"
                    sx={{ fontWeight: fontWeight.medium, border: 'none' }}
                />
            ))}
        </Box>
    );
}
