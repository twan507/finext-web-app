'use client';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface StockKeyMetricsPanelProps {
    rawData: FinratiosRecord[];
    todayStockData?: any;
}

const info_map: Record<string, { label: string; tooltip: string; type: 'finratio' | 'stock' }> = {
    'industry_name': { label: 'Ngành nghề', tooltip: 'Ngành nghề của cổ phiếu', type: 'stock' },
    'category_name': { label: 'Nhóm dòng tiền', tooltip: 'Nhóm dòng tiền của cổ phiếu', type: 'stock' },
    'marketcap_name': { label: 'Nhóm vốn hoá', tooltip: 'Nhóm vốn hoá của cổ phiếu', type: 'stock' },
    'ryd11': { label: 'Vốn hoá', tooltip: 'Tổng giá trị thị trường (tỷ đồng)', type: 'finratio' },
    'ryd21': { label: 'P/E', tooltip: 'Giá cổ phiếu / Lợi nhuận trên mỗi cổ phiếu. Thấp = rẻ, cao = đắt', type: 'finratio' },
    'ryd25': { label: 'P/B', tooltip: 'Giá / Giá trị sổ sách trên mỗi cổ phiếu', type: 'finratio' },
    'ryd26': { label: 'P/S', tooltip: 'Giá / Doanh thu trên mỗi cổ phiếu', type: 'finratio' },
    'ryd28': { label: 'P/CF', tooltip: 'Giá / Dòng tiền trên mỗi cổ phiếu', type: 'finratio' },
    'ryd14': { label: 'EPS', tooltip: 'Lợi nhuận trên mỗi cổ phiếu (đồng)', type: 'finratio' },
    'ryd7': { label: 'BVPS', tooltip: 'Giá trị sổ sách trên mỗi cổ phiếu (đồng)', type: 'finratio' },
    'ryq76': { label: 'PEG', tooltip: 'P/E / Tốc độ tăng trưởng lợi nhuận. < 1 = đang bị định giá thấp', type: 'finratio' },
    'ryd30': { label: 'EV/EBITDA', tooltip: 'Giá trị doanh nghiệp / EBITDA. Dùng so sánh cross-industry', type: 'finratio' },
};

// 3 cols × 4 rows — render theo hàng
const ROW_KEYS: string[][] = [
    ['industry_name', 'category_name', 'marketcap_name'],
    ['ryd11', 'ryd21', 'ryd25'],          // Vốn hoá, P/E, P/B
    ['ryd14', 'ryd26', 'ryd28'],          // EPS, P/S, P/CF
    ['ryd7', 'ryq76', 'ryd30'],           // BVPS, PEG, EV/EBITDA
];

function formatFinValue(key: string, value: number | undefined | null): string {
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

function formatStockValue(value: string | undefined | null): string {
    return value || '—';
}

export default function StockKeyMetricsPanel({ rawData, todayStockData }: StockKeyMetricsPanelProps) {
    const theme = useTheme();
    const latestRecord = rawData && rawData.length > 0 ? rawData[0] : null;

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 0.6fr',
            columnGap: 2,
            rowGap: 3.55,
            width: '100%',
        }}>
            {ROW_KEYS.flat().map((key) => {
                const info = info_map[key];
                if (!info) return null;
                return (
                    <Box key={key}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('xs'),
                                color: theme.palette.text.secondary,
                                fontWeight: fontWeight.medium,
                            }}>
                                {info.label}
                            </Typography>
                            <InfoTooltip title={info.tooltip} />
                        </Box>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.text.primary,
                        }}>
                            {info.type === 'finratio'
                                ? formatFinValue(key, latestRecord?.[key as keyof FinratiosRecord] as number)
                                : formatStockValue(todayStockData?.[key])
                            }
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );
}
