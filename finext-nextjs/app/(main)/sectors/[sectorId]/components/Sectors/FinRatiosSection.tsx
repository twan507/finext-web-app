'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import InfoTooltip from 'components/common/InfoTooltip';

interface FinratiosRecord {
    date: string;
    ticker: string;
    ticker_name?: string;
    ryd11?: number;
    ryd21?: number;
    ryd25?: number;
    ryd26?: number;
    ryd14?: number;
    ryd7?: number;
    ryq76?: number;
    ryd28?: number;
    ryd30?: number;
}

const finratio_info_map: Record<string, { label: string; tooltip: string }> = {
    'ryd11': { label: 'Vốn hóa', tooltip: 'Tổng giá trị thị trường của ngành (tỷ đồng)' },
    'ryd21': { label: 'P/E', tooltip: 'Giá cổ phiếu / Lợi nhuận trên mỗi cổ phiếu. Thấp = rẻ, cao = đắt' },
    'ryd25': { label: 'P/B', tooltip: 'Giá / Giá trị sổ sách trên mỗi cổ phiếu' },
    'ryd26': { label: 'P/S', tooltip: 'Giá / Doanh thu trên mỗi cổ phiếu' },
    'ryd14': { label: 'EPS', tooltip: 'Lợi nhuận trên mỗi cổ phiếu (đồng)' },
    'ryd7': { label: 'BVPS', tooltip: 'Giá trị sổ sách trên mỗi cổ phiếu (đồng)' },
    'ryq76': { label: 'PEG', tooltip: 'P/E / Tốc độ tăng trưởng lợi nhuận. < 1 = đang bị định giá thấp' },
    'ryd30': { label: 'EV/EBITDA', tooltip: 'Giá trị doanh nghiệp / EBITDA. Dùng so sánh cross-industry' },
};

const RATIO_KEYS = ['ryd11', 'ryd21', 'ryd25', 'ryd26', 'ryd14', 'ryd7', 'ryq76', 'ryd30'] as const;

function formatValue(key: string, value: number | undefined | null): string {
    if (value == null) return '—';
    switch (key) {
        case 'ryd11':
            return `${Math.round(value).toLocaleString('en-US')} Tỷ`;
        case 'ryd21':
        case 'ryd25':
        case 'ryd26':
        case 'ryq76':
        case 'ryd28':
        case 'ryd30':
            return value.toFixed(2);
        case 'ryd14':
        case 'ryd7':
            return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        default:
            return String(value);
    }
}

interface FinRatiosSectionProps {
    ticker: string;
    indexName: string;
    rawData: FinratiosRecord[];
}

export default function FinRatiosSection({ indexName, rawData }: FinRatiosSectionProps) {
    const theme = useTheme();

    const latestRecord = useMemo(() => {
        if (!rawData || rawData.length === 0) return null;
        return rawData[0];
    }, [rawData]);

    return (
        <Box sx={{ mt: 2 }}>

            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1,
            }}>
                {RATIO_KEYS.map((key) => (
                    <Box key={key} sx={{ py: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('xs'),
                                color: theme.palette.text.secondary,
                                fontWeight: fontWeight.medium,
                            }}>
                                {finratio_info_map[key].label}
                            </Typography>
                            <InfoTooltip title={finratio_info_map[key].tooltip} />
                        </Box>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.text.primary,
                        }}>
                            {formatValue(key, latestRecord?.[key as keyof FinratiosRecord] as number)}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
