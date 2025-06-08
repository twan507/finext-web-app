// finext-nextjs/app/admin/subscriptions/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, MenuItem, Grid
} from '@mui/material';
import { Subscriptions as SubscriptionIcon, Add as AddIcon, Edit as EditIcon, CancelOutlined as DeactivateIcon, Refresh as RefreshIcon, Visibility as ViewIcon, PlayCircleOutline as ActivateIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

// Interface matching SubscriptionPublic from backend
interface SubscriptionPublic {
    id: string;
    user_id: string;
    user_email: string;
    license_id: string;
    license_key: string;
    is_active: boolean;
    start_date: string;
    expiry_date: string;
    created_at: string;
    updated_at: string;
}

interface PaginatedSubscriptionsResponse {
    items: SubscriptionPublic[];
    total: number;
}

export default function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<SubscriptionPublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [filterUserId, setFilterUserId] = useState<string>('');
    const [filterLicenseKey, setFilterLicenseKey] = useState<string>('');
    const [filterIsActive, setFilterIsActive] = useState<string>(''); // 'true', 'false', or ''

    const [actionSubscription, setActionSubscription] = useState<SubscriptionPublic | null>(null);
    const [openDeactivateDialog, setOpenDeactivateDialog] = useState(false);
    const [openActivateDialog, setOpenActivateDialog] = useState(false);


    const fetchSubscriptions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
            };
            if (filterUserId) queryParams.user_id = filterUserId;
            if (filterLicenseKey) queryParams.license_key = filterLicenseKey;
            if (filterIsActive !== '') queryParams.is_active = filterIsActive === 'true';

            // Assuming an admin endpoint like /api/v1/subscriptions/admin/all
            const response = await apiClient<PaginatedSubscriptionsResponse | SubscriptionPublic[]>({
                url: `/api/v1/subscriptions/admin/all`, // Replace if your admin endpoint is different
                method: 'GET',
                queryParams,
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setSubscriptions(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for subscriptions did not return total count. Pagination might be inaccurate.");
                    setSubscriptions(response.data as SubscriptionPublic[]);
                    const currentDataLength = (response.data as SubscriptionPublic[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for subscriptions.");
                }
            } else {
                setError(response.message || 'Failed to load subscriptions.');
                setSubscriptions([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setSubscriptions([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filterUserId, filterLicenseKey, filterIsActive]);

    useEffect(() => {
        fetchSubscriptions();
    }, [fetchSubscriptions]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleOpenDeactivateDialog = (sub: SubscriptionPublic) => {
        setActionSubscription(sub);
        setOpenDeactivateDialog(true);
    };

    const handleCloseDeactivateDialog = () => {
        setActionSubscription(null);
        setOpenDeactivateDialog(false);
    };

    const handleDeactivateSubscription = async () => {
        if (!actionSubscription) return;
        // setLoading(true); // Use a more specific loading state if needed
        try {
            await apiClient({
                url: `/api/v1/subscriptions/${actionSubscription.id}/deactivate`,
                method: 'PUT',
            });
            fetchSubscriptions();
            handleCloseDeactivateDialog();
        } catch (err: any) {
            setError(err.message || "Failed to deactivate subscription.");
            handleCloseDeactivateDialog();
        } finally {
            // setLoading(false);
        }
    };

    const handleOpenActivateDialog = (sub: SubscriptionPublic) => {
        setActionSubscription(sub);
        setOpenActivateDialog(true);
    };

    const handleCloseActivateDialog = () => {
        setActionSubscription(null);
        setOpenActivateDialog(false);
    };

    const handleActivateSubscription = async () => {
        if (!actionSubscription) return;
        // setLoading(true);
        try {
            await apiClient({
                url: `/api/v1/subscriptions/${actionSubscription.id}/activate`,
                method: 'POST', // As per backend router
            });
            fetchSubscriptions();
            handleCloseActivateDialog();
        } catch (err: any) {
            setError(err.message || "Failed to activate subscription.");
            handleCloseActivateDialog();
        } finally {
            // setLoading(false);
        }
    };

    const handleAddSubscription = () => console.log("Add subscription (not implemented)");
    const handleEditSubscription = (subId: string) => console.log("Edit subscription (not implemented):", subId);


    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SubscriptionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Subscriptions</Typography>
                </Box>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchSubscriptions} disabled={loading} sx={{ mr: 1 }}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddSubscription}>
                        Add Subscription
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField label="User ID" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField label="License Key" value={filterLicenseKey} onChange={(e) => setFilterLicenseKey(e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField select label="Status" value={filterIsActive} onChange={(e) => setFilterIsActive(e.target.value)} fullWidth size="small">
                            <MenuItem value=""><em>All</em></MenuItem>
                            <MenuItem value="true">Active</MenuItem>
                            <MenuItem value="false">Inactive</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && subscriptions.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Sub ID</TableCell>
                                        <TableCell>User Email</TableCell>
                                        <TableCell>License Key</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Start Date</TableCell>
                                        <TableCell>Expiry Date</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(subscriptions) && subscriptions.map((sub) => (
                                        <TableRow hover key={sub.id}>
                                            <TableCell>
                                                <Tooltip title={sub.id}>
                                                    <Typography variant="body2" sx={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>...{sub.id.slice(-6)}</Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>{sub.user_email}</TableCell>
                                            <TableCell><Chip label={sub.license_key} size="small" /></TableCell>                                            <TableCell>
                                                <Chip label={sub.is_active ? 'Active' : 'Inactive'} color={sub.is_active ? 'success' : 'default'} size="small" />
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    try {
                                                        // Parse UTC date and convert to GMT+7
                                                        const utcDate = parseISO(sub.start_date);
                                                        const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                                        return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                                                    } catch (error) {
                                                        return 'Invalid date';
                                                    }
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    try {
                                                        // Parse UTC date and convert to GMT+7
                                                        const utcDate = parseISO(sub.expiry_date);
                                                        const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                                        return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                                                    } catch (error) {
                                                        return 'Invalid date';
                                                    }
                                                })()}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="View/Edit Details">
                                                    <IconButton size="small" onClick={() => handleEditSubscription(sub.id)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                {sub.is_active ? (
                                                    <Tooltip title="Deactivate Subscription">
                                                        <IconButton size="small" onClick={() => handleOpenDeactivateDialog(sub)} color="error"><DeactivateIcon fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="Activate Subscription">
                                                        <IconButton size="small" onClick={() => handleOpenActivateDialog(sub)} color="success"><ActivateIcon fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(subscriptions) && subscriptions.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={7} align="center">No subscriptions found.</TableCell></TableRow>
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

            {/* Deactivate Confirmation Dialog */}
            <Dialog open={openDeactivateDialog} onClose={handleCloseDeactivateDialog}>
                <DialogTitle>Confirm Deactivation</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to deactivate subscription <strong>{actionSubscription?.id.slice(-6)}</strong> for user <strong>{actionSubscription?.user_email}</strong> (License: {actionSubscription?.license_key})?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeactivateDialog}>Cancel</Button>
                    <Button onClick={handleDeactivateSubscription} color="error">Deactivate</Button>
                </DialogActions>
            </Dialog>

            {/* Activate Confirmation Dialog */}
            <Dialog open={openActivateDialog} onClose={handleCloseActivateDialog}>
                <DialogTitle>Confirm Activation</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to activate subscription <strong>{actionSubscription?.id.slice(-6)}</strong> for user <strong>{actionSubscription?.user_email}</strong> (License: {actionSubscription?.license_key})?
                        This might deactivate other active subscriptions for the user.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseActivateDialog}>Cancel</Button>
                    <Button onClick={handleActivateSubscription} color="success">Activate</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}