// finext-nextjs/app/(main)/news/PageContent.tsx
'use client';

import { Box, Typography, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';

import { NewsBreadcrumb, NewsList } from './components';
import { spacing, fontWeight } from 'theme/tokens';
import { NEWS_TYPES_INFO, NewsType } from './types';

export default function NewsContent() {
    const router = useRouter();

    const handleTypeClick = (type: NewsType) => {
        router.push(`/news/type/${type}`);
    };

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

            {/* Type Tabs */}
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
                    onClick={() => router.push('/news')}
                    color="default"
                    variant="filled"
                    sx={{
                        fontWeight: fontWeight.semibold,
                        border: 'none',
                        backgroundColor: 'primary.main',
                        color: 'text.primary',
                        '&:hover': {
                            backgroundColor: 'primary.dark',
                        },
                    }}
                />
                {NEWS_TYPES_INFO.map((typeInfo) => (
                    <Chip
                        key={typeInfo.type}
                        label={typeInfo.type_name}
                        onClick={() => handleTypeClick(typeInfo.type)}
                        color="default"
                        variant="filled"
                        sx={{ fontWeight: fontWeight.medium, border: 'none' }}
                    />
                ))}
            </Box>

            {/* News List */}
            <NewsList />
        </Box>
    );
}

