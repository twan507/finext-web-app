// finext-nextjs/app/(main)/reports/PageContent.tsx
'use client';

import { Box, Typography, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';

import { ReportList } from './components';
import NewsBreadcrumb from '../news/components/NewsBreadcrumb';
import { spacing, fontWeight } from 'theme/tokens';
import { REPORT_TYPES_INFO, ReportType } from './types';

export default function ReportsContent() {
    const router = useRouter();

    const handleTypeClick = (type: ReportType) => {
        router.push(`/reports/type/${type}`);
    };

    return (
        <Box sx={{ py: spacing.xs }}>
            {/* Breadcrumb */}
            <NewsBreadcrumb sectionLabel="Báo cáo" sectionHref="/reports" items={[]} />

            {/* Header */}
            <Box sx={{ mb: spacing.xs }}>
                <Typography variant="h1">
                    Báo cáo tổng hợp
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
                    onClick={() => router.push('/reports')}
                    color="default"
                    variant="filled"
                    sx={{
                        fontWeight: fontWeight.semibold,
                        border: 'none',
                        backgroundColor: 'primary.main',
                        color: '#ffffff',
                        '&:hover': {
                            backgroundColor: 'primary.dark',
                        },
                    }}
                />
                {REPORT_TYPES_INFO.map((typeInfo) => (
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

            {/* Report List - Show all */}
            <ReportList />
        </Box>
    );
}
