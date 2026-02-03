// finext-nextjs/app/(main)/news/PageContent.tsx
'use client';

import { Box, Typography, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';

import { NewsBreadcrumb, NewsList } from './components';
import { spacing, fontWeight } from 'theme/tokens';
import { NEWS_SOURCES_INFO, NewsSource } from './types';

export default function NewsContent() {
    const router = useRouter();

    const handleSourceClick = (source: NewsSource) => {
        router.push(`/news/category/${source}`);
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

            {/* Source Tabs */}
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
                    color="primary"
                    variant="filled"
                    sx={{ fontWeight: fontWeight.semibold, border: 'none' }}
                />
                {NEWS_SOURCES_INFO.map((sourceInfo) => (
                    <Chip
                        key={sourceInfo.source}
                        label={sourceInfo.source_name}
                        onClick={() => handleSourceClick(sourceInfo.source)}
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

