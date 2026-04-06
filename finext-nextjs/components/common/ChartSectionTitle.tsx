'use client';

import React from 'react';
import { Box, Typography, SxProps } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import InfoTooltip from 'components/common/InfoTooltip';

interface ChartSectionTitleProps {
    /** Tiêu đề hiển thị (sẽ tự uppercase) */
    title: string;
    /** Mô tả ngắn về biểu đồ cho tooltip */
    description: string;
    /** Thời gian cập nhật dạng "HH:mm DD/MM/YYYY" — từ useMarketUpdateTime */
    updateTime?: string | null;
    /** sx override cho Typography tiêu đề */
    sx?: SxProps;
}

/**
 * Tiêu đề section biểu đồ trang Markets với icon ⓘ.
 * Hover icon → tooltip hiển thị mô tả + thời gian cập nhật.
 */
export default function ChartSectionTitle({
    title,
    description,
    updateTime,
    sx,
}: ChartSectionTitleProps) {
    const tooltipContent = (
        <Box>
            {/* Mô tả — không in đậm */}
            <Typography
                sx={{
                    fontSize: 'inherit',
                    fontWeight: 400,
                    lineHeight: 1.5,
                    color: 'inherit',
                }}
            >
                {description}
            </Typography>

            {/* Dòng thời gian cập nhật — xuống dòng, icon đồng hồ */}
            {updateTime && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mt: 0.75,
                    }}
                >
                    <AccessTimeIcon sx={{ fontSize: '0.9em' }} />
                    {/* "Cập nhật:" in đậm */}
                    <Typography
                        component="span"
                        sx={{
                            fontSize: 'inherit',
                            fontWeight: fontWeight.semibold,
                            color: 'inherit',
                        }}
                    >
                        Cập nhật:
                    </Typography>
                    {/* Thời gian — không in đậm */}
                    <Typography
                        component="span"
                        sx={{
                            fontSize: 'inherit',
                            fontWeight: 400,
                            color: 'inherit',
                        }}
                    >
                        {updateTime}
                    </Typography>
                </Box>
            )}
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0, ...sx }}>
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    lineHeight: 1.3,
                }}
            >
                {title}
            </Typography>
            <InfoTooltip
                title={tooltipContent}
                placement="top-start"
                maxWidth={280}
            />
        </Box>
    );
}
