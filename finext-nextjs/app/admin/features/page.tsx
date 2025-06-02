'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Switch } from '@mui/material';
import { Category as FeatureIcon, Add as AddIcon } from '@mui/icons-material';

export default function FeaturesPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FeatureIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">
                        Features
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />}>
                    Add Feature
                </Button>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Feature ID</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Enabled</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>FEAT-001</TableCell>
                                <TableCell>Real-time Quotes</TableCell>
                                <TableCell>Live market data streaming</TableCell>
                                <TableCell>
                                    <Switch defaultChecked />
                                </TableCell>
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
