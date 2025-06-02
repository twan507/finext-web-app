'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { ReceiptLong as TransactionIcon } from '@mui/icons-material';

export default function TransactionsPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <TransactionIcon sx={{ mr: 1, fontSize: '24px' }} />
                <Typography variant="h4" component="h1">
                    Transactions
                </Typography>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Transaction ID</TableCell>
                                <TableCell>User</TableCell>
                                <TableCell>Amount</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Date</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>TXN-001</TableCell>
                                <TableCell>John Doe</TableCell>
                                <TableCell>$99.99</TableCell>
                                <TableCell>Subscription</TableCell>
                                <TableCell>
                                    <Chip label="Completed" color="success" size="small" />
                                </TableCell>
                                <TableCell>2024-01-15</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
