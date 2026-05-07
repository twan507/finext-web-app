'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import InfoTooltip from 'components/common/InfoTooltip';

interface FinratiosRecord {
    date: string;
    ticker: string;
    ticker_name?: string;
    ryd21?: number;
    ryd25?: number;
    ryd14?: number;
    ryd7?: number;
    ryd28?: number;
    ryd30?: number;
    outstandingShare?: number;
    freeFloatRate?: number;
    statePercentage?: number;
    foreignerPercentage?: number;
    foreignerRoom?: number;
    maximumForeignPercentage?: number;
    majorHoldings?: number;
}

interface StockKeyMetricsPanelProps {
    rawData: FinratiosRecord[];
}

const STATIC_TOOLTIPS: Record<string, string> = {
    'ryd21': 'Giá cổ phiếu / Lợi nhuận trên mỗi cổ phiếu. Thấp = rẻ, cao = đắt',
    'ryd25': 'Giá / Giá trị sổ sách trên mỗi cổ phiếu',
    'ryd28': 'Giá / Dòng tiền trên mỗi cổ phiếu',
    'ryd14': 'Lợi nhuận trên mỗi cổ phiếu (đồng)',
    'ryd7': 'Giá trị sổ sách trên mỗi cổ phiếu (đồng)',
    'ryd30': 'Giá trị doanh nghiệp / EBITDA. Dùng so sánh cross-industry',
    'outstandingShare': 'Khối lượng cổ phiếu đang lưu hành',
    'freeFloatRate': 'Tỷ lệ cổ phiếu tự do chuyển nhượng',
    'majorHoldings': 'Tỷ lệ sở hữu của cổ đông lớn',
    'statePercentage': 'Tỷ lệ sở hữu của Nhà nước',
    'foreignerPercentage': 'Tỷ lệ sở hữu của nhà đầu tư nước ngoài',
};

const LABELS: Record<string, string> = {
    'ryd21': 'P/E',
    'ryd25': 'P/B',
    'ryd28': 'P/CF',
    'ryd14': 'EPS',
    'ryd7': 'BVPS',
    'ryd30': 'EV/EBITDA',
    'outstandingShare': 'KL CP lưu hành',
    'freeFloatRate': 'Tỷ lệ free-float',
    'majorHoldings': 'Cổ đông lớn',
    'statePercentage': 'Sở hữu Nhà nước',
    'foreignerPercentage': 'Sở hữu nước ngoài',
    'foreignerRoom': 'Room ngoại còn lại',
};

const PERCENT_KEYS = new Set(['freeFloatRate', 'majorHoldings', 'statePercentage', 'foreignerPercentage']);

// 3 cols × 4 rows — render theo hàng
const ROW_KEYS: string[][] = [
    ['ryd21', 'ryd25', 'ryd28'],                                          // P/E, P/B, P/CF
    ['ryd14', 'ryd7', 'ryd30'],                                           // EPS, BVPS, EV/EBITDA
    ['outstandingShare', 'freeFloatRate', 'majorHoldings'],               // KL CP, Free-float, Cổ đông lớn
    ['statePercentage', 'foreignerPercentage', 'foreignerRoom'],          // Sở hữu NN, Sở hữu NN ngoài, Room ngoại
];

function formatPercent(value: number | undefined | null): string {
    if (value == null) return '—';
    if (value === 0) return '0%';
    return `${(value * 100).toFixed(2)}%`;
}

function formatFinValue(key: string, value: number | undefined | null): string {
    if (value == null) return '—';
    if (PERCENT_KEYS.has(key)) return formatPercent(value);
    switch (key) {
        case 'ryd21':
        case 'ryd25':
        case 'ryd28':
        case 'ryd30':
            return value.toFixed(2);
        case 'ryd14':
        case 'ryd7':
            return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        default:
            return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
}

function getTooltip(key: string, latest: FinratiosRecord | null): string {
    if (key === 'foreignerRoom') {
        const max = latest?.maximumForeignPercentage;
        const maxStr = max == null ? '—' : `${Math.round(max * 100)}%`;
        return `Tỉ lệ sở hữu nước ngoài tối đa ${maxStr}. Khối lượng cổ phiếu nước ngoài còn được mua.`;
    }
    return STATIC_TOOLTIPS[key] ?? '';
}

export default function StockKeyMetricsPanel({ rawData }: StockKeyMetricsPanelProps) {
    const theme = useTheme();
    const latestRecord = rawData && rawData.length > 0 ? rawData[0] : null;

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            columnGap: 2,
            // rowGap: 3.55,
            alignContent: { xs: 'start', md: 'space-between' },
            width: '100%',
            height: { xs: 'auto', md: '100%' },
        }}>
            {ROW_KEYS.flat().map((key) => {
                const label = LABELS[key];
                if (!label) return null;
                return (
                    <Box key={key}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('xs'),
                                color: theme.palette.text.secondary,
                                fontWeight: fontWeight.medium,
                            }}>
                                {label}
                            </Typography>
                            <InfoTooltip title={getTooltip(key, latestRecord)} />
                        </Box>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.text.primary,
                        }}>
                            {formatFinValue(key, latestRecord?.[key as keyof FinratiosRecord] as number)}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );
}
