'use client';

import React from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Typography, useTheme,
} from '@mui/material';
import { RecentTransactionItem, formatCurrency } from '../types';

interface Props {
    transactions: RecentTransactionItem[];
}

function getStatusChip(status: string) {
    switch (status) {
        case 'succeeded':
            return <Chip label="Thành công" color="success" size="small" variant="outlined" />;
        case 'pending':
            return <Chip label="Chờ xử lý" color="warning" size="small" variant="outlined" />;
        case 'canceled':
            return <Chip label="Đã hủy" color="error" size="small" variant="outlined" />;
        default:
            return <Chip label={status} size="small" variant="outlined" />;
    }
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

const RecentTransactions: React.FC<Props> = ({ transactions }) => {
    const theme = useTheme();

    if (!transactions.length) {
        return (
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 4 }}>
                Không có giao dịch gần đây
            </Typography>
        );
    }

    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Email</TableCell>
                        <TableCell>Gói</TableCell>
                        <TableCell align="right">Số tiền</TableCell>
                        <TableCell>Trạng thái</TableCell>
                        <TableCell>Loại</TableCell>
                        <TableCell>Thời gian</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {transactions.map((tx) => (
                        <TableRow key={tx.id} hover>
                            <TableCell>
                                <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                                    {tx.buyer_email || '—'}
                                </Typography>
                            </TableCell>
                            <TableCell>{tx.license_key || '—'}</TableCell>
                            <TableCell align="right">{formatCurrency(tx.transaction_amount)}</TableCell>
                            <TableCell>{getStatusChip(tx.payment_status)}</TableCell>
                            <TableCell>{tx.transaction_type || '—'}</TableCell>
                            <TableCell>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {formatDate(tx.created_at)}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default RecentTransactions;
