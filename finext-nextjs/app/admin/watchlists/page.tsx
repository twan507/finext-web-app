'use client';

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button } from '@mui/material';
import { ListAlt as WatchlistIcon } from '@mui/icons-material';

export default function WatchlistsPage() {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <WatchlistIcon sx={{ mr: 1, fontSize: '24px' }} />
                <Typography variant="h4" component="h1">
                    User Watchlists
                </Typography>
            </Box>

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Watchlist ID</TableCell>
                                <TableCell>User</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Symbols Count</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell>WL-001</TableCell>
                                <TableCell>John Doe</TableCell>
                                <TableCell>My Tech Stocks</TableCell>
                                <TableCell>15</TableCell>
                                <TableCell>2024-01-10</TableCell>
                                <TableCell>
                                    <Button size="small">View</Button>
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
