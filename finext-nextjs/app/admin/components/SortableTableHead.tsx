'use client';

import React from 'react';
import {
    TableHead,
    TableRow,
    TableCell,
    TableSortLabel,
    Box,
    Typography,
    useTheme
} from '@mui/material';
import { SortDirection, ColumnConfig, getResponsiveDisplayStyle } from './TableSortUtils';
import { colorTokens } from '../../../theme/tokens';

interface SortableTableHeadProps {
    columns: ColumnConfig[];
    sortConfig: { key: string; direction: SortDirection } | null;
    onSort: (columnKey: string) => void;
    expandedView?: boolean;
}

const SortableTableHead: React.FC<SortableTableHeadProps> = ({
    columns,
    sortConfig,
    onSort,
    expandedView = false
}) => {
    const theme = useTheme();
    const colors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const createSortHandler = (columnKey: string) => () => {
        onSort(columnKey);
    };

    return (
        <TableHead>
            <TableRow>
                {columns.map((column) => {
                    const isActive = sortConfig?.key === column.id;
                    const direction = isActive ? sortConfig.direction : null;
                    // Apply responsive display logic
                    const displayStyle = getResponsiveDisplayStyle(column, expandedView);

                    return (<TableCell
                        key={column.id}
                        align={column.align || 'left'}
                        sx={{
                            minWidth: column.minWidth || 'auto',
                            width: expandedView ? 'auto' : (column.minWidth || 'auto'),
                            whiteSpace: expandedView ? 'nowrap' : 'normal',
                            ...displayStyle,
                            ...(column.id === 'actions' && {
                                position: 'sticky',
                                right: 0,
                                backgroundColor: 'background.paper',
                                zIndex: 1,
                                borderLeft: '1px solid',
                                borderColor: 'divider'
                            })
                        }}
                    >                        {column.sortable ? (<TableSortLabel
                        active={isActive && direction !== null}
                        direction={direction === 'asc' ? 'asc' : direction === 'desc' ? 'desc' : undefined}
                        onClick={createSortHandler(column.id)}
                        sx={{
                            // Use default text color, override only when active or hover
                            color: (isActive && direction !== null) ? colors.tableHead.sortActive : colors.tableHead.text,
                            '& .MuiTableSortLabel-icon': {
                                fontSize: '0.875rem',
                                opacity: isActive && direction ? 1 : 0,
                                transition: 'opacity 0.15s ease-in-out',
                                marginLeft: '4px',
                                color: colors.tableHead.sortIcon,
                            },
                            '&:hover': {
                                color: colors.tableHead.sortHover,
                                '& .MuiTableSortLabel-icon': {
                                    opacity: 0.6
                                }
                            },
                            '&.Mui-active': {
                                color: colors.tableHead.sortActive,
                                '& .MuiTableSortLabel-icon': {
                                    color: colors.tableHead.sortActive,
                                    opacity: 1
                                }
                            },
                            // Ensure color resets properly when not active
                            '&:not(.Mui-active)': {
                                color: colors.tableHead.text
                            }
                        }}
                    >                                <Typography
                        variant="subtitle2"
                        component="span"
                        sx={{
                            fontWeight: 600,
                            userSelect: 'none',
                            cursor: 'pointer',
                            color: 'inherit' // Inherit color from parent TableSortLabel
                        }}
                    >
                            {column.label}
                        </Typography>
                    </TableSortLabel>) : (
                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 600,
                                color: colors.tableHead.text
                            }}
                        >
                            {column.label}
                        </Typography>
                    )}
                    </TableCell>
                    );
                })}
            </TableRow>
        </TableHead>
    );
};

export default SortableTableHead;
