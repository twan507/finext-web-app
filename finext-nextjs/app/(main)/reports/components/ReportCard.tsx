// finext-nextjs/app/(main)/reports/components/ReportCard.tsx
'use client';

import { Box, Typography } from '@mui/material';
import Link from 'next/link';

import { NewsReport } from '../types';
import { spacing, transitions, getResponsiveFontSize } from 'theme/tokens';

interface ReportCardProps {
    report: NewsReport;
}

/** Parse date và trả về ngày + giờ */
const parseDateTime = (dateStr: string): { date: string; time: string } => {
    try {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }),
            time: date.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
            }),
        };
    } catch {
        return { date: dateStr, time: '' };
    }
};

export default function ReportCard({ report }: ReportCardProps) {
    const { date, time } = parseDateTime(report.created_at);

    return (
        <Box
            component={Link}
            href={`/reports/${report.report_id}`}
            sx={{
                display: 'flex',
                gap: { xs: spacing.xs, md: spacing.sm },
                py: spacing.xxs,
                textDecoration: 'none',
                color: 'inherit',
                borderBottom: '1px solid',
                borderColor: 'divider',
                transition: transitions.colors,
                '&:hover': {
                    '& .report-title': {
                        color: 'primary.main',
                    },
                },
                '&:last-child': {
                    borderBottom: 'none',
                },
            }}
        >
            {/* Cột trái: Ngày + Giờ */}
            <Box
                sx={{
                    flexShrink: 0,
                    width: { xs: 80, md: 100 },
                    textAlign: 'left',
                }}
            >
                <Typography
                    variant="body2"
                    color="primary.main"
                    sx={{
                        fontWeight: 600,
                        fontSize: getResponsiveFontSize('sm'),
                    }}
                >
                    {date}
                </Typography>
                <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                    }}
                >
                    {time}
                </Typography>
            </Box>

            {/* Cột phải: Tiêu đề + Category */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* Tiêu đề - lấy từ field title */}
                <Typography
                    className="report-title"
                    variant="h6"
                    sx={{
                        fontWeight: 700,
                        fontSize: getResponsiveFontSize('md'),
                        lineHeight: 1.4,
                        mb: 0.5,
                        transition: transitions.colors,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {report.title || 'Bản tin'}
                </Typography>

                {/* Category name */}
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        lineHeight: 1.5,
                    }}
                >
                    {report.category_name}
                </Typography>
            </Box>
        </Box>
    );
}
