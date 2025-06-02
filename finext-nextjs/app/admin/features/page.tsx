// finext-nextjs/app/admin/features/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Switch, Grid, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Chip
} from '@mui/material';
import { Category as FeatureIcon, Add as AddIcon, Edit as EditIcon, DeleteOutline as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

// Interface matching FeaturePublic from backend schemas/features.py
interface FeaturePublic {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    // created_at and updated_at might be part of FeatureInDB but exposed via an admin endpoint
    created_at?: string;
    updated_at?: string;
}

interface PaginatedFeaturesResponse {
    items: FeaturePublic[];
    total: number;
}

export default function FeaturesPage() {
    const [features, setFeatures] = useState<FeaturePublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [featureToDelete, setFeatureToDelete] = useState<FeaturePublic | null>(null);


    const fetchFeatures = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Assuming an admin endpoint like /api/v1/features/admin/all or /api/v1/features/
            // The backend router for features needs to be created if it doesn't exist.
            // For now, using a placeholder URL, adjust if your actual endpoint is different.
            const response = await apiClient<PaginatedFeaturesResponse | FeaturePublic[]>({
                url: `/api/v1/features?skip=${page * rowsPerPage}&limit=${rowsPerPage}`, // ADJUST URL AS NEEDED
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                 if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setFeatures(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for features did not return total count. Pagination might be inaccurate.");
                    setFeatures(response.data as FeaturePublic[]);
                    const currentDataLength = (response.data as FeaturePublic[]).length;
                     if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0) );
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                         setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for features.");
                }
            } else {
                setError(response.message || 'Failed to load features.');
                setFeatures([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access. Ensure the API endpoint for features exists.');
            setFeatures([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage]);

    useEffect(() => {
        fetchFeatures();
    }, [fetchFeatures]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    const handleOpenDeleteDialog = (feature: FeaturePublic) => {
        setFeatureToDelete(feature);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setFeatureToDelete(null);
        setOpenDeleteDialog(false);
    };

    const handleDeleteFeature = async () => {
        if (!featureToDelete) return;
        // setLoading(true); // Use a more specific loading state if needed
        try {
            await apiClient({
                url: `/api/v1/features/${featureToDelete.id}`, // Adjust if your delete endpoint is different
                method: 'DELETE',
            });
            fetchFeatures(); // Refresh list
            handleCloseDeleteDialog();
        } catch (delError: any) {
            setError(delError.message || 'Failed to delete feature.');
            handleCloseDeleteDialog();
        } finally {
            // setLoading(false);
        }
    };

    const handleAddFeature = () => console.log("Add feature (not implemented)");
    const handleEditFeature = (featureId: string) => console.log("Edit feature (not implemented):", featureId);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FeatureIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Features</Typography>
                </Box>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchFeatures} disabled={loading} sx={{mr: 1}}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddFeature}>
                        Add Feature
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && features.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Key</TableCell>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Description</TableCell>
                                        {/* Add other relevant columns like created_at, updated_at if available */}
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(features) && features.map((feature) => (
                                        <TableRow hover key={feature.id}>
                                            <TableCell><Chip label={feature.key} size="small" variant="outlined"/></TableCell>
                                            <TableCell>{feature.name}</TableCell>
                                            <TableCell>
                                                <Tooltip title={feature.description || ''}>
                                                    <Typography variant="body2" sx={{maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                        {feature.description || 'N/A'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit Feature">
                                                    <IconButton size="small" onClick={() => handleEditFeature(feature.id)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Feature">
                                                    <IconButton size="small" onClick={() => handleOpenDeleteDialog(feature)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(features) && features.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={4} align="center">No features found.</TableCell></TableRow>
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
            <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete feature <strong>{featureToDelete?.name}</strong> (Key: {featureToDelete?.key})?
                        This action might affect licenses using this feature.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
                    <Button onClick={handleDeleteFeature} color="error" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}