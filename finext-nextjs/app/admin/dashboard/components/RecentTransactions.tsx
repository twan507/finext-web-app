'use client';
import React from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Typography, Box, Button, useTheme, alpha,
} from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { RecentTransactionItem, formatCurrency } from '../types';
import { borderRadius, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import Link from 'next/link';

interface Props {
    transactions: RecentTransactionItem[];
}

// Chip size shared style
const chipSx = { fontSize: getResponsiveFontSize('xs'), height: 22, '& .MuiChip-label': { px: 1 } };

function getStatusChip(status: string) {
    switch (status) {
        case 'succeeded':
            // filled — border and background same color
            return <Chip label="Thành công" color="success" size="small" sx={chipSx} />;
        case 'pending':
            return <Chip label="Chờ xử lý" color="warning" size="small" variant="outlined" sx={chipSx} />;
        case 'canceled':
            return <Chip label="Đã hủy" color="error" size="small" variant="outlined" sx={chipSx} />;
        default:
            return <Chip label={status} size="small" variant="outlined" sx={chipSx} />;
    }
}

function getTypeChip(type: string) {
    const label = type === 'new_purchase' ? 'Mới' : type === 'renewal' ? 'Gia hạn' : type;
    const color = type === 'new_purchase' ? 'primary' : 'default';
    return <Chip label={label} color={color as 'primary' | 'default'} size="small" variant="outlined" sx={chipSx} />;
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} ${date}`;
    } catch {
        return dateStr;
    }
}

const cellSx = { py: 1, px: 1.5 };
const headSx = {
    '& th': {
        bgcolor: 'rgba(255,255,255,0.04)',
        fontWeight: 600,
        fontSize: getResponsiveFontSize('xs'),
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        color: 'text.secondary',
        py: 1,
        px: 1.5,
        whiteSpace: 'nowrap' as const,
        borderBottom: '1px solid',
        borderColor: 'divider',
    },
};

const RecentTransactions: React.FC<Props> = ({ transactions }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    if (!transactions.length) {
        return (
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 4 }}>
                Không có giao dịch gần đây
            </Typography>
        );
    }

    return (
        <Box>
            {/* Sub-header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ color: 'text.secondary', fontSize: getResponsiveFontSize('sm') }}>
                    Hiển thị <strong>{transactions.length}</strong> giao dịch gần nhất
                </Typography>
                <Button
                    component={Link}
                    href="/admin/transactions"
                    size="small"
                    endIcon={<OpenInNewIcon sx={{ fontSize: '14px !important' }} />}
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        py: 0.25,
                        px: 1,
                        minWidth: 'auto',
                        borderRadius: `${borderRadius.sm}px`,
                        color: 'primary.main',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                    }}
                >
                    Xem tất cả
                </Button>
            </Box>

            <TableContainer>
                <Table size="small">
                    <TableHead sx={headSx}>
                        <TableRow>
                            <TableCell sx={cellSx}>Email</TableCell>
                            <TableCell align="center" sx={cellSx}>Gói</TableCell>
                            <TableCell align="center" sx={cellSx}>Số tiền</TableCell>
                            <TableCell align="center" sx={cellSx}>Loại</TableCell>
                            <TableCell align="center" sx={cellSx}>Trạng thái</TableCell>
                            <TableCell align="right"  sx={cellSx}>Thời gian</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {transactions.map((tx) => (
                            <TableRow
                                key={tx.id}
                                hover
                                sx={{
                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                                    '&:last-child td': { borderBottom: 0 },
                                }}
                            >
                                {/* Email — left aligned */}
                                <TableCell sx={cellSx}>
                                    <Typography noWrap sx={{ maxWidth: 200, fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium }}>
                                        {tx.buyer_email || '—'}
                                    </Typography>
                                </TableCell>

                                {/* Gói — center */}
                                <TableCell align="center" sx={cellSx}>
                                    <Chip
                                        label={tx.license_key || '—'}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontFamily: 'monospace', ...chipSx }}
                                    />
                                </TableCell>

                                {/* Số tiền — center */}
                                <TableCell align="center" sx={cellSx}>
                                    <Typography sx={{ fontWeight: 700, fontSize: getResponsiveFontSize('sm'), color: 'text.primary', whiteSpace: 'nowrap' }}>
                                        {formatCurrency(tx.transaction_amount)}
                                    </Typography>
                                </TableCell>

                                {/* Loại — center */}
                                <TableCell align="center" sx={cellSx}>
                                    {getTypeChip(tx.transaction_type)}
                                </TableCell>

                                {/* Trạng thái — center */}
                                <TableCell align="center" sx={cellSx}>
                                    {getStatusChip(tx.payment_status)}
                                </TableCell>

                                {/* Thời gian — right */}
                                <TableCell align="right" sx={cellSx}>
                                    <Typography sx={{ color: 'text.secondary', fontSize: getResponsiveFontSize('sm'), whiteSpace: 'nowrap' }}>
                                        {formatDate(tx.created_at)}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default RecentTransactions;
