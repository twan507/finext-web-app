'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Chip } from '@mui/material';
import { Campaign as PromotionIcon, Add as AddIcon } from '@mui/icons-material';

export default function PromotionsPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PromotionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">
                        Promotions
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />}>
                    Create Promotion
                </Button>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Discount</TableCell>
                                <TableCell>Code</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Expires</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>PROMO-001</TableCell>
                                <TableCell>New Year Sale</TableCell>
                                <TableCell>20%</TableCell>
                                <TableCell>NEWYEAR2024</TableCell>
                                <TableCell>
                                    <Chip label="Active" color="success" size="small" />
                                </TableCell>
                                <TableCell>2024-01-31</TableCell>
                                <TableCell>
                                    <Button size="small">Edit</Button>
                                    <Button size="small" color="error">Deactivate</Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
