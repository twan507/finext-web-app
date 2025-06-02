'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button } from '@mui/material';
import { AccountBalanceWallet as BrokerIcon, Add as AddIcon } from '@mui/icons-material';

export default function BrokersPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BrokerIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">
                        Brokers Management
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />}>
                    Add Broker
                </Button>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Broker Name</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Commission</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>1</TableCell>
                                <TableCell>Interactive Brokers</TableCell>
                                <TableCell>Premium</TableCell>
                                <TableCell>Active</TableCell>
                                <TableCell>0.005%</TableCell>
                                <TableCell>
                                    <Button size="small">Edit</Button>
                                    <Button size="small" color="error">Delete</Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
