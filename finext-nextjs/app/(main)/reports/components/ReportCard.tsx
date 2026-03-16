// finext-nextjs/app/(main)/reports/components/ReportCard.tsx
'use client';

import { useState } from 'react';
import { Box, Snackbar, Typography } from '@mui/material';
import Link from 'next/link';

import { apiClient } from 'services/apiClient';
import { NewsReport } from '../types';
import { spacing, transitions, getResponsiveFontSize, fontWeight } from 'theme/tokens';

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
    const [copied, setCopied] = useState(false);

    const handleCopyContent = async () => {
        try {
            const response = await apiClient<{ report: NewsReport | null }>({
                url: '/api/v1/sse/rest/report_article',
                method: 'GET',
                queryParams: { report_slug: report.report_slug },
                requireAuth: false,
            });
            const full = response.data?.report;
            if (!full) return;
            let markdownContent = '';
            if (full.report_markdown) {
                markdownContent = full.report_markdown;
            } else if (full.report_html) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = full.report_html;
                markdownContent = tempDiv.textContent || tempDiv.innerText || '';
            }
            const copyData = {
                title: full.title || 'Báo cáo',
                sapo: full.sapo || '',
                content: markdownContent,
                created_at: full.created_at,
            };
            await navigator.clipboard.writeText(JSON.stringify(copyData));
            setCopied(true);
        } catch (err) {
            console.error('Failed to copy content:', err);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                gap: { xs: spacing.xs, md: spacing.sm },
                py: spacing.xxs,
                borderBottom: '1px solid',
                borderColor: 'divider',
                transition: transitions.colors,
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
                        fontWeight: fontWeight.medium,
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

            {/* Cột phải: Tiêu đề + Sapo */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* Tiêu đề - click để vào bài */}
                <Typography
                    className="report-title"
                    component={Link}
                    href={`/reports/${report.report_slug}`}
                    variant="h6"
                    sx={{
                        fontWeight: fontWeight.semibold,
                        fontSize: getResponsiveFontSize('md'),
                        lineHeight: 1.4,
                        mb: 0.5,
                        transition: transitions.colors,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        '&:hover': {
                            textDecoration: 'underline',
                        },
                    }}
                >
                    {report.title || 'Báo cáo'}
                </Typography>

                {/* Sapo - double click để copy */}
                {(report.sapo || report.category_name) && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        onDoubleClick={handleCopyContent}
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            userSelect: 'none',
                        }}
                    >
                        {report.category_name ? `(${report.category_name}) - ` : ''}{report.sapo || report.category_name}
                    </Typography>
                )}
            </Box>

            <Snackbar
                open={copied}
                autoHideDuration={1500}
                onClose={() => setCopied(false)}
                message="Đã copy nội dung báo cáo"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Box>
    );
}
