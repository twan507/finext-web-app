// finext-nextjs/app/admin/promotions/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Switch, Grid, TextField, MenuItem
} from '@mui/material';
import { Campaign as PromotionIcon, Add as AddIcon, Edit as EditIcon, ToggleOn as ActivateIcon, ToggleOff as DeactivateIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

enum DiscountTypeEnumFE {
    PERCENTAGE = "percentage",
    FIXED_AMOUNT = "fixed_amount",
}

interface PromotionPublic {
    id: string;
    promotion_code: string;
    description?: string | null;
    discount_type: DiscountTypeEnumFE;
    discount_value: number;
    is_active: boolean;
    start_date?: string | null; // ISO string
    end_date?: string | null;   // ISO string
    usage_limit?: number | null;
    usage_count: number;
    applicable_license_keys?: string[] | null;
    created_at: string; // ISO string
    updated_at: string; // ISO string
}

interface PaginatedPromotionsResponse {
    items: PromotionPublic[];
    total: number;
}

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState<PromotionPublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [filterIsActive, setFilterIsActive] = useState<string>(''); // 'true', 'false', or ''

    const fetchPromotions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
            };
            if (filterIsActive !== '') queryParams.is_active = filterIsActive === 'true';
            
            const response = await apiClient<PaginatedPromotionsResponse | PromotionPublic[]>({
                url: `/api/v1/promotions/`,
                method: 'GET',
                queryParams,
            });

            if (response.status === 200 && response.data) {
                 if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setPromotions(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for promotions did not return total count. Pagination might be inaccurate.");
                    setPromotions(response.data as PromotionPublic[]);
                     const currentDataLength = (response.data as PromotionPublic[]).length;
                     if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0) );
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                         setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for promotions.");
                }
            } else {
                setError(response.message || 'Failed to load promotions.');
                setPromotions([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setPromotions([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filterIsActive]);

    useEffect(() => {
        fetchPromotions();
    }, [fetchPromotions]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleToggleActiveStatus = async (promo: PromotionPublic) => {
        const originalStatus = promo.is_active;
        setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: !originalStatus, updated_at: new Date().toISOString() } : p));

        try {
            if (originalStatus) { // If it was active, now deactivating
                 await apiClient<PromotionPublic>({
                    url: `/api/v1/promotions/${promo.id}/deactivate`,
                    method: 'PUT',
                });
            } else { // If it was inactive, now activating
                await apiClient<PromotionPublic>({
                    url: `/api/v1/promotions/${promo.id}`, // Main update endpoint for activation
                    method: 'PUT',
                    body: { is_active: true }
                });
            }
            // fetchPromotions(); // Or rely on optimistic update
        } catch (err:any) {
            setError(err.message || `Failed to update status for ${promo.promotion_code}.`);
            setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: originalStatus, updated_at: promo.updated_at } : p));
        }
    };

    const handleAddPromotion = () => console.log("Add promotion (not implemented)");
    const handleEditPromotion = (promoId: string) => console.log("Edit promotion (not implemented):", promoId);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PromotionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Promotions</Typography>
                </Box>
                <Box>
                     <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchPromotions} disabled={loading} sx={{mr: 1}}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddPromotion}>
                        Create Promotion
                    </Button>
                </Box>
            </Box>
             <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2}>
                    <Grid size = {{  xs: 12, sm: 4 }}>
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
                 {loading && promotions.length === 0 ? (
                     <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Code</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Discount</TableCell>
                                        <TableCell>Usage (Count/Limit)</TableCell>
                                        <TableCell>Active</TableCell>
                                        <TableCell>Start Date</TableCell>
                                        <TableCell>End Date</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(promotions) && promotions.map((promo) => (
                                        <TableRow hover key={promo.id}>
                                            <TableCell><Chip label={promo.promotion_code} size="small" /></TableCell>
                                            <TableCell>
                                                <Tooltip title={promo.description || ''}>
                                                    <Typography variant="body2" sx={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                        {promo.description || 'N/A'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                {promo.discount_type === DiscountTypeEnumFE.PERCENTAGE
                                                    ? `${promo.discount_value}%`
                                                    : `$${promo.discount_value.toFixed(2)}`}
                                            </TableCell>
                                            <TableCell>{promo.usage_count} / {promo.usage_limit || '∞'}</TableCell>
                                            <TableCell>
                                                <Switch checked={promo.is_active} onChange={() => handleToggleActiveStatus(promo)} size="small" />
                                            </TableCell>
                                            <TableCell>{promo.start_date ? format(parseISO(promo.start_date), 'dd/MM/yy') : 'N/A'}</TableCell>
                                            <TableCell>{promo.end_date ? format(parseISO(promo.end_date), 'dd/MM/yy') : 'N/A'}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit Promotion">
                                                    <IconButton size="small" onClick={() => handleEditPromotion(promo.id)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(promotions) && promotions.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={8} align="center">No promotions found.</TableCell></TableRow>
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