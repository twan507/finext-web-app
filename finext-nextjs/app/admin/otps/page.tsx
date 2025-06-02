'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip } from '@mui/material';
import { VpnKey as OtpIcon } from '@mui/icons-material';

export default function OtpsPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <OtpIcon sx={{ mr: 1, fontSize: '24px' }} />
                <Typography variant="h4" component="h1">
                    OTP Management
                </Typography>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>OTP ID</TableCell>
                                <TableCell>User</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Generated</TableCell>
                                <TableCell>Expires</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>OTP-001</TableCell>
                                <TableCell>John Doe</TableCell>
                                <TableCell>Login</TableCell>
                                <TableCell>
                                    <Chip label="Active" color="warning" size="small" />
                                </TableCell>
                                <TableCell>2024-01-15 10:30</TableCell>
                                <TableCell>2024-01-15 10:35</TableCell>
                                <TableCell>
                                    <Button size="small" color="error">Invalidate</Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
