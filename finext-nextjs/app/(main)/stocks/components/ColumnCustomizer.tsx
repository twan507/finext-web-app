'use client';

import { Box, Typography, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions, Button, useTheme, alpha, Divider } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import { ALL_COLUMNS, COLUMN_GROUPS, TABLE_VIEWS } from '../screenerConfig';

interface ColumnCustomizerProps {
    open: boolean;
    onClose: () => void;
    selectedColumns: string[];
    onSetColumns: (columns: string[]) => void;
    onToggleColumn: (field: string) => void;
}

export default function ColumnCustomizer({ open, onClose, selectedColumns, onSetColumns, onToggleColumn }: ColumnCustomizerProps) {
    const theme = useTheme();

    const handleSelectAll = (groupKey: string) => {
        const groupFields = ALL_COLUMNS.filter(c => c.group === groupKey).map(c => c.field);
        const allSelected = groupFields.every(f => selectedColumns.includes(f));
        if (allSelected) {
            // Deselect all group fields (but keep ticker always)
            onSetColumns(selectedColumns.filter(f => !groupFields.includes(f) || f === 'ticker'));
        } else {
            // Select all group fields
            const newCols = new Set([...selectedColumns, ...groupFields]);
            onSetColumns(Array.from(newCols));
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: `${borderRadius.lg}px`,
                    maxHeight: '80vh',
                },
            }}
        >
            <DialogTitle sx={{ fontWeight: fontWeight.bold, fontSize: getResponsiveFontSize('lg') }}>
                Tuỳ chỉnh cột hiển thị
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: getResponsiveFontSize('xs') }}>
                    Chọn các cột bạn muốn hiển thị trong bảng kết quả
                </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0 }}>
                {COLUMN_GROUPS.map((group, gi) => {
                    const groupCols = ALL_COLUMNS.filter(c => c.group === group.key);
                    if (groupCols.length === 0) return null;

                    const allSelected = groupCols.every(c => selectedColumns.includes(c.field));
                    const someSelected = groupCols.some(c => selectedColumns.includes(c.field));

                    return (
                        <Box key={group.key}>
                            {gi > 0 && <Divider />}
                            {/* Group header */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    px: 2,
                                    py: 0.75,
                                    bgcolor: alpha(theme.palette.divider, 0.05),
                                    cursor: 'pointer',
                                }}
                                onClick={() => handleSelectAll(group.key)}
                            >
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    size="small"
                                    sx={{ p: 0.5, mr: 1 }}
                                />
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    fontWeight: fontWeight.bold,
                                    color: 'text.secondary',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}>
                                    {group.label}
                                </Typography>
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xxs'),
                                    color: 'text.disabled',
                                    ml: 1,
                                }}>
                                    ({groupCols.filter(c => selectedColumns.includes(c.field)).length}/{groupCols.length})
                                </Typography>
                            </Box>

                            {/* Columns */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', px: 2, py: 0.5 }}>
                                {groupCols.map(col => {
                                    const checked = selectedColumns.includes(col.field);
                                    const isRequired = col.field === 'ticker'; // Always keep ticker

                                    return (
                                        <Box
                                            key={col.field}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                width: { xs: '50%', sm: '33.33%' },
                                                py: 0.25,
                                                cursor: isRequired ? 'not-allowed' : 'pointer',
                                                opacity: isRequired ? 0.6 : 1,
                                            }}
                                            onClick={() => !isRequired && onToggleColumn(col.field)}
                                        >
                                            <Checkbox
                                                checked={checked}
                                                disabled={isRequired}
                                                size="small"
                                                sx={{ p: 0.25, mr: 0.5 }}
                                            />
                                            <Typography sx={{
                                                fontSize: getResponsiveFontSize('xs'),
                                                color: checked ? 'text.primary' : 'text.secondary',
                                                fontWeight: checked ? fontWeight.medium : undefined,
                                            }}>
                                                {col.label}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    );
                })}
            </DialogContent>

            <DialogActions sx={{ px: 2, py: 1.5 }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', flex: 1 }}>
                    {selectedColumns.length} cột đã chọn
                </Typography>
                <Button
                    onClick={() => onSetColumns([...TABLE_VIEWS['overview'].fields])}
                    size="small"
                    sx={{ fontSize: getResponsiveFontSize('xs') }}
                >
                    Đặt lại
                </Button>
                <Button
                    onClick={onClose}
                    variant="contained"
                    size="small"
                    sx={{ fontSize: getResponsiveFontSize('xs') }}
                >
                    Đóng
                </Button>
            </DialogActions>
        </Dialog>
    );
}
