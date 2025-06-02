'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip } from '@mui/material';
import { VerifiedUser as LicenseIcon, Add as AddIcon } from '@mui/icons-material';

export default function LicensesPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LicenseIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">
                        Licenses
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />}>
                    Add License
                </Button>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>License ID</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Expires</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>LIC-001</TableCell>
                                <TableCell>Premium Trading</TableCell>
                                <TableCell>Annual</TableCell>
                                <TableCell>
                                    <Chip label="Active" color="success" size="small" />
                                </TableCell>
                                <TableCell>2024-12-31</TableCell>
                                <TableCell>
                                    <Button size="small">Edit</Button>
                                    <Button size="small" color="error">Revoke</Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
