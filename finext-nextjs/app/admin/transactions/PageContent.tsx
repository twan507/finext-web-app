// finext-nextjs/app/admin/transactions/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import AdminBreadcrumb from '../components/AdminBreadcrumb';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Alert, CircularProgress,
  TablePagination, Tooltip, Button, TextField, MenuItem, useTheme,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import {
  ReceiptLong as TransactionIcon,
  Add as AddIcon,
  PlaylistAddCheckCircle as ConfirmIcon,
  History as HistoryIcon,
  UnfoldMore as ExpandIcon,
  UnfoldLess as CollapseIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { getResponsiveFontSize, borderRadiusTop, fontWeight } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import {
  SortConfig,
  ColumnConfig,
  sortData,
  getNextSortDirection,
  getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import CreateTransactionModal from './components/CreateTransactionModal';
import ConfirmTransactionModal from './components/ConfirmTransactionModal';
import TransactionSearch from './components/TransactionSearch';

enum PaymentStatusEnumFE {
  PENDING = "pending",
  SUCCEEDED = "succeeded",
  CANCELED = "canceled",
}

enum TransactionTypeEnumFE {
  NEW_PURCHASE = "new_purchase",
  RENEWAL = "renewal",
}
interface TransactionPublic {
  id: string;
  buyer_user_id: string;
  license_id: string;
  license_key: string;
  original_license_price: number;
  purchased_duration_days: number;
  promotion_code_applied?: string | null;
  promotion_discount_amount?: number | null;
  broker_code_applied?: string | null;
  broker_discount_amount?: number | null;
  total_discount_amount?: number | null;
  transaction_amount: number;
  payment_status: PaymentStatusEnumFE;
  transaction_type: TransactionTypeEnumFE;
  notes?: string | null;
  target_subscription_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedTransactionsResponse {
  items: TransactionPublic[];
  total: number;
}

export default function TransactionsPage() {
  const theme = useTheme();
  const [transactions, setTransactions] = useState<TransactionPublic[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionPublic[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);// View and sorting state
  const [expandedView, setExpandedView] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // User emails mapping
  const [userEmails, setUserEmails] = useState<Map<string, string>>(new Map());
  const [emailsLoading, setEmailsLoading] = useState(false);  // Add Transaction Modal
  const [openAddTransactionModal, setOpenAddTransactionModal] = useState(false);

  // Confirm Transaction Modal
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  // Dialog states
  const [openNotesDialog, setOpenNotesDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionPublic | null>(null);

  // Delete Transaction Dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionPublic | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);// Column configuration for sortable table
  const columnConfigs: ColumnConfig[] = useMemo(() => [
    {
      id: 'buyer_user_id',
      label: 'Email người dùng',
      sortable: true,
      sortType: 'string',
      accessor: (transaction: TransactionPublic) => transaction.buyer_user_id,
      minWidth: expandedView ? 'auto' : 150,
    },
    {
      id: 'license_key',
      label: 'License Key',
      sortable: true,
      sortType: 'string',
      accessor: (transaction: TransactionPublic) => transaction.license_key,
      minWidth: expandedView ? 'auto' : 120,
      responsive: { xs: 'none' }
    },
    {
      id: 'purchased_duration_days',
      label: 'Số ngày',
      sortable: true,
      sortType: 'number',
      accessor: (transaction: TransactionPublic) => transaction.purchased_duration_days,
      minWidth: expandedView ? 'auto' : 100,
      responsive: { xs: 'none', sm: 'none', md: 'none' }
    },
    {
      id: 'original_license_price',
      label: 'Giá gốc',
      sortable: true,
      sortType: 'number',
      accessor: (transaction: TransactionPublic) => transaction.original_license_price,
      minWidth: expandedView ? 'auto' : 100,
      format: (value: number) => `${value.toLocaleString('vi-VN')}`,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }
    },
    {
      id: 'total_discount_amount',
      label: 'Tổng Giảm Giá',
      sortable: true,
      sortType: 'number',
      accessor: (transaction: TransactionPublic) => transaction.total_discount_amount || 0,
      minWidth: expandedView ? 'auto' : 100,
      format: (value: number) => `${value.toLocaleString('vi-VN')}`,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }
    },
    {
      id: 'transaction_amount',
      label: 'Giá Trị Giao Dịch',
      sortable: true,
      sortType: 'number',
      accessor: (transaction: TransactionPublic) => transaction.transaction_amount,
      minWidth: expandedView ? 'auto' : 140,
      format: (value: number) => `${value.toLocaleString('vi-VN')}`,
      responsive: { xs: 'none', sm: 'none' }
    },
    {
      id: 'transaction_type',
      label: 'Loại Giao Dịch',
      sortable: true,
      sortType: 'string',
      accessor: (transaction: TransactionPublic) => transaction.transaction_type,
      minWidth: expandedView ? 'auto' : 130,
      responsive: { xs: 'none', sm: 'none', md: 'none' }
    },
    {
      id: 'payment_status',
      label: 'Trạng thái',
      sortable: true,
      sortType: 'string',
      accessor: (transaction: TransactionPublic) => transaction.payment_status,
      minWidth: expandedView ? 'auto' : 120
    },
    {
      id: 'created_at',
      label: 'Ngày tạo',
      sortable: true,
      sortType: 'date',
      accessor: (transaction: TransactionPublic) => transaction.created_at,
      minWidth: expandedView ? 'auto' : 120,
      format: (value: string) => {
        try {
          // Parse UTC date and convert to GMT+7
          const utcDate = parseISO(value);
          const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
          return format(gmt7Date, 'dd/MM/yyyy HH:mm');
        } catch (error) {
          return 'Invalid date';
        }
      },
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }
    },
    {
      id: 'broker_code_applied',
      label: 'Mã Broker',
      sortable: true,
      sortType: 'string',
      accessor: (transaction: TransactionPublic) => transaction.broker_code_applied || '',
      minWidth: expandedView ? 'auto' : 120,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }
    },
    {
      id: 'broker_discount_amount',
      label: 'Giảm Giá Broker',
      sortable: true,
      sortType: 'number',
      accessor: (transaction: TransactionPublic) => transaction.broker_discount_amount || 0,
      minWidth: expandedView ? 'auto' : 100,
      format: (value: number) => `${value.toLocaleString('vi-VN')}`,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }
    },
    {
      id: 'promotion_code_applied',
      label: 'Mã Khuyến Mại',
      sortable: true,
      sortType: 'string',
      accessor: (transaction: TransactionPublic) => transaction.promotion_code_applied || '',
      minWidth: expandedView ? 'auto' : 120,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }
    },
    {
      id: 'promotion_discount_amount',
      label: 'Giảm Giá Khuyến Mại',
      sortable: true,
      sortType: 'number',
      accessor: (transaction: TransactionPublic) => transaction.promotion_discount_amount || 0,
      minWidth: expandedView ? 'auto' : 90,
      format: (value: number) => `${value.toLocaleString('vi-VN')}`,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }
    }, {
      id: 'notes',
      label: 'Ghi chú',
      sortable: false,
      sortType: 'string',
      accessor: () => '',
      minWidth: expandedView ? 'auto' : 80,
      align: 'center' as const,
      responsive: { xs: 'none', sm: 'none', md: 'none' }
    },
    {
      id: 'delete',
      label: 'Xóa',
      sortable: false,
      sortType: 'string',
      accessor: () => '',
      minWidth: expandedView ? 'auto' : 60,
      align: 'center' as const,
      responsive: { xs: 'none', sm: 'none', md: 'none' }
    },
    {
      id: 'actions',
      label: '',
      sortable: false,
      sortType: 'string',
      accessor: () => '',
      minWidth: expandedView ? 'auto' : 60,
      align: 'center' as const
    }
  ], [expandedView]); const fetchTransactions = useCallback(async () => {
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

      const response = await apiClient<PaginatedTransactionsResponse | TransactionPublic[]>({
        url: `/api/v1/transactions/admin/all`,
        method: 'GET',
        queryParams,
      });

      if (response.status === 200 && response.data) {
        if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
          // Handles PaginatedTransactionsResponse { items: [], total: number }
          setTransactions(response.data.items);
          setTotalCount(response.data.total);
        } else if (Array.isArray(response.data)) {
          // Handles direct TransactionPublic[]
          console.warn("Backend for transactions did not return total count. Pagination might be inaccurate.");
          setTransactions(response.data as TransactionPublic[]);
          const currentDataLength = (response.data as TransactionPublic[]).length;
          if (page === 0) {
            setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
          } else if (currentDataLength < rowsPerPage) {
            setTotalCount(page * rowsPerPage + currentDataLength);
          } else {
            setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
          }
        } else {
          throw new Error("Unexpected data structure from API.");
        }
      } else {
        setError(response.message || 'Failed to load transactions.');
        setTransactions([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      setError(err.message || 'Connection error or unauthorized access.');
      setTransactions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, sortConfig]);

  const fetchUserEmails = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;

    setEmailsLoading(true);
    const emailsMap = new Map<string, string>();

    try {
      // Fetch user details for each user_id to get their email
      const emailPromises = userIds.map(async (userId) => {
        try {
          const response = await apiClient<{
            id: string;
            email: string;
            full_name: string;
          }>({
            url: `/api/v1/users/${userId}`,
            method: 'GET',
          });

          if (response.status === 200 && response.data) {
            return { userId, email: response.data.email };
          }
        } catch (err) {
          console.warn(`Failed to load email for user ${userId}`);
        }
        return null;
      });

      const results = await Promise.all(emailPromises);

      results.forEach(result => {
        if (result) {
          emailsMap.set(result.userId, result.email);
        }
      });

      setUserEmails(emailsMap);
    } catch (err: any) {
      console.error('Failed to load user emails:', err.message);
    } finally {
      setEmailsLoading(false);
    }
  }, []); useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Update filtered transactions when transactions change and not actively filtering
  useEffect(() => {
    if (!isFiltering) {
      setFilteredTransactions(transactions);
    }
  }, [transactions, isFiltering]);

  // Fetch user emails when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      const userIds = Array.from(new Set(transactions.map(t => t.buyer_user_id)));
      fetchUserEmails(userIds);
    }
  }, [transactions, fetchUserEmails]); const handleFilteredTransactions = (filtered: TransactionPublic[], isActivelyFiltering: boolean) => {
    setFilteredTransactions(filtered);
    setIsFiltering(isActivelyFiltering);
    // Only reset page when actively switching between filtering states
    if (isActivelyFiltering !== isFiltering) {
      setPage(0);
    }
  };

  // Sort data when sortConfig changes
  const sortedTransactions = useMemo(() => {
    const dataToSort = isFiltering ? filteredTransactions : transactions;

    if (!sortConfig || !sortConfig.direction) {
      return dataToSort;
    }

    const column = columnConfigs.find(col => col.id === sortConfig.key);
    if (!column) return dataToSort;

    return sortData(dataToSort, sortConfig, column);
  }, [transactions, filteredTransactions, isFiltering, sortConfig, columnConfigs]);    // Calculate paginated transactions - use client-side pagination when sorting/filtering, server-side pagination otherwise
  const paginatedTransactions = useMemo(() => {
    if (isFiltering || sortConfig) {
      // Client-side pagination for filtered/sorted results
      if (rowsPerPage === 99999) {
        // Show all results
        return sortedTransactions;
      }
      const startIndex = page * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      return sortedTransactions.slice(startIndex, endIndex);
    } else {
      // Server-side pagination - use transactions directly as they are already paginated
      return transactions;
    }
  }, [transactions, sortedTransactions, isFiltering, sortConfig, page, rowsPerPage]);

  // Calculate total count for pagination
  const displayTotalCount = (isFiltering || sortConfig) ? sortedTransactions.length : totalCount; const handleSort = (columnKey: string) => {
    const column = columnConfigs.find(col => col.id === columnKey);
    if (!column?.sortable) return;

    setSortConfig(prevConfig => {
      const currentDirection = prevConfig?.key === columnKey ? prevConfig.direction : null;
      const nextDirection = getNextSortDirection(currentDirection);

      return nextDirection ? { key: columnKey, direction: nextDirection } : null;
    });
    setPage(0); // Reset to first page when sorting
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }; const handleAddTransaction = () => {
    setOpenAddTransactionModal(true);
  }; const handleConfirmPayment = (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      setSelectedTransaction(transaction);
      setOpenConfirmModal(true);
    }
  };
  const handleViewNotesHistory = (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      setSelectedTransaction(transaction);
      setOpenNotesDialog(true);
    }
  };

  const handleCloseNotesDialog = () => {
    setOpenNotesDialog(false);
    setSelectedTransaction(null);
  };

  // New modal handlers
  const handleCloseConfirmModal = () => {
    setOpenConfirmModal(false);
    setSelectedTransaction(null);
  };
  const handleConfirmModalSubmit = async () => {
    // This will be handled by the modal itself
    fetchTransactions();
    handleCloseConfirmModal();
  };

  // Delete transaction handlers
  const handleOpenDeleteDialog = (transaction: TransactionPublic) => {
    setTransactionToDelete(transaction);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setTransactionToDelete(null);
    setOpenDeleteDialog(false);
    setDeleteLoading(false);
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    setDeleteLoading(true);
    setError(null);

    try {
      const response = await apiClient({
        url: `/api/v1/transactions/admin/${transactionToDelete.id}`,
        method: 'DELETE',
      });

      if (response.status === 200) {
        fetchTransactions(); // Refresh list
        handleCloseDeleteDialog();
      } else {
        setError(response.message || 'Không thể xóa giao dịch.');
      }
    } catch (delError: any) {
      setError(delError.message || 'Lỗi khi xóa giao dịch. Giao dịch có thể đang được sử dụng bởi subscription đang hoạt động.');
      handleCloseDeleteDialog();
    } finally {
      setDeleteLoading(false);
    }
  };

  const getPaymentStatusChipColor = (status: PaymentStatusEnumFE): "success" | "warning" | "default" | "error" => {
    switch (status) {
      case PaymentStatusEnumFE.SUCCEEDED: return "success";
      case PaymentStatusEnumFE.PENDING: return "warning";
      case PaymentStatusEnumFE.CANCELED: return "error";
      default: return "default";
    }
  };

  return (
    <Box>
      {/* Breadcrumb */}
      <AdminBreadcrumb />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TransactionIcon sx={{ mr: 1, fontSize: 24 }} />
          <Typography variant="h3" component="h1">Transactions</Typography>
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
            onClick={handleAddTransaction}
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
              Tạo Transaction
            </Box>          </Button>
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TransactionSearch
        transactions={transactions}
        onFilteredTransactions={handleFilteredTransactions}
        loading={loading}
        userEmails={userEmails}
      /><Paper sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 2
      }}>
        {loading && transactions.length === 0 ? (
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
                  expandedView={expandedView}
                />
                <TableBody>
                  {Array.isArray(paginatedTransactions) && paginatedTransactions.map((transaction) => (
                    <TableRow
                      hover
                      key={transaction.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: theme.palette.component.tableRow.hover
                        }
                      }}
                    >
                      {/* User Email - Index 0 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[0].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[0].minWidth
                      }}>
                        <Typography variant="body2" sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {emailsLoading ? (
                            <CircularProgress size={16} />
                          ) : (
                            userEmails.get(transaction.buyer_user_id) || transaction.buyer_user_id
                          )}
                        </Typography>
                      </TableCell>

                      {/* License Key - Index 1 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[1].minWidth
                      }}>
                        {transaction.license_key ? (
                          <Chip
                            label={transaction.license_key}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontFamily: 'monospace',
                              maxWidth: expandedView ? 'none' : 200,
                              '& .MuiChip-label': {
                                overflow: 'hidden',
                                textOverflow: expandedView ? 'unset' : 'ellipsis',
                                whiteSpace: 'nowrap'
                              }
                            }}
                          />
                        ) : (
                          <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>N/A</Typography>
                        )}
                      </TableCell>
                      {/* Purchased Duration Days - Index 2 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[2].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {transaction.purchased_duration_days} ngày
                        </Typography>
                      </TableCell>

                      {/* Original License Price - Index 3 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[3].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {transaction.original_license_price.toLocaleString('vi-VN')}
                        </Typography>
                      </TableCell>

                      {/* Total Discount Amount - Index 4 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[4].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {(transaction.total_discount_amount || 0).toLocaleString('vi-VN')}
                        </Typography>
                      </TableCell>

                      {/* Transaction Amount - Index 5 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[5].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {transaction.transaction_amount.toLocaleString('vi-VN')}
                        </Typography>
                      </TableCell>

                      {/* Transaction Type - Index 6 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[6].minWidth
                      }}>
                        <Chip
                          label={transaction.transaction_type.replace('_', ' ').toUpperCase()}
                          size="small"
                          variant="outlined"
                          sx={{
                            textTransform: 'uppercase'
                          }}
                        />
                      </TableCell>

                      {/* Payment Status - Index 7 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[7], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[7].minWidth
                      }}>
                        <Chip
                          label={transaction.payment_status.toUpperCase()}
                          size="small"
                          color={getPaymentStatusChipColor(transaction.payment_status as PaymentStatusEnumFE)}
                          sx={{
                            textTransform: 'uppercase'
                          }}
                        />
                      </TableCell>

                      {/* Created At (GMT+7) - Index 8 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[8], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[8].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {(() => {
                            try {
                              // Parse UTC date and convert to GMT+7
                              const utcDate = parseISO(transaction.created_at);
                              const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                              return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                            } catch (error) {
                              return 'Invalid date';
                            }
                          })()}
                        </Typography>
                      </TableCell>

                      {/* Broker Code Applied - Index 9 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[9], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[9].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {transaction.broker_code_applied || '-'}
                        </Typography>
                      </TableCell>

                      {/* Broker Discount Amount - Index 10 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[10], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[10].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {(transaction.broker_discount_amount || 0).toLocaleString('vi-VN')}
                        </Typography>
                      </TableCell>

                      {/* Promotion Code Applied - Index 11 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[11], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[11].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {transaction.promotion_code_applied || '-'}
                        </Typography>
                      </TableCell>

                      {/* Promotion Discount Amount - Index 12 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[12], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[12].minWidth
                      }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                          {(transaction.promotion_discount_amount || 0).toLocaleString('vi-VN')}
                        </Typography>
                      </TableCell>
                      {/* Notes (separate column) - Index 13 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[13], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[13].minWidth
                      }} align="center">
                        <Tooltip title="View Notes History">
                          <IconButton
                            size="small"
                            onClick={() => handleViewNotesHistory(transaction.id)}
                            color="primary"
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>

                      {/* Delete (separate column) - Index 14 */}
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[14], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[14].minWidth
                      }} align="center">
                        <Tooltip title="Delete Transaction">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDeleteDialog(transaction)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>

                      {/* Actions (sticky column) - Index 15 */}
                      <TableCell
                        sx={{
                          ...getResponsiveDisplayStyle(columnConfigs[15], expandedView),
                          position: 'sticky',
                          right: -1, // Slight negative to eliminate gap
                          backgroundColor: 'background.paper',
                          zIndex: 1,
                          width: 'auto',
                          // Ensure border visibility during scroll
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            backgroundColor: 'divider',
                            zIndex: 1
                          },
                          // Apply hover effect when parent row is hovered - synchronized with table row hover color
                          'tr:hover &': {
                            backgroundColor: theme.palette.component.tableRow.hover
                          }
                        }}
                        align="center"
                      >
                        {transaction.payment_status === PaymentStatusEnumFE.PENDING && (
                          <Tooltip title="Confirm Payment Status">
                            <IconButton
                              size="small"
                              onClick={() => handleConfirmPayment(transaction.id)}
                              color="success"
                            >
                              <ConfirmIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {Array.isArray(paginatedTransactions) && paginatedTransactions.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={columnConfigs.length} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          {isFiltering
                            ? "Không tìm thấy giao dịch nào phù hợp với tiêu chí tìm kiếm."
                            : "Chưa có giao dịch nào."
                          }
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50, { label: 'ALL', value: 99999 }]}
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
                  fontSize: getResponsiveFontSize('xxs'),
                  margin: 0
                },
                '& .MuiTablePagination-displayedRows': {
                  fontSize: getResponsiveFontSize('xxs'),
                  margin: 0
                },
                '& .MuiTablePagination-select': {
                  fontSize: getResponsiveFontSize('xxs')
                },
                '& .MuiTablePagination-actions': {
                  '& .MuiIconButton-root': {
                    padding: { xs: '4px', sm: '8px' }
                  }
                }
              }} />
          </>
        )}
      </Paper>      <CreateTransactionModal
        open={openAddTransactionModal} onClose={() => setOpenAddTransactionModal(false)}
        onTransactionAdded={fetchTransactions}
      />      {/* New Confirm Transaction Modal */}
      <ConfirmTransactionModal
        open={openConfirmModal}
        onClose={handleCloseConfirmModal}
        transaction={selectedTransaction}
        onTransactionUpdated={handleConfirmModalSubmit}
        userEmail={selectedTransaction ? userEmails.get(selectedTransaction.buyer_user_id) : undefined}
      />

      {/* View Notes History Dialog */}
      <Dialog
        open={openNotesDialog}
        onClose={handleCloseNotesDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          color: 'primary.main',
          fontWeight: 'bold'
        }}>
          📝 Lịch sử ghi chú giao dịch
        </DialogTitle>
        <DialogContent>
          <Box sx={{
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            minHeight: 100
          }}>
            {selectedTransaction?.notes ? (
              <Typography variant="body2" sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6
              }}>
                {selectedTransaction.notes}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Không có ghi chú nào cho giao dịch này.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={handleCloseNotesDialog}
            variant="contained"
          >
            Đóng
          </Button>        </DialogActions>
      </Dialog>      {/* Delete Transaction Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={!deleteLoading ? handleCloseDeleteDialog : undefined}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
          ⚠️ Xác nhận xóa giao dịch
        </DialogTitle>
        <DialogContent>
          {transactionToDelete && (
            <>              <Box sx={{
              p: 1.5,
              bgcolor: theme.palette.component.modal.noteBackground,
              borderRadius: 1,
              mb: 2,
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 'bold' }}>
                Email: {userEmails.get(transactionToDelete.buyer_user_id) || transactionToDelete.buyer_user_id}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Số tiền: {transactionToDelete.transaction_amount.toLocaleString('vi-VN')} VND
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Trạng thái:
                </Typography>
                <Chip
                  label={transactionToDelete.payment_status.toUpperCase()}
                  size="small"
                  color={getPaymentStatusChipColor(transactionToDelete.payment_status as PaymentStatusEnumFE)}
                  sx={{
                    textTransform: 'uppercase'
                  }}
                />
              </Box>
            </Box>

              <Box sx={{
                mb: 3,
                p: 2,
                bgcolor: theme.palette.component.modal.noteBackground,
                borderRadius: 1,
                border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  bgcolor: 'error.main',
                  borderRadius: borderRadiusTop('sm')
                },
                position: 'relative'
              }}>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: 'error.main',
                    mb: 2
                  }}
                >
                  ⚠️ Cảnh báo quan trọng:
                </Typography>

                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                  • Hành động này không thể hoàn tác
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                  • Chỉ có thể xóa giao dịch không liên kết với subscription đang hoạt động
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                  • Dữ liệu giao dịch sẽ bị mất vĩnh viễn
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                  • Việc xóa có thể ảnh hưởng đến báo cáo và thống kê hệ thống
                </Typography>
              </Box>
            </>
          )}
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
            onClick={handleDeleteTransaction}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
          >
            {deleteLoading ? 'Đang xóa...' : 'Xóa giao dịch'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}