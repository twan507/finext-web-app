'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

interface FinancialsBarChartProps {
    vonHoa: number;
    loiNhuan: number;
    doanhThu: number;
    maxValue: number;
    date?: string;
}

export default function FinancialsBarChart({
    vonHoa,
    loiNhuan,
    doanhThu,
    maxValue,
    date,
}: FinancialsBarChartProps) {
    const theme = useTheme();

    const items = useMemo(() => {
        const maxVal = Math.max(maxValue, 1);
        return [
            {
                label: 'Vốn hóa',
                value: vonHoa,
                color: theme.palette.trend.down,
                percent: (vonHoa / maxVal) * 100,
            },
            {
                label: 'Lợi nhuận',
                value: loiNhuan,
                color: theme.palette.trend.up,
                percent: (loiNhuan / maxVal) * 100,
            },
            {
                label: 'Doanh thu',
                value: doanhThu,
                color: theme.palette.info.main,
                percent: (doanhThu / maxVal) * 100,
            },
        ];
    }, [vonHoa, loiNhuan, doanhThu, theme]);

    const formatValue = (val: number) => val.toLocaleString('vi-VN');

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1}}>
            {items.map((item) => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                        sx={{
                            flex: 1,
                            position: 'relative',
                            height: 26,
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: 'transparent',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${item.percent}%`,
                                bgcolor: item.color,
                                borderRadius: 1,
                                transition: 'width 0.3s ease',
                                minWidth: item.percent > 0 ? 4 : 0,
                            }}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                pr: 1,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    fontWeight: fontWeight.semibold,
                                    color: theme.palette.text.primary,
                                    whiteSpace: 'nowrap',
                                    textShadow: theme.palette.mode === 'dark'
                                        ? '0 0 4px rgba(0,0,0,0.8)'
                                        : '0 0 4px rgba(255,255,255,0.8)',
                                }}
                            >
                                {item.label}: {formatValue(item.value)}T
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
