// finext-nextjs/app/admin/licenses/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Switch, Grid, TextField, MenuItem,
    FormControlLabel
} from '@mui/material';
import { VerifiedUser as LicenseIcon, Add as AddIcon, Edit as EditIcon, ToggleOff as DeactivateIcon, Refresh as RefreshIcon, ToggleOn as ActivateIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns'; // Assuming created_at/updated_at might be returned

interface LicensePublic {
    id: string;
    key: string;
    name: string;
    price: number;
    duration_days: number;
    feature_keys: string[];
    is_active: boolean;
    // created_at and updated_at are in LicenseInDB, check if your /api/v1/licenses/ returns them
    created_at?: string;
    updated_at?: string;
}

interface PaginatedLicensesResponse {
    items: LicensePublic[];
    total: number;
}


export default function LicensesPage() {
    const [licenses, setLicenses] = useState<LicensePublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [filterIncludeInactive, setFilterIncludeInactive] = useState(false);


    const fetchLicenses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient<PaginatedLicensesResponse | LicensePublic[]>({
                url: `/api/v1/licenses/?skip=${page * rowsPerPage}&limit=${rowsPerPage}&include_inactive=${filterIncludeInactive}`,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setLicenses(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                     console.warn("Backend for licenses did not return total count. Pagination might be inaccurate.");
                    setLicenses(response.data as LicensePublic[]);
                    const currentDataLength = (response.data as LicensePublic[]).length;
                     if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0) );
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                         setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for licenses.");
                }
            } else {
                setError(response.message || 'Failed to load licenses.');
                setLicenses([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setLicenses([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filterIncludeInactive]);

    useEffect(() => {
        fetchLicenses();
    }, [fetchLicenses]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    const handleToggleActiveStatus = async (license: LicensePublic) => {
        const originalStatus = license.is_active;
        // Optimistic UI update
        setLicenses(prev => prev.map(l => l.id === license.id ? { ...l, is_active: !originalStatus } : l));

        try {
            if (originalStatus) { // If it was active, now deactivating
                await apiClient<LicensePublic>({
                    url: `/api/v1/licenses/${license.id}/deactivate`,
                    method: 'PUT',
                });
            } else { // If it was inactive, now activating (PUT to main update endpoint)
                 await apiClient<LicensePublic>({
                    url: `/api/v1/licenses/${license.id}`,
                    method: 'PUT',
                    body: { is_active: true } // Only send the field to change
                });
            }
            // fetchLicenses(); // Re-fetch to confirm
        } catch (err: any) {
            setError(err.message || `Failed to update status for license ${license.key}.`);
            // Revert UI on error
            setLicenses(prev => prev.map(l => l.id === license.id ? { ...l, is_active: originalStatus } : l));
        }
    };


    const handleAddLicense = () => console.log("Add license (not implemented)");
    const handleEditLicense = (licenseId: string) => console.log("Edit license (not implemented):", licenseId);


    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LicenseIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Licenses</Typography>
                </Box>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchLicenses} disabled={loading} sx={{mr: 1}}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddLicense}>
                        Add License
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid>
                        <FormControlLabel
                            control={<Switch checked={filterIncludeInactive} onChange={(e) => setFilterIncludeInactive(e.target.checked)} />}
                            label="Include Inactive"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && licenses.length === 0 ? (
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
                                        <TableCell>Price</TableCell>
                                        <TableCell>Duration (Days)</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Features Count</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(licenses) && licenses.map((license) => (
                                        <TableRow hover key={license.id}>
                                            <TableCell><Chip label={license.key} size="small" /></TableCell>
                                            <TableCell>{license.name}</TableCell>
                                            <TableCell>${license.price.toFixed(2)}</TableCell>
                                            <TableCell>{license.duration_days}</TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={license.is_active}
                                                    onChange={() => handleToggleActiveStatus(license)}
                                                    size="small"
                                                    color={license.is_active ? "success" : "default"}
                                                />
                                            </TableCell>
                                            <TableCell align="center">{license.feature_keys.length}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit License">
                                                    <IconButton size="small" onClick={() => handleEditLicense(license.id)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                {/* Deactivate is handled by the switch now */}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(licenses) && licenses.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={7} align="center">No licenses found.</TableCell></TableRow>
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
        </Box>
    );
}