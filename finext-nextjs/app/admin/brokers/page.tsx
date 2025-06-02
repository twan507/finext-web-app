// finext-nextjs/app/admin/brokers/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Switch
} from '@mui/material';
import { AccountBalanceWallet as BrokerIcon, Add as AddIcon, Edit as EditIcon, DeleteOutline as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

interface BrokerPublic {
    id: string;
    user_id: string;
    broker_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface PaginatedBrokersResponse {
    items: BrokerPublic[];
    total: number;
}

export default function BrokersPage() {
    const [brokers, setBrokers] = useState<BrokerPublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [openActionDialog, setOpenActionDialog] = useState(false);
    const [brokerToAction, setBrokerToAction] = useState<BrokerPublic | null>(null);
    const [actionType, setActionType] = useState<'deactivate' | 'delete' | ''>(''); // 'delete' now implies deactivation

    const fetchBrokers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient<PaginatedBrokersResponse>({
                url: `/api/v1/brokers/?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
                method: 'GET',
            });
            if (response.status === 200 && response.data &&
                Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                setBrokers(response.data.items);
                setTotalCount(response.data.total);
            } else {
                setError(response.message || 'Failed to load brokers or unexpected data structure.');
                setBrokers([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setBrokers([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage]);

    useEffect(() => {
        fetchBrokers();
    }, [fetchBrokers]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleToggleBrokerStatus = async (broker: BrokerPublic) => {
        const newStatus = !broker.is_active;
        const originalStatus = broker.is_active;
    
        // Optimistic UI update
        setBrokers(prev => prev.map(b => b.id === broker.id ? { ...b, is_active: newStatus, updated_at: new Date().toISOString() } : b));
    
        try {
            await apiClient<BrokerPublic>({
                url: `/api/v1/brokers/${broker.id}`, 
                method: 'PUT',
                body: { is_active: newStatus }
            });
            // fetchBrokers(); // Or rely on optimistic update
        } catch (err: any) {
            setError(err.message || `Failed to update broker ${broker.broker_code} status.`);
            setBrokers(prev => prev.map(b => b.id === broker.id ? { ...b, is_active: originalStatus, updated_at: broker.updated_at } : b));
        }
    };
    
    const handleOpenActionDialog = (broker: BrokerPublic) => {
        // For brokers, "Delete" means deactivating them and revoking privileges as per backend logic
        setBrokerToAction(broker);
        setActionType('deactivate'); // Unified action type for the dialog
        setOpenActionDialog(true);
    };

    const handleCloseActionDialog = () => {
        setBrokerToAction(null);
        setOpenActionDialog(false);
        setActionType('');
    };

    const handleConfirmDeactivateAction = async () => {
        if (!brokerToAction) return;
        // setLoading(true); // Specific loading for this action
        try {
            // The backend DELETE /api/v1/brokers/{broker_id_or_code} actually deactivates and revokes.
            // Or use PUT /api/v1/brokers/{broker_id_or_code} with {is_active: false}
            // Based on router, the DELETE endpoint is for "Hủy tư cách Đối tác (set is_active=False và thu hồi quyền lợi)"
            await apiClient({
                url: `/api/v1/brokers/${brokerToAction.id}`,
                method: 'DELETE', 
            });
            fetchBrokers(); 
            handleCloseActionDialog();
        } catch (delError: any) {
            setError(delError.message || `Failed to deactivate broker.`);
            handleCloseActionDialog();
        } finally {
            // setLoading(false);
        }
    };

    const handleAddBroker = () => console.log("Add broker action (not implemented)");
    const handleEditBroker = (brokerId: string) => console.log("Edit broker action for:", brokerId, " (not implemented)");

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                 <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BrokerIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Brokers Management</Typography>
                </Box>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchBrokers} disabled={loading} sx={{ mr: 1 }}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddBroker}>
                        Add Broker
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                 {loading && brokers.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Broker Code</TableCell>
                                        <TableCell>User ID</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Created At</TableCell>
                                        <TableCell>Updated At</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(brokers) && brokers.map((broker) => (
                                        <TableRow hover key={broker.id}>
                                            <TableCell>
                                                <Chip label={broker.broker_code} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={broker.user_id}>
                                                    <Typography variant="body2" sx={{maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        {broker.user_id}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={broker.is_active}
                                                    onChange={() => handleToggleBrokerStatus(broker)}
                                                    size="small"
                                                    color={broker.is_active ? "success" : "default"}
                                                    disabled={loading}
                                                />
                                                <Typography variant="caption" sx={{ ml: 1 }}>
                                                    {broker.is_active ? 'Active' : 'Inactive'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{format(parseISO(broker.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell>{format(parseISO(broker.updated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit Broker (Not Implemented)">
                                                    <IconButton size="small" onClick={() => handleEditBroker(broker.id)} disabled><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title={broker.is_active ? "Deactivate Broker (Revoke Privileges)" : "Broker is Inactive"}>
                                                    <span> {/* Span for Tooltip when IconButton is disabled */}
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => handleOpenActionDialog(broker)} 
                                                            disabled={!broker.is_active} // Can only "delete" (deactivate) an active broker
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(brokers) && brokers.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">No brokers found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50]}
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
             <Dialog open={openActionDialog} onClose={handleCloseActionDialog}>
                <DialogTitle>Confirm Broker Deactivation</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to deactivate broker <strong>{brokerToAction?.broker_code}</strong> (User ID: {brokerToAction?.user_id})?
                        This will mark the broker as inactive and revoke associated privileges.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseActionDialog}>Cancel</Button>
                    <Button onClick={handleConfirmDeactivateAction} color="error" /* disabled={specificActionLoading} */ >
                         {/* {specificActionLoading ? <CircularProgress size={20} /> : "Confirm Deactivate"} */}
                         Confirm Deactivate
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}