// finext-nextjs/app/admin/watchlists/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Chip, Grid, TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions
} from '@mui/material';
import { ListAlt as WatchlistIcon, Refresh as RefreshIcon, DeleteOutline as DeleteIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

// Interface matching WatchlistPublic from backend schemas/watchlists.py
interface WatchlistPublicAdmin {
    id: string;
    user_id: string; // Assuming admin wants to see this
    name: string;
    stock_symbols: string[];
    created_at: string;
    updated_at: string;
    user_email?: string; // Optional: If backend can populate user email for admin view
}

interface PaginatedWatchlistsResponse {
    items: WatchlistPublicAdmin[];
    total: number;
}

export default function WatchlistsPage() {
    const [watchlists, setWatchlists] = useState<WatchlistPublicAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [filterUserId, setFilterUserId] = useState<string>('');
    const [filterWatchlistName, setFilterWatchlistName] = useState<string>('');

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [watchlistToDelete, setWatchlistToDelete] = useState<WatchlistPublicAdmin | null>(null);

    const fetchWatchlists = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
            };
            if (filterUserId) queryParams.user_id = filterUserId;
            if (filterWatchlistName) queryParams.name_contains = filterWatchlistName; // Assuming backend supports name_contains

            // Assumed admin endpoint
            const response = await apiClient<PaginatedWatchlistsResponse | WatchlistPublicAdmin[]>({
                url: `/api/v1/watchlists/admin/all`, // ADJUST URL AS NEEDED
                method: 'GET',
                queryParams
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setWatchlists(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for watchlists did not return total count. Pagination might be inaccurate.");
                    setWatchlists(response.data as WatchlistPublicAdmin[]);
                    const currentDataLength = (response.data as WatchlistPublicAdmin[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for watchlists.");
                }
            } else {
                setError(response.message || 'Failed to load watchlists. Ensure the admin endpoint exists.');
                setWatchlists([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setWatchlists([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filterUserId, filterWatchlistName]);

    useEffect(() => {
        fetchWatchlists();
    }, [fetchWatchlists]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleOpenDeleteDialog = (watchlist: WatchlistPublicAdmin) => {
        setWatchlistToDelete(watchlist);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setWatchlistToDelete(null);
        setOpenDeleteDialog(false);
    };

    const handleDeleteWatchlist = async () => {
        if (!watchlistToDelete) return;
        // Admin deleting a user's watchlist - requires a specific admin endpoint
        // The current delete endpoint in routers/watchlists.py is for user deleting their own
        // Let's assume an admin delete endpoint: DELETE /api/v1/watchlists/admin/{watchlist_id}
        setLoading(true);
        try {
            await apiClient({
                url: `/api/v1/watchlists/admin/${watchlistToDelete.id}`, // ADJUST URL AS NEEDED
                method: 'DELETE',
            });
            fetchWatchlists();
            handleCloseDeleteDialog();
        } catch (delError: any) {
            setError(delError.message || 'Failed to delete watchlist.');
            handleCloseDeleteDialog();
        } finally {
            setLoading(false);
        }
    };

    const handleViewWatchlist = (watchlistId: string) => console.log("View watchlist details:", watchlistId);


    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WatchlistIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">User Watchlists</Typography>
                </Box>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchWatchlists} disabled={loading}>
                    Refresh
                </Button>
            </Box>

            <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="User ID" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Watchlist Name (contains)" value={filterWatchlistName} onChange={(e) => setFilterWatchlistName(e.target.value)} fullWidth size="small" />
                    </Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && watchlists.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ID</TableCell>
                                        <TableCell>User ID/Email</TableCell>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Symbols Count</TableCell>
                                        <TableCell>Created</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(watchlists) && watchlists.map((watchlist) => (
                                        <TableRow hover key={watchlist.id}>
                                            <TableCell>
                                                <Tooltip title={watchlist.id}>
                                                    <Typography variant="body2" sx={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>...{watchlist.id.slice(-6)}</Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>{watchlist.user_email || watchlist.user_id}</TableCell>
                                            <TableCell>{watchlist.name}</TableCell>
                                            <TableCell align="center"><Chip label={watchlist.stock_symbols.length} size="small" /></TableCell>
                                            <TableCell>{format(parseISO(watchlist.created_at), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="View Details">
                                                    <IconButton size="small" onClick={() => handleViewWatchlist(watchlist.id)}><ViewIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Watchlist">
                                                    <IconButton size="small" onClick={() => handleOpenDeleteDialog(watchlist)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(watchlists) && watchlists.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={6} align="center">No watchlists found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50, { label: 'All', value: 99999 }]}
                            component="div"
                            count={totalCount}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </>
                )}
            </Paper>
            <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete watchlist <strong>{watchlistToDelete?.name}</strong> (ID: {watchlistToDelete?.id.slice(-6)}) for user {watchlistToDelete?.user_id.slice(-6)}?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
                    <Button onClick={handleDeleteWatchlist} color="error" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}