// finext-nextjs/app/admin/otps/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Grid, TextField, MenuItem
} from '@mui/material';
import { VpnKey as OtpIcon, Refresh as RefreshIcon, Block as InvalidateIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

// Interface matching OtpPublic from backend schemas/otps.py
// Note: OtpPublic doesn't include `hashed_otp_code` or `attempts` for security/privacy.
// Admin view might need a different schema from backend if more details are required.
// For now, using OtpPublic.
enum OtpTypeEnumFE {
    EMAIL_VERIFICATION = "email_verification",
    RESET_PASSWORD = "reset_password",
    PWDLESS_LOGIN = "pwdless_login",
}
interface OtpPublicAdmin {
    id: string;
    user_id: string;
    otp_type: OtpTypeEnumFE;
    expires_at: string; // ISO String
    created_at: string; // ISO String
    verified_at?: string | null; // ISO String or null
    attempts?: number; // For display, if backend provides for admin
    user_email?: string; // Optional, if backend can populate
}

interface PaginatedOtpsResponse {
    items: OtpPublicAdmin[];
    total: number;
}

export default function OtpsPage() {
    const [otps, setOtps] = useState<OtpPublicAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [filterUserId, setFilterUserId] = useState<string>('');
    const [filterOtpType, setFilterOtpType] = useState<OtpTypeEnumFE | ''>('');
    const [filterStatus, setFilterStatus] = useState<'' | 'verified' | 'pending' | 'expired'>('');


    const fetchOtps = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
            };
            if (filterUserId) queryParams.user_id = filterUserId;
            if (filterOtpType) queryParams.otp_type = filterOtpType;
            if (filterStatus) queryParams.status = filterStatus; // Backend needs to support this filter

            // Assumed admin endpoint
            const response = await apiClient<PaginatedOtpsResponse | OtpPublicAdmin[]>({
                url: `/api/v1/otps/admin/all`, // ADJUST URL AS NEEDED
                method: 'GET',
                queryParams,
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setOtps(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for OTPs did not return total count. Pagination might be inaccurate.");
                    setOtps(response.data as OtpPublicAdmin[]);
                    const currentDataLength = (response.data as OtpPublicAdmin[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for OTPs.");
                }
            } else {
                setError(response.message || 'Failed to load OTP records. Ensure the admin endpoint exists.');
                setOtps([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setOtps([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, filterUserId, filterOtpType, filterStatus]);

    useEffect(() => {
        fetchOtps();
    }, [fetchOtps]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleInvalidateOtp = async (otpId: string) => {
        if (window.confirm("Are you sure you want to invalidate this OTP? It will no longer be usable.")) {
            // Admin invalidating an OTP - backend needs an endpoint for this
            // e.g., PUT /api/v1/otps/admin/{otp_id}/invalidate
            console.log("Invalidate OTP (not implemented):", otpId);
            try {
                // await apiClient({ url: `/api/v1/otps/admin/${otpId}/invalidate`, method: 'PUT' });
                // fetchOtps();
                alert("Invalidate action not yet implemented in backend.");
            } catch (err: any) {
                setError(err.message || "Failed to invalidate OTP.");
            }
        }
    };

    const getOtpStatus = (otp: OtpPublicAdmin): { text: string, color: "success" | "warning" | "default" | "error" } => {
        if (otp.verified_at) return { text: 'Verified', color: 'success' };
        if (parseISO(otp.expires_at) < new Date()) return { text: 'Expired', color: 'error' };
        if (otp.attempts && otp.attempts >= 10) return { text: 'Max Attempts', color: 'default' }; // Assuming MAX_OTP_ATTEMPTS is 10
        return { text: 'Pending', color: 'warning' };
    };


    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <OtpIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">OTP Management</Typography>
                </Box>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchOtps} disabled={loading}>
                    Refresh
                </Button>
            </Box>
            <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Filters</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField label="User ID" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} fullWidth size="small" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField select label="OTP Type" value={filterOtpType} onChange={(e) => setFilterOtpType(e.target.value as OtpTypeEnumFE | '')} fullWidth size="small">
                            <MenuItem value=""><em>All</em></MenuItem>
                            {Object.values(OtpTypeEnumFE).map(type => (
                                <MenuItem key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as '' | 'verified' | 'pending' | 'expired')} fullWidth size="small">
                            <MenuItem value=""><em>All</em></MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="verified">Verified</MenuItem>
                            <MenuItem value="expired">Expired</MenuItem>
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && otps.length === 0 ? (
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
                                        <TableCell>Type</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Attempts</TableCell>
                                        <TableCell>Created</TableCell>
                                        <TableCell>Expires</TableCell>
                                        <TableCell>Verified At</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(otps) && otps.map((otp) => {
                                        const status = getOtpStatus(otp);
                                        return (
                                            <TableRow hover key={otp.id}>
                                                <TableCell>
                                                    <Tooltip title={otp.id}>
                                                        <Typography variant="body2" sx={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>...{otp.id.slice(-6)}</Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>{otp.user_email || otp.user_id}</TableCell>
                                                <TableCell><Chip label={otp.otp_type.replace('_', ' ').toUpperCase()} size="small" variant="outlined" /></TableCell>
                                                <TableCell><Chip label={status.text} color={status.color} size="small" /></TableCell>                                                <TableCell align="center">{otp.attempts ?? 'N/A'}</TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        try {
                                                            // Parse UTC date and convert to GMT+7
                                                            const utcDate = parseISO(otp.created_at);
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
                                                            const utcDate = parseISO(otp.expires_at);
                                                            const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                                            return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                                                        } catch (error) {
                                                            return 'Invalid date';
                                                        }
                                                    })()}
                                                </TableCell>
                                                <TableCell>
                                                    {otp.verified_at ? (() => {
                                                        try {
                                                            // Parse UTC date and convert to GMT+7
                                                            const utcDate = parseISO(otp.verified_at);
                                                            const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                                            return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                                                        } catch (error) {
                                                            return 'Invalid date';
                                                        }
                                                    })() : 'N/A'}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {status.text === 'Pending' && (
                                                        <Tooltip title="Invalidate OTP">
                                                            <IconButton size="small" onClick={() => handleInvalidateOtp(otp.id)} color="warning"><InvalidateIcon fontSize="small" /></IconButton>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {Array.isArray(otps) && otps.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={9} align="center">No OTP records found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[10, 25, 50, 100]}
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