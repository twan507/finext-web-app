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
                            ...displayStyle, ...(column.id === 'actions' && {
                                position: 'sticky',
                                right: -1, // Slight negative to eliminate gap
                                backgroundColor: 'background.paper',
                                zIndex: 2,
                                minWidth: expandedView ? 'auto' : 60,
                                width: expandedView ? 'auto' : 60,
                                marginRight: -1, // Pull column to the right
                                paddingRight: 2, // Add padding to compensate
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
                                }
                            })
                        }}
                    >                        {column.sortable ? (<TableSortLabel
                        active={isActive && direction !== null}
                        direction={direction === 'asc' ? 'asc' : direction === 'desc' ? 'desc' : undefined}
                        onClick={createSortHandler(column.id)}
                        sx={{                            // Use default text color, override only when active or hover
                            color: (isActive && direction !== null) ? theme.palette.primary.main : theme.palette.text.primary,
                            '& .MuiTableSortLabel-icon': {
                                fontSize: '0.875rem',
                                opacity: isActive && direction ? 1 : 0,
                                transition: 'opacity 0.15s ease-in-out',
                                marginLeft: '4px',
                                color: theme.palette.component.tableHead.sortIcon,
                            },
                            '&:hover': {
                                color: theme.palette.primary.main,
                                '& .MuiTableSortLabel-icon': {
                                    opacity: 0.6
                                }
                            },
                            '&.Mui-active': {
                                color: theme.palette.primary.main,
                                '& .MuiTableSortLabel-icon': {
                                    color: theme.palette.primary.main,
                                    opacity: 1
                                }
                            },
                            // Ensure color resets properly when not active
                            '&:not(.Mui-active)': {
                                color: theme.palette.text.primary
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
                                color: theme.palette.text.primary
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
