// finext-nextjs/app/admin/subscriptions/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import {
	Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
	TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
	TablePagination, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useTheme
} from '@mui/material';
import {
	Receipt as SubscriptionIcon,
	Add as AddIcon,
	DoDisturbOn as DeactivateIcon,
	AddCircle as ActivateIcon,
	Delete as DeleteIcon,
	UnfoldMore as ExpandIcon,
	UnfoldLess as CollapseIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { colorTokens, responsiveTypographyTokens } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import SubscriptionSearch from './components/SubscriptionSearch';
import CreateSubscriptionModal from './components/CreateSubscriptionModal';
import {
	SortConfig,
	ColumnConfig,
	sortData,
	getNextSortDirection,
	getResponsiveDisplayStyle
} from '../components/TableSortUtils';

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
	const theme = useTheme();
	const componentColors = theme.palette.mode === 'light'
		? colorTokens.lightComponentColors
		: colorTokens.darkComponentColors;

	const [subscriptions, setSubscriptions] = useState<SubscriptionPublic[]>([]);
	const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionPublic[]>([]);
	const [isFiltering, setIsFiltering] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [totalCount, setTotalCount] = useState(0);    // View and sorting state
	const [expandedView, setExpandedView] = useState(false);
	const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);    // Action dialogs state
	const [actionSubscription, setActionSubscription] = useState<SubscriptionPublic | null>(null);
	const [openDeactivateDialog, setOpenDeactivateDialog] = useState(false);
	const [openActivateDialog, setOpenActivateDialog] = useState(false);

	// Delete Subscription Dialog
	const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
	const [subscriptionToDelete, setSubscriptionToDelete] = useState<SubscriptionPublic | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);

	// Create Subscription Modal
	const [openCreateModal, setOpenCreateModal] = useState(false);// Helper function to calculate remaining days
	const calculateRemainingDays = (expiryDate: string): number => {
		try {
			const utcExpiry = parseISO(expiryDate);
			const gmt7Expiry = new Date(utcExpiry.getTime() + (7 * 60 * 60 * 1000));
			const now = new Date();
			const diffTime = gmt7Expiry.getTime() - now.getTime();
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			return diffDays;
		} catch (error) {
			return 0;
		}
	};

	// Column configuration for sortable table
	const columnConfigs: ColumnConfig[] = useMemo(() => [
		{
			id: 'user_email',
			label: 'Email',
			sortable: true,
			sortType: 'string',
			accessor: (sub: SubscriptionPublic) => sub.user_email,
			minWidth: expandedView ? 'auto' : 150,
		},
		{
			id: 'license_key',
			label: 'License Key',
			sortable: true,
			sortType: 'string',
			accessor: (sub: SubscriptionPublic) => sub.license_key,
			minWidth: expandedView ? 'auto' : 120,
			responsive: { xs: 'none', sm: 'none' }
		},
		{
			id: 'start_date',
			label: 'Ngày bắt đầu',
			sortable: true,
			sortType: 'date',
			accessor: (sub: SubscriptionPublic) => sub.start_date,
			minWidth: expandedView ? 'auto' : 140,
			responsive: { xs: 'none', sm: 'none', md: 'none' },
			format: (value: string) => {
				try {
					const utcDate = parseISO(value);
					const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
					return format(gmt7Date, 'dd/MM/yyyy HH:mm');
				} catch (error) {
					return 'Invalid date';
				}
			},
		},
		{
			id: 'expiry_date',
			label: 'Ngày hết hạn',
			sortable: true,
			sortType: 'date',
			accessor: (sub: SubscriptionPublic) => sub.expiry_date,
			minWidth: expandedView ? 'auto' : 140,
			responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none' },
			format: (value: string) => {
				try {
					const utcDate = parseISO(value);
					const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
					return format(gmt7Date, 'dd/MM/yyyy HH:mm');
				} catch (error) {
					return 'Invalid date';
				}
			},
		},
		{
			id: 'remaining_days',
			label: 'Số ngày còn lại',
			sortable: true,
			sortType: 'number',
			accessor: (sub: SubscriptionPublic) => calculateRemainingDays(sub.expiry_date),
			minWidth: expandedView ? 'auto' : 150,
			// responsive: { xs: 'none' },
			format: (value: number) => {
				if (value > 0) {
					return `${value} ngày`;
				} else if (value === 0) {
					return 'Hết hạn hôm nay';
				} else {
					return `Đã hết hạn ${Math.abs(value)} ngày`;
				}
			},
		},
		{
			id: 'is_active',
			label: 'Trạng thái',
			sortable: true,
			sortType: 'boolean',
			accessor: (sub: SubscriptionPublic) => sub.is_active,
			minWidth: expandedView ? 'auto' : 100,
			responsive: { xs: 'none', sm: 'none' }
		},
		{
			id: 'updated_at',
			label: 'Ngày cập nhật',
			sortable: true,
			sortType: 'date',
			accessor: (sub: SubscriptionPublic) => sub.updated_at,
			minWidth: expandedView ? 'auto' : 140,
			responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' },
			format: (value: string) => {
				try {
					const utcDate = parseISO(value);
					const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
					return format(gmt7Date, 'dd/MM/yyyy HH:mm');
				} catch (error) {
					return 'Invalid date';
				}
			},
		},
		{
			id: 'actions',
			label: '',
			sortable: false,
			sortType: 'string',
			accessor: () => '',
			minWidth: 'auto',
			align: 'center' as const
		}
	], [expandedView]);

	const fetchSubscriptions = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const queryParams: Record<string, any> = {
				skip: page * rowsPerPage,
				limit: rowsPerPage,
			};

			// Add sort parameters if sortConfig is defined
			if (sortConfig && sortConfig.key && sortConfig.direction) {
				queryParams.sort_by = sortConfig.key;
				queryParams.sort_order = sortConfig.direction;
			}

			const response = await apiClient<PaginatedSubscriptionsResponse | SubscriptionPublic[]>({
				url: `/api/v1/subscriptions/admin/all`,
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
	}, [page, rowsPerPage, sortConfig]);

	useEffect(() => {
		fetchSubscriptions();
	}, [fetchSubscriptions]);

	// Update filtered subscriptions when subscriptions change and not actively filtering
	useEffect(() => {
		if (!isFiltering) {
			setFilteredSubscriptions(subscriptions);
		}
	}, [subscriptions, isFiltering]);

	const handleChangePage = (event: unknown, newPage: number) => {
		setPage(newPage);
	};

	const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
		setRowsPerPage(parseInt(event.target.value, 10));
		setPage(0);
	};

	const handleFilteredSubscriptions = (filtered: SubscriptionPublic[], isActivelyFiltering: boolean) => {
		setFilteredSubscriptions(filtered);
		setIsFiltering(isActivelyFiltering);
		// Only reset page when actively switching between filtering states
		if (isActivelyFiltering !== isFiltering) {
			setPage(0);
		}
	};

	// Handle sorting
	const handleSort = (columnKey: string) => {
		const column = columnConfigs.find(col => col.id === columnKey);
		if (!column || !column.sortable) return;

		const newDirection = sortConfig?.key === columnKey
			? getNextSortDirection(sortConfig.direction)
			: 'asc';

		setSortConfig(newDirection ? { key: columnKey, direction: newDirection } : null);
		setPage(0); // Reset to first page when sorting
	};

	// Compute sorted data
	const sortedSubscriptions = useMemo(() => {
		const dataToSort = isFiltering ? filteredSubscriptions : subscriptions;

		if (!sortConfig || !sortConfig.direction) {
			return dataToSort;
		}

		const column = columnConfigs.find(col => col.id === sortConfig.key);
		if (!column) return dataToSort;

		return sortData(dataToSort, sortConfig, column);
	}, [subscriptions, filteredSubscriptions, isFiltering, sortConfig, columnConfigs]);

	// Calculate paginated subscriptions - use client-side pagination when sorting/filtering, server-side pagination otherwise
	const paginatedSubscriptions = useMemo(() => {
		if (isFiltering || sortConfig) {
			// Client-side pagination for filtered/sorted results
			if (rowsPerPage === 99999) {
				// Show all results
				return sortedSubscriptions;
			}
			const startIndex = page * rowsPerPage;
			const endIndex = startIndex + rowsPerPage;
			return sortedSubscriptions.slice(startIndex, endIndex);
		} else {
			// Server-side pagination - use subscriptions directly as they are already paginated
			return subscriptions;
		}
	}, [subscriptions, sortedSubscriptions, isFiltering, sortConfig, page, rowsPerPage]);

	// Calculate total count for pagination
	const displayTotalCount = (isFiltering || sortConfig) ? sortedSubscriptions.length : totalCount; const handleOpenDeactivateDialog = (sub: SubscriptionPublic) => {
		setActionSubscription(sub);
		setOpenDeactivateDialog(true);
	};

	const handleCloseDeactivateDialog = () => {
		setActionSubscription(null);
		setOpenDeactivateDialog(false);
	};

	const handleDeactivateSubscription = async () => {
		if (!actionSubscription) return;
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
		try {
			await apiClient({
				url: `/api/v1/subscriptions/${actionSubscription.id}/activate`,
				method: 'POST',
			});
			fetchSubscriptions();
			handleCloseActivateDialog();
		} catch (err: any) {
			setError(err.message || "Failed to activate subscription.");
			handleCloseActivateDialog();
		}
	};

	const handleAddSubscription = () => {
		setOpenCreateModal(true);
	};

	const handleCloseCreateModal = () => {
		setOpenCreateModal(false);
	}; const handleSubscriptionCreated = () => {
		setOpenCreateModal(false);
		fetchSubscriptions(); // Refresh the subscriptions list
	};

	// Delete Subscription Handler
	const handleOpenDeleteDialog = (sub: SubscriptionPublic) => {
		setSubscriptionToDelete(sub);
		setOpenDeleteDialog(true);
	};

	const handleCloseDeleteDialog = () => {
		setSubscriptionToDelete(null);
		setOpenDeleteDialog(false);
		setDeleteLoading(false);
	};

	const handleDeleteSubscription = async () => {
		if (!subscriptionToDelete) return;

		setDeleteLoading(true);
		setError(null);

		try {
			const response = await apiClient({
				url: `/api/v1/subscriptions/${subscriptionToDelete.id}`,
				method: 'DELETE',
			});

			if (response.status === 200) {
				fetchSubscriptions(); // Refresh list
				handleCloseDeleteDialog();
			} else {
				setError(response.message || 'Không thể xóa subscription.');
			}
		} catch (delError: any) {
			setError(delError.message || 'Lỗi khi xóa subscription. Subscription có thể đang được sử dụng hoặc có license được bảo vệ.');
			handleCloseDeleteDialog();
		} finally {
			setDeleteLoading(false);
		}
	};

	return (
		<Box sx={{
			maxWidth: '100%',
			overflow: 'hidden'
		}}>
			<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<SubscriptionIcon sx={{ mr: 1, fontSize: '24px' }} />
					<Typography
						variant="h3"
						component="h1"
					>
						Quản lý Subscriptions
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', gap: 1 }}>
					<Button
						variant="outlined"
						startIcon={expandedView ? <CollapseIcon /> : <ExpandIcon />}
						onClick={() => setExpandedView(!expandedView)}
						sx={{
							minWidth: { xs: 'auto', sm: 'auto', md: 'auto' },
							'& .MuiButton-startIcon': {
								margin: { xs: 0, sm: 0, md: '0 8px 0 -4px' }
							},
							px: { xs: 1, sm: 2 },
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center'
						}}
					>
						<Box
							component="span"
							sx={{
								display: { xs: 'none', sm: 'none', md: 'inline' }
							}}
						>
							{expandedView ? 'Chế độ thu gọn' : 'Chế độ chi tiết'}
						</Box>
					</Button>
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						onClick={handleAddSubscription}
						sx={{
							minWidth: { xs: 'auto', sm: 'auto', md: 'auto' },
							'& .MuiButton-startIcon': {
								margin: { xs: 0, sm: 0, md: '0 8px 0 -4px' }
							},
							px: { xs: 1, sm: 2 },
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center'
						}}
					>
						<Box
							component="span"
							sx={{
								display: { xs: 'none', sm: 'none', md: 'inline' }
							}}
						>
							Tạo Subscription
						</Box>
					</Button>
				</Box>
			</Box>            {error && (
				<Alert
					severity="error"
					sx={{
						mb: 2,
						...responsiveTypographyTokens.body2,
						'& .MuiAlert-message': {
							overflow: 'hidden',
							textOverflow: 'ellipsis'
						}
					}}
				>
					{error}
				</Alert>
			)}            {/* Search Component */}
			<Box sx={{ mb: 2 }}>
				<SubscriptionSearch
					subscriptions={subscriptions}
					onFilteredSubscriptions={handleFilteredSubscriptions}
				/>
			</Box>

			<Paper sx={{
				width: '100%',
				overflow: 'hidden',
				borderRadius: 2
			}}>
				{loading && subscriptions.length === 0 ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
						<CircularProgress />
					</Box>
				) : (
					<>
						<TableContainer sx={{ overflowX: 'auto' }}>
							<Table sx={{
								tableLayout: 'auto',
								width: '100%'
							}}>
								<SortableTableHead
									columns={columnConfigs}
									sortConfig={sortConfig}
									onSort={handleSort}
									expandedView={expandedView} />
								<TableBody>
									{Array.isArray(paginatedSubscriptions) && paginatedSubscriptions.map((sub) => (
										<TableRow hover key={sub.id}>
											<TableCell sx={{
												...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
												whiteSpace: expandedView ? 'nowrap' : 'normal',
												minWidth: columnConfigs[0].minWidth,
												width: expandedView ? 'auto' : columnConfigs[0].minWidth
											}}>
												<Typography sx={responsiveTypographyTokens.tableCell}>
													{sub.user_email}
												</Typography>                                            </TableCell>
											<TableCell sx={{
												...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
												whiteSpace: expandedView ? 'nowrap' : 'normal',
												minWidth: columnConfigs[1].minWidth,
												width: expandedView ? 'auto' : columnConfigs[1].minWidth
											}}>
												<Chip
													label={sub.license_key}
													size="small"
													variant="outlined"
													sx={{ fontWeight: 'medium' }} />
											</TableCell>
											<TableCell sx={{
												...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
												whiteSpace: expandedView ? 'nowrap' : 'normal',
												minWidth: columnConfigs[2].minWidth,
												width: expandedView ? 'auto' : columnConfigs[2].minWidth
											}}>
												<Typography sx={responsiveTypographyTokens.tableCell}>
													{columnConfigs[2].format?.(sub.start_date)}
												</Typography>                                            </TableCell>
											<TableCell sx={{
												...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
												whiteSpace: expandedView ? 'nowrap' : 'normal',
												minWidth: columnConfigs[3].minWidth,
												width: expandedView ? 'auto' : columnConfigs[3].minWidth
											}}>
												<Typography sx={responsiveTypographyTokens.tableCell}>
													{columnConfigs[3].format?.(sub.expiry_date)}
												</Typography>                                            </TableCell>
											<TableCell sx={{
												...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
												whiteSpace: expandedView ? 'nowrap' : 'normal',
												minWidth: columnConfigs[4].minWidth,
												width: expandedView ? 'auto' : columnConfigs[4].minWidth
											}}>
												{(() => {
													const remainingDays = calculateRemainingDays(sub.expiry_date);
													let textColor: string;

													if (remainingDays > 30) {
														textColor = theme.palette.success.main; // Green for > 30 days
													} else if (remainingDays > 7) {
														textColor = theme.palette.info.main; // Blue for 8-30 days
													} else if (remainingDays > 0) {
														textColor = theme.palette.warning.main; // Orange for 1-7 days
													} else if (remainingDays === 0) {
														textColor = theme.palette.error.main; // Red for expiring today
													} else {
														textColor = theme.palette.error.dark; // Dark red for expired
													}

													return (
														<Typography
															sx={{
																...responsiveTypographyTokens.tableCell,
																color: textColor,
																fontWeight: 'medium'
															}}
														>
															{columnConfigs[4].format?.(remainingDays)}
														</Typography>
													);
												})()}                                            </TableCell>
											<TableCell sx={{
												...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
												whiteSpace: expandedView ? 'nowrap' : 'normal',
												minWidth: columnConfigs[5].minWidth,
												width: expandedView ? 'auto' : columnConfigs[5].minWidth
											}}>
												<Chip
													label={sub.is_active ? 'Hoạt động' : 'Không hoạt động'}
													color={sub.is_active ? 'success' : 'default'}
													size="small"
													variant={sub.is_active ? "filled" : "outlined"}
													sx={{
														fontWeight: 'medium',
														minWidth: '70px'
													}}
												/>                                            </TableCell>
											<TableCell sx={{
												...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
												whiteSpace: expandedView ? 'nowrap' : 'normal',
												minWidth: columnConfigs[6].minWidth,
												width: expandedView ? 'auto' : columnConfigs[6].minWidth
											}}>
												<Typography sx={responsiveTypographyTokens.tableCell}>
													{columnConfigs[6].format?.(sub.updated_at)}
												</Typography>                                            </TableCell>
											<TableCell
												sx={{
													...getResponsiveDisplayStyle(columnConfigs[7], expandedView),
													position: 'sticky',
													right: -1,
													backgroundColor: 'background.paper',
													zIndex: 1,
													borderLeft: '1px solid',
													borderColor: 'divider',
													minWidth: expandedView ? 'auto' : 100,
													width: 'auto',
													'&::before': {
														content: '""',
														position: 'absolute',
														left: 0,
														top: 0,
														bottom: 0,
														width: '1px',
														backgroundColor: 'divider',
														zIndex: 1
													}
												}}
											>                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
													{sub.is_active ? (
														<Tooltip title="Deactivate Subscription">
															<IconButton
																size="small"
																onClick={() => handleOpenDeactivateDialog(sub)}
																color="error"
																sx={{
																	minWidth: { xs: 32, sm: 'auto' },
																	width: { xs: 32, sm: 'auto' },
																	height: { xs: 32, sm: 'auto' }
																}}
															>
																<DeactivateIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													) : (
														<Tooltip title="Activate Subscription">
															<IconButton
																size="small"
																onClick={() => handleOpenActivateDialog(sub)}
																color="success"
																sx={{
																	minWidth: { xs: 32, sm: 'auto' },
																	width: { xs: 32, sm: 'auto' },
																	height: { xs: 32, sm: 'auto' }
																}}
															>
																<ActivateIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													)}                                                    <Tooltip title={sub.is_active ? "Cannot delete active subscription. Deactivate first." : "Delete Subscription"}>
														<span>
															<IconButton
																size="small"
																onClick={() => handleOpenDeleteDialog(sub)}
																color="error"
																disabled={sub.is_active}
																sx={{
																	minWidth: { xs: 32, sm: 'auto' },
																	width: { xs: 32, sm: 'auto' },
																	height: { xs: 32, sm: 'auto' },
																	opacity: sub.is_active ? 0.5 : 1
																}}
															>
																<DeleteIcon fontSize="small" />
															</IconButton>
														</span>
													</Tooltip>
												</Box>
											</TableCell>
										</TableRow>
									))}
									{Array.isArray(paginatedSubscriptions) && paginatedSubscriptions.length === 0 && !loading && (
										<TableRow>
											<TableCell colSpan={8} align="center">
												<Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
													{isFiltering
														? "Không tìm thấy subscription nào phù hợp với tiêu chí tìm kiếm."
														: "Chưa có subscription nào."
													}
												</Typography>
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</TableContainer>
						<TablePagination
							rowsPerPageOptions={[5, 10, 25, 50, { label: 'Tất cả', value: 99999 }]}
							component="div"
							count={displayTotalCount}
							rowsPerPage={rowsPerPage}
							page={page}
							onPageChange={handleChangePage}
							onRowsPerPageChange={handleChangeRowsPerPage}
							labelRowsPerPage={
								<Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
									Dòng mỗi trang:
								</Box>
							}
							sx={{
								'& .MuiTablePagination-toolbar': {
									minHeight: { xs: 48, sm: 52 },
									px: { xs: 1, sm: 2 }
								},
								'& .MuiTablePagination-selectLabel': {
									...responsiveTypographyTokens.tableCellSmall,
									display: { xs: 'none', sm: 'block' }
								},
								'& .MuiTablePagination-displayedRows': {
									...responsiveTypographyTokens.tableCellSmall,
									margin: 0
								}
							}}
						/>
					</>
				)}
			</Paper>			{/* Deactivate Confirmation Dialog */}
			<Dialog 
				open={openDeactivateDialog} 
				onClose={handleCloseDeactivateDialog}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: { borderRadius: 2 }
				}}
			>
				<DialogTitle>
					<Typography variant="h6" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
						<DeactivateIcon />
						Xác nhận hủy kích hoạt subscription
					</Typography>
				</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 2 }}>
						Bạn có chắc chắn muốn hủy kích hoạt subscription này không?
					</DialogContentText>
							{actionSubscription && (
						<Box sx={{
							p: 2,
							bgcolor: componentColors.modal.noteBackground,
							borderRadius: 1,
							border: `1px solid ${componentColors.modal.noteBorder}`,
							mb: 2
						}}>
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
								<Typography variant="body2">
									• <strong>Email:</strong> {actionSubscription.user_email}
								</Typography>
								<Typography variant="body2">
									• <strong>License:</strong> {actionSubscription.license_key}
								</Typography>
								<Typography variant="body2">
									• <strong>Ngày hết hạn:</strong> {new Date(actionSubscription.expiry_date).toLocaleDateString('vi-VN')}
								</Typography>
							</Box>
						</Box>
					)}

					<Box sx={{
						p: 2,
						bgcolor: componentColors.modal.noteBackground,
						borderRadius: 1,
						border: `1px solid ${componentColors.modal.noteBorder}`,
						mb: 2,
						'&::before': {
							content: '""',
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							height: '3px',
							bgcolor: 'warning.main',
							borderRadius: '4px 4px 0 0'
						},
						position: 'relative'
					}}>
						<Typography variant="body2" fontWeight="bold" sx={{ mb: 1, color: 'warning.main' }}>
							⚠️ Lưu ý quan trọng:
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
							• Subscription sẽ được đánh dấu là không hoạt động
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
							• Người dùng sẽ mất quyền truy cập vào các tính năng của license này
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
							• Thao tác này có thể được hoàn tác bằng cách kích hoạt lại
						</Typography>
					</Box>
				</DialogContent>
				<DialogActions sx={{ p: 3, pt: 1 }}>
					<Button
						onClick={handleCloseDeactivateDialog}
						variant="outlined"
						sx={{ minWidth: 100 }}
					>
						Hủy
					</Button>
					<Button 
						onClick={handleDeactivateSubscription} 
						color="error"
						variant="contained"
						sx={{ minWidth: 140 }}
					>
						Xác nhận hủy kích hoạt
					</Button>
				</DialogActions>
			</Dialog>

			{/* Activate Confirmation Dialog */}
			<Dialog 
				open={openActivateDialog} 
				onClose={handleCloseActivateDialog}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: { borderRadius: 2 }
				}}
			>
				<DialogTitle>
					<Typography variant="h6" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
						<ActivateIcon />
						Xác nhận kích hoạt subscription
					</Typography>
				</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 2 }}>
						Bạn có chắc chắn muốn kích hoạt subscription này không?
					</DialogContentText>
							{actionSubscription && (
						<Box sx={{
							p: 2,
							bgcolor: componentColors.modal.noteBackground,
							borderRadius: 1,
							border: `1px solid ${componentColors.modal.noteBorder}`,
							mb: 2
						}}>
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
								<Typography variant="body2">
									• <strong>Email:</strong> {actionSubscription.user_email}
								</Typography>
								<Typography variant="body2">
									• <strong>License:</strong> {actionSubscription.license_key}
								</Typography>
								<Typography variant="body2">
									• <strong>Ngày hết hạn:</strong> {new Date(actionSubscription.expiry_date).toLocaleDateString('vi-VN')}
								</Typography>
							</Box>
						</Box>
					)}

					<Box sx={{
						p: 2,
						bgcolor: componentColors.modal.noteBackground,
						borderRadius: 1,
						border: `1px solid ${componentColors.modal.noteBorder}`,
						mb: 2,
						'&::before': {
							content: '""',
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							height: '3px',
							bgcolor: 'info.main',
							borderRadius: '4px 4px 0 0'
						},
						position: 'relative'
					}}>
						<Typography variant="body2" fontWeight="bold" sx={{ mb: 1, color: 'info.main' }}>
							💡 Lưu ý quan trọng:
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
							• Subscription sẽ được đánh dấu là đang hoạt động
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
							• Người dùng sẽ có quyền truy cập vào các tính năng của license
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
							• Thao tác này có thể hủy kích hoạt các subscription khác của người dùng
						</Typography>
					</Box>
				</DialogContent>
				<DialogActions sx={{ p: 3, pt: 1 }}>
					<Button
						onClick={handleCloseActivateDialog}
						variant="outlined"
						sx={{ minWidth: 100 }}
					>
						Hủy
					</Button>
					<Button 
						onClick={handleActivateSubscription} 
						color="success"
						variant="contained"
						sx={{ minWidth: 140 }}
					>
						Xác nhận kích hoạt
					</Button>
				</DialogActions>
			</Dialog>
			{/* Delete Confirmation Dialog */}
			<Dialog
				open={openDeleteDialog}
				onClose={!deleteLoading ? handleCloseDeleteDialog : undefined}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
					⚠️ Xác nhận xóa subscription
				</DialogTitle>
				<DialogContent>
					{subscriptionToDelete && (<Box sx={{
						p: 2,
						bgcolor: componentColors.modal.noteBackground,
						borderRadius: 1,
						border: '1px solid',
						borderColor: componentColors.modal.noteBorder,
						mb: 2
					}}>
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
							<Box>

								<Typography variant="body2" color="text.secondary" fontWeight="bold">
									Người dùng: {subscriptionToDelete.user_email}
								</Typography>
							</Box>                            <Box>
								<Typography variant="body2" color="text.secondary">
									License: {' '}
									<Chip
										label={subscriptionToDelete.license_key}
										size="small"
										variant="outlined"
										sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
									/>
								</Typography>
							</Box>							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
								<Typography variant="body2" color="text.secondary">
									Trạng thái:
								</Typography>
								<Chip
									label={subscriptionToDelete.is_active ? 'Đang hoạt động' : 'Không hoạt động'}
									color={subscriptionToDelete.is_active ? 'success' : 'default'}
									size="small"
									variant={subscriptionToDelete.is_active ? "filled" : "outlined"}
									sx={{ fontWeight: 'medium' }}
								/>
							</Box>
						</Box>
					</Box>
					)}
					<Box sx={{
						p: 2,
						bgcolor: componentColors.modal.noteBackground,
						borderRadius: 1,
						border: `1px solid ${componentColors.modal.noteBorder}`,
						mb: 2,
						position: 'relative',
						'&::before': {
							content: '""',
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							height: '3px',
							bgcolor: 'error.main',
							borderRadius: '4px 4px 0 0'
						}
					}}>
						<Typography
							variant="body2"
							fontWeight="bold"
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 1,
								color: 'error.main',
								mb: 1
							}}
						>
							⚠️ Cảnh báo quan trọng:
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText, mb: 1 }}>
							• Hành động này không thể hoàn tác
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText, mb: 1 }}>
							• Subscription sẽ bị xóa vĩnh viễn khỏi hệ thống
						</Typography>
						<Typography variant="body2" sx={{ color: componentColors.modal.noteText, mb: 1 }}>
							• Chỉ có thể xóa subscription đã được hủy kích hoạt
						</Typography>
					</Box>
				</DialogContent>
				<DialogActions sx={{ p: 3, pt: 1 }}>
					<Button
						onClick={handleCloseDeleteDialog}
						disabled={deleteLoading}
						variant="outlined"
					>
						Hủy
					</Button>
					<Button
						onClick={handleDeleteSubscription}
						color="error"
						variant="contained"
						disabled={deleteLoading}
						startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
					>
						{deleteLoading ? 'Đang xóa...' : 'Xóa subscription'}
					</Button>
				</DialogActions>
			</Dialog>
			{/* Create Subscription Modal */}
			<CreateSubscriptionModal
				open={openCreateModal}
				onClose={handleCloseCreateModal}
				onSubscriptionCreated={handleSubscriptionCreated}
			/>
		</Box>
	);
}