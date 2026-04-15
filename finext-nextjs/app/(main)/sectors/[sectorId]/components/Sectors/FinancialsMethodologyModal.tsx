'use client';

import { Box, Modal, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard } from 'theme/tokens';
import { formatPeriodLabel } from './financials-config';

interface FinancialsMethodologyModalProps {
    open: boolean;
    onClose: () => void;
    industryName: string;
    industryType: string;
    period: string;
    nStocks: number;
}

const AGGREGATION_DESC: Record<string, string> = {
    SXKD:       'Bình quân gia quyền theo Tổng tài sản (BQ.TS)',
    NGANHANG:   'BQ.TS cho hầu hết chỉ số; NIM, YOEA, COF, CIR theo Thu nhập lãi thuần (NII)',
    CHUNGKHOAN: 'Bình quân gia quyền theo Tổng tài sản (BQ.TS)',
    BAOHIEM:    'Bình quân gia quyền theo Tổng tài sản (BQ.TS)',
};

export default function FinancialsMethodologyModal({
    open,
    onClose,
    industryName,
    industryType,
    period,
    nStocks,
}: FinancialsMethodologyModalProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const periodDisplay = period ? formatPeriodLabel(period) : '—';

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: { xs: '92vw', sm: 460 },
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    borderRadius: `${borderRadius.lg}px`,
                    ...getGlassCard(isDark),
                    p: 3,
                    outline: 'none',
                }}
            >
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.semibold }}>
                        Phương pháp tính
                    </Typography>
                    <Box
                        component="button"
                        onClick={onClose}
                        sx={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '20px',
                            lineHeight: 1,
                            fontFamily: 'inherit',
                            color: theme.palette.text.secondary,
                            '&:hover': { color: theme.palette.text.primary },
                        }}
                    >
                        ×
                    </Box>
                </Box>

                {/* Content */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    <InfoRow label="Ngành" value={industryName} />
                    <InfoRow label="Kỳ hiển thị" value={periodDisplay} />
                    <InfoRow label="Số mã trong ngành" value={`${nStocks} mã`} />
                    <InfoRow
                        label="Phương pháp tổng hợp"
                        value={AGGREGATION_DESC[industryType] ?? AGGREGATION_DESC['SXKD']}
                    />
                    <InfoRow label="Nguồn dữ liệu" value="Finet API" />
                    <InfoRow label="Định nghĩa kỳ" value="YYYY_N: N = 1–4 là quý, N = 5 là năm" />
                    <InfoRow label="Ghi chú" value="Các chỉ số dạng % đã được nhân 100 so với giá trị gốc trong DB" />
                    <InfoRow label="Delta" value="So sánh kỳ liền kề (QoQ hoặc YoY tùy chế độ)" />
                </Box>
            </Box>
        </Modal>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    const theme = useTheme();
    return (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    color: theme.palette.text.secondary,
                    minWidth: 150,
                    flexShrink: 0,
                }}
            >
                {label}:
            </Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.primary }}>
                {value}
            </Typography>
        </Box>
    );
}
