'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button } from '@mui/material';
import { Subscriptions as SubscriptionIcon, Add as AddIcon } from '@mui/icons-material';

export default function SubscriptionsPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SubscriptionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">
                        Subscriptions
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />}>
                    Add Subscription
                </Button>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>User</TableCell>
                                <TableCell>Plan</TableCell>
                                <TableCell>Price</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Expires</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>SUB-001</TableCell>
                                <TableCell>John Doe</TableCell>
                                <TableCell>Premium</TableCell>
                                <TableCell>$99.99/month</TableCell>
                                <TableCell>
                                    <Chip label="Active" color="success" size="small" />
                                </TableCell>
                                <TableCell>2024-02-15</TableCell>
                                <TableCell>
                                    <Button size="small">Edit</Button>
                                    <Button size="small" color="error">Cancel</Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
