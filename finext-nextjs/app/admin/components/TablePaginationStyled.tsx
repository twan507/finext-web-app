'use client';

import React from 'react';
import { Box, TablePagination, TablePaginationProps } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';

const defaultRowsPerPageOptions: TablePaginationProps['rowsPerPageOptions'] =
    [5, 10, 25, 50, { label: 'ALL', value: 99999 }];

const defaultLabelRowsPerPage = (
    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        Dòng mỗi trang:
    </Box>
);

const TablePaginationStyled: React.FC<TablePaginationProps> = ({
    rowsPerPageOptions = defaultRowsPerPageOptions,
    labelRowsPerPage = defaultLabelRowsPerPage,
    component = 'div',
    sx: userSx,
    SelectProps: userSelectProps,
    ...rest
}) => {
    return (
        <TablePagination
            component={component}
            rowsPerPageOptions={rowsPerPageOptions}
            labelRowsPerPage={labelRowsPerPage}
            SelectProps={{
                ...userSelectProps,
                sx: {
                    '& .MuiSelect-select.MuiTablePagination-select': {
                        fontSize: getResponsiveFontSize('xs'),
                        minHeight: 0,
                        py: 0.5,
                    },
                    '& .MuiSelect-icon': {
                        fontSize: '1.1rem',
                    },
                    ...(userSelectProps?.sx as object),
                },
                MenuProps: {
                    ...userSelectProps?.MenuProps,
                    PaperProps: {
                        ...userSelectProps?.MenuProps?.PaperProps,
                        sx: {
                            mt: 0.5,
                            borderRadius: 1.5,
                            boxShadow: 3,
                            minWidth: '72px !important',
                            '& .MuiList-root': { py: 0.5 },
                            '& .MuiMenuItem-root': {
                                fontSize: getResponsiveFontSize('xs'),
                                minHeight: 'auto',
                                py: 0.75,
                                px: 1.5,
                                justifyContent: 'center',
                            },
                            ...(userSelectProps?.MenuProps?.PaperProps?.sx as object),
                        },
                    },
                },
            }}
            sx={{
                '& .MuiTablePagination-toolbar': {
                    minHeight: { xs: 48, sm: 52 },
                    px: { xs: 1, sm: 2 },
                },
                '& .MuiTablePagination-selectLabel': {
                    fontSize: getResponsiveFontSize('xs'),
                    margin: 0,
                },
                '& .MuiTablePagination-displayedRows': {
                    fontSize: getResponsiveFontSize('xxs'),
                    margin: 0,
                },
                '& .MuiTablePagination-select': {
                    fontSize: getResponsiveFontSize('xs'),
                },
                '& .MuiTablePagination-actions': {
                    '& .MuiIconButton-root': {
                        padding: { xs: '4px', sm: '8px' },
                    },
                },
                ...userSx,
            }}
            {...rest}
        />
    );
};

export default TablePaginationStyled;
