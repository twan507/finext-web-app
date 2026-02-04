// finext-nextjs/app/(main)/news/components/SourceTabs.tsx
'use client';

import { Box, Chip, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';

import { spacing, fontWeight } from 'theme/tokens';

/** Category info từ API hoặc extracted từ articles */
export interface CategoryInfo {
    category: string;
    category_name: string;
}

interface CategoryTabsProps {
    categories: CategoryInfo[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    loading?: boolean;
    /** Sử dụng navigation thay vì callback */
    useNavigation?: boolean;
}

export default function SourceTabs({
    categories,
    selectedCategory,
    onCategoryChange,
    loading = false,
    useNavigation = false,
}: CategoryTabsProps) {
    const router = useRouter();

    const handleClick = (category: string) => {
        if (useNavigation) {
            if (category === 'all') {
                router.push('/news');
            } else {
                router.push(`/news/type/${category}`);
            }
        } else {
            onCategoryChange(category);
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

    return (
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
                onClick={() => handleClick('all')}
                color={selectedCategory === 'all' ? 'primary' : 'default'}
                variant="filled"
                sx={{ fontWeight: fontWeight.medium, border: 'none' }}
            />
            {categories.map((cat) => (
                <Chip
                    key={cat.category}
                    label={cat.category_name}
                    onClick={() => handleClick(cat.category)}
                    color={selectedCategory === cat.category ? 'primary' : 'default'}
                    variant="filled"
                    sx={{ fontWeight: fontWeight.medium, border: 'none' }}
                />
            ))}
        </Box>
    );
}
