'use client';

import { useRef, useState } from 'react';
import { Box, Typography, useTheme, alpha, Popover } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

// ========== TYPES ==========
export interface PhaseSignalData {
    date: string | number;
    final_phase: number;
    pct_change: number;
    pct_return: number;
    // Buy signals (positive)
    buy_index_change: 0 | 1;
    buy_ratio_change: 0 | 1;
    buy_ms_score_stt: 0 | 1;
    buy_vsi_volume_stt: 0 | 1;
    buy_ms_value: 0 | 1;
    buy_ms_diff: 0 | 1;
    buy_ratio_strength: 0 | 1;
    buy_ratio_value: 0 | 1;
    // Sell signals (negative)
    sell_ratio_change: 0 | 1;
    sell_ms_score_stt: 0 | 1;
    sell_vsi_volume_stt: 0 | 1;
    sell_ms_value: 0 | 1;
    sell_ms_diff: 0 | 1;
    sell_ratio_strength: 0 | 1;
    sell_ratio_value: 0 | 1;
}

// ========== CONDITION INFO ==========
const conditionInfo: Record<string, string> = {
    // Tín hiệu MUA (BUY)
    'buy_index_change': 'Biến động giá ngắn hạn tích cực',
    'buy_ms_score_stt': 'Tín hiệu xu hướng tích cực',
    'buy_ms_diff': 'Sức mạnh xu hướng tích cực',
    'buy_ms_value': 'Vùng xu hướng tích cực',
    'buy_vsi_volume_stt': 'Thanh khoản hỗ trợ xu hướng',
    'buy_ratio_change': 'Tín hiệu tăng trưởng dòng tiền',
    'buy_ratio_strength': 'Sức mạnh tăng trưởng dòng tiền',
    'buy_ratio_value': 'Dòng tiền dưới mức hưng phấn',
    // Tín hiệu BÁN (SELL)
    'sell_ms_score_stt': 'Tín hiệu xu hướng tiêu cực',
    'sell_ms_diff': 'Sức mạnh xu hướng tiêu cực',
    'sell_ms_value': 'Vùng xu hướng tiêu cực',
    'sell_vsi_volume_stt': 'Thanh khoản duy trì xu hướng',
    'sell_ratio_change': 'Tín hiệu suy yếu dòng tiền',
    'sell_ratio_strength': 'Sức mạnh suy yếu dòng tiền',
    'sell_ratio_value': 'Dòng tiền dưới mức hoảng loạn',
};

// Tooltip detailed explanations for value = 1 (condition met)
const tooltipInfoMet: Record<string, string> = {
    // Điều kiện MUA (BUY) - ĐẠT
    'buy_index_change': 'Biến động chỉ số tích cực: phiên tăng ≥0%, giảm max 5 phiên > -20%, tổng 5 phiên > -4%',
    'buy_ratio_change': 'Dòng tiền tăng: nếu >30% cần tăng >3%, nếu <30% chỉ cần ≥0%',
    'buy_ms_score_stt': 'Trạng thái sóng (w, m, q) và dòng tiền đều ≥ 0',
    'buy_vsi_volume_stt': 'Hệ số thanh khoản (vsi) và khối lượng không âm',
    'buy_ms_value': 'Không quá mua: xu hướng (w, m, q) < 90% (trừ khi vừa giảm >5%)',
    'buy_ms_diff': 'Xu hướng MS tăng hoặc không giảm quá 1%/phiên',
    'buy_ratio_strength': 'Dòng tiền mạnh: full & adjust > 50%, biên động < 50%. Hoặc vùng thấp với ratio > 40%',
    'buy_ratio_value': 'Không quá mua dòng tiền: full < 100%, không đồng thời > 90%',
    // Điều kiện BÁN (SELL) - ĐẠT (cảnh báo)
    'sell_ratio_change': 'Dòng tiền giảm: full giảm >1% hoặc <30%, adjust giảm >3% hoặc <30%',
    'sell_ms_score_stt': 'Trạng thái sóng (w, m, q) và dòng tiền đều ≤ 0',
    'sell_vsi_volume_stt': 'Hệ số thanh khoản ≥ 0, khối lượng ≤ 0',
    'sell_ms_value': 'Xu hướng vùng trung bình: w (20-50%), m (20-70%), q (10-90%)',
    'sell_ms_diff': 'Xu hướng MS giảm hoặc không tăng quá 1%/phiên',
    'sell_ratio_strength': 'Dòng tiền yếu: full & adjust < 50%, biên động ổn định < 40-50%',
    'sell_ratio_value': 'Dòng tiền dương: full > 0, adjust > 0',
};

// Tooltip detailed explanations for value = 0 (condition not met)
const tooltipInfoNotMet: Record<string, string> = {
    // Điều kiện MUA (BUY) - CHƯA ĐẠT
    'buy_index_change': 'Biến động chỉ số chưa tích cực: phiên giảm hoặc tổng 5 phiên < -4%',
    'buy_ratio_change': 'Dòng tiền chưa tăng đủ: nếu >30% cần tăng >3%, nếu <30% cần ≥0%',
    'buy_ms_score_stt': 'Trạng thái sóng hoặc dòng tiền đang âm',
    'buy_vsi_volume_stt': 'Thanh khoản hoặc khối lượng đang âm',
    'buy_ms_value': 'Đang quá mua: xu hướng (w, m, q) ≥ 90%',
    'buy_ms_diff': 'Xu hướng MS đang giảm quá 1%/phiên',
    'buy_ratio_strength': 'Dòng tiền chưa mạnh: full hoặc adjust < 50%, biên động ≥ 50%',
    'buy_ratio_value': 'Đang quá mua dòng tiền: full ≥ 100% hoặc đồng thời > 90%',
    // Điều kiện BÁN (SELL) - CHƯA ĐẠT (tốt)
    'sell_ratio_change': 'Dòng tiền không giảm mạnh: full và adjust ổn định',
    'sell_ms_score_stt': 'Trạng thái sóng hoặc dòng tiền vẫn dương',
    'sell_vsi_volume_stt': 'Khối lượng vẫn dương, thanh khoản hỗ trợ',
    'sell_ms_value': 'Xu hướng không ở vùng trung bình tiêu cực',
    'sell_ms_diff': 'Xu hướng MS không giảm hoặc đang tăng',
    'sell_ratio_strength': 'Dòng tiền không yếu: full hoặc adjust ≥ 50%',
    'sell_ratio_value': 'Dòng tiền không âm: full hoặc adjust ≤ 0',
};

// Keys for buy and sell signals
const buySignalKeys: (keyof PhaseSignalData)[] = [
    'buy_index_change',
    'buy_ms_score_stt',
    'buy_ms_diff',
    'buy_ms_value',
    'buy_vsi_volume_stt',
    'buy_ratio_change',
    'buy_ratio_strength',
    'buy_ratio_value',
];

const sellSignalKeys: (keyof PhaseSignalData)[] = [
    'sell_ms_score_stt',
    'sell_ms_diff',
    'sell_ms_value',
    'sell_vsi_volume_stt',
    'sell_ratio_change',
    'sell_ratio_strength',
    'sell_ratio_value',
];

// ========== ICON COMPONENTS ==========
interface SignalIconProps {
    type: 'positive' | 'warning' | 'negative';
    size?: number;
}

const SignalIcon = ({ type, size = 16 }: SignalIconProps) => {
    const theme = useTheme();

    const iconStyles = {
        fontSize: size,
        flexShrink: 0,
    };

    switch (type) {
        case 'positive':
            return (
                <CheckCircleIcon
                    sx={{
                        ...iconStyles,
                        color: theme.palette.trend.up,
                    }}
                />
            );
        case 'warning':
            return (
                <WarningIcon
                    sx={{
                        ...iconStyles,
                        color: theme.palette.warning.main,
                    }}
                />
            );
        case 'negative':
            return (
                <CancelIcon
                    sx={{
                        ...iconStyles,
                        color: theme.palette.trend.down,
                    }}
                />
            );
    }
};

// ========== SIGNAL ROW COMPONENT ==========
interface SignalRowProps {
    label: string;
    value: 0 | 1;
    signalType: 'buy' | 'sell';
    tooltipText?: string;
}

const SignalRow = ({ label, value, signalType, tooltipText = '' }: SignalRowProps) => {
    const theme = useTheme();
    const anchorRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    // Determine icon type based on signal type and value
    // Buy: 1 = positive (green check), 0 = warning (yellow)
    // Sell: 1 = warning (yellow), 0 = negative (red X)
    let iconType: 'positive' | 'warning' | 'negative';

    if (signalType === 'buy') {
        iconType = value === 1 ? 'positive' : 'warning';
    } else {
        iconType = value === 1 ? 'warning' : 'negative';
    }

    const infoColor = iconType === 'positive'
        ? theme.palette.trend.up
        : iconType === 'warning'
            ? theme.palette.warning.main
            : theme.palette.trend.down;

    return (
        <Box ref={anchorRef}>
            <Box
                onClick={() => setOpen((prev) => !prev)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.7,
                    pl: 1.5,
                    pr: 1.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    flex: 1,
                    userSelect: 'none',
                    bgcolor: open ? alpha(infoColor, 0.08) : 'transparent',
                }}
            >
                <SignalIcon type={iconType} size={18} />
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('md'),
                        color: theme.palette.text.secondary,
                        flex: 1,
                        lineHeight: 0.5,
                    }}
                >
                    {label}
                </Typography>
            </Box>
            <Popover
                open={open}
                anchorEl={anchorRef.current}
                onClose={() => setOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                disableRestoreFocus
                slotProps={{
                    paper: {
                        sx: {
                            bgcolor: theme.palette.background.default,
                            borderRadius: `${borderRadius.sm}px`,
                            boxShadow: theme.shadows[8],
                            border: `1px solid ${alpha(infoColor, 0.25)}`,
                            px: 1.5,
                            py: 1,
                            maxWidth: 260,
                        },
                    },
                }}
            >
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        color: infoColor,
                        lineHeight: 1.5,
                    }}
                >
                    {tooltipText}
                </Typography>
            </Popover>
        </Box>
    );
};

// ========== SIGNAL TABLE COMPONENT ==========
interface SignalTableProps {
    title: string;
    signals: { key: string; label: string; value: 0 | 1 }[];
    signalType: 'buy' | 'sell';
}

const SignalTable = ({ title, signals, signalType }: SignalTableProps) => {
    const theme = useTheme();

    const headerColor = signalType === 'buy'
        ? theme.palette.trend.up
        : theme.palette.warning.main;

    return (
        <Box
            sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1.5,
                    px: 1.5,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    bgcolor: alpha(headerColor, 0.08),
                    borderRadius: `${borderRadius.xs}px ${borderRadius.xs}px 0 0`,
                }}
            >
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('md'),
                        fontWeight: fontWeight.semibold,
                        color: headerColor,
                    }}
                >
                    {title}
                </Typography>
            </Box>

            {/* Signal Rows */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    py: 1,
                    overflowY: 'auto',
                    justifyContent: 'space-evenly',
                }}
            >
                {signals.map((signal) => (
                    <SignalRow
                        key={signal.key}
                        label={signal.label}
                        value={signal.value}
                        signalType={signalType}
                        tooltipText={signal.value === 1 ? (tooltipInfoMet[signal.key] || '') : (tooltipInfoNotMet[signal.key] || '')}
                    />
                ))}
            </Box>
        </Box>
    );
};

// ========== MAIN SIGNAL PANEL COMPONENT ==========
interface SignalPanelProps {
    data: PhaseSignalData | null;
    isLoading?: boolean;
}

export default function SignalPanel({ data, isLoading = false }: SignalPanelProps) {
    const theme = useTheme();

    // Build buy signals array
    const buySignals = buySignalKeys.map((key) => ({
        key,
        label: conditionInfo[key] || key,
        value: (data?.[key] ?? 0) as 0 | 1,
    }));

    // Build sell signals array
    const sellSignals = sellSignalKeys.map((key) => ({
        key,
        label: conditionInfo[key] || key,
        value: (data?.[key] ?? 0) as 0 | 1,
    }));

    // Loading state
    if (isLoading || !data) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    gap: 1,
                    opacity: 0.5,
                }}
            >
                {/* Loading skeleton for buy section */}
                <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.divider, 0.1), borderRadius: borderRadius.md }} />
                {/* Loading skeleton for sell section */}
                <Box sx={{ flex: 1, bgcolor: alpha(theme.palette.divider, 0.1), borderRadius: borderRadius.md }} />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                gap: 2,
                overflow: 'hidden',
            }}
        >
            {/* Buy Signals (Top) */}
            <SignalTable
                title="Tín hiệu Tích cực"
                signals={buySignals}
                signalType="buy"
            />

            {/* Sell Signals (Bottom) */}
            <SignalTable
                title="Tín hiệu Tiêu cực"
                signals={sellSignals}
                signalType="sell"
            />
        </Box>
    );
}

// ========== COMPACT VERSION FOR INLINE USE ==========
interface SignalPanelCompactProps {
    data: PhaseSignalData | null;
    isLoading?: boolean;
}

export function SignalPanelCompact({ data, isLoading = false }: SignalPanelCompactProps) {
    const theme = useTheme();

    if (isLoading || !data) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    p: 1,
                    opacity: 0.5,
                }}
            >
                <Box sx={{ height: 120, bgcolor: alpha(theme.palette.divider, 0.1), borderRadius: 1 }} />
                <Box sx={{ height: 120, bgcolor: alpha(theme.palette.divider, 0.1), borderRadius: 1 }} />
            </Box>
        );
    }

    // Calculate summary counts
    const buyPositiveCount = buySignalKeys.filter(k => data[k] === 1).length;
    const sellPositiveCount = sellSignalKeys.filter(k => data[k] === 1).length;

    // Build signals
    const buySignals = buySignalKeys.map((key) => ({
        key,
        label: conditionInfo[key] || key,
        value: (data[key] ?? 0) as 0 | 1,
    }));

    const sellSignals = sellSignalKeys.map((key) => ({
        key,
        label: conditionInfo[key] || key,
        value: (data[key] ?? 0) as 0 | 1,
    }));

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                gap: 2,
                overflow: 'hidden',
            }}
        >
            {/* Buy Section */}
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                bgcolor: alpha(theme.palette.trend.up, 0.06),
                borderRadius: borderRadius.sm,
            }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 1.5,
                        px: 1.5,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.trend.up,
                        }}
                    >
                        Tín hiệu Tích cực
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
                            fontWeight: fontWeight.bold,
                            color: theme.palette.trend.up,
                        }}
                    >
                        {buyPositiveCount}/{buySignalKeys.length}
                    </Typography>
                </Box>
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    py: 0.5,
                    minHeight: 0,
                }}>
                    {buySignals.map((signal) => (
                        <SignalRow
                            key={signal.key}
                            label={signal.label}
                            value={signal.value}
                            signalType="buy"
                            tooltipText={signal.value === 1 ? (tooltipInfoMet[signal.key] || '') : (tooltipInfoNotMet[signal.key] || '')}
                        />
                    ))}
                </Box>
            </Box>

            {/* Sell Section */}
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                bgcolor: alpha(theme.palette.warning.main, 0.06),
                borderRadius: borderRadius.sm,
                overflow: 'hidden',
            }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 1.5,
                        px: 1.5,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.warning.main,
                        }}
                    >
                        Tín hiệu Tiêu cực
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
                            fontWeight: fontWeight.bold,
                            color: theme.palette.warning.main,
                        }}
                    >
                        {sellPositiveCount}/{sellSignalKeys.length}
                    </Typography>
                </Box>
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    py: 0.5,
                    minHeight: 0,
                }}>
                    {sellSignals.map((signal) => (
                        <SignalRow
                            key={signal.key}
                            label={signal.label}
                            value={signal.value}
                            signalType="sell"
                            tooltipText={signal.value === 1 ? (tooltipInfoMet[signal.key] || '') : (tooltipInfoNotMet[signal.key] || '')}
                        />
                    ))}
                </Box>
            </Box>
        </Box>
    );
}
