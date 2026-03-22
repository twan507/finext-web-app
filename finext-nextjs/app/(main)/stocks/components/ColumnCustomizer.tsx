'use client';

import { useState, useEffect } from 'react';
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
    const [localCols, setLocalCols] = useState<string[]>(selectedColumns);

    // Sync local state when prop changes (e.g. external toggle)
    useEffect(() => {
        setLocalCols(selectedColumns);
    }, [selectedColumns]);

    const handleToggle = (field: string) => {
        const next = localCols.includes(field)
            ? localCols.filter(f => f !== field)
            : [...localCols, field];
        setLocalCols(next);
        onToggleColumn(field);
    };

    const handleSelectAll = (groupKey: string) => {
        const groupFields = ALL_COLUMNS.filter(c => c.group === groupKey).map(c => c.field);
        const allSelected = groupFields.every(f => localCols.includes(f));
        const next = allSelected
            ? localCols.filter(f => !groupFields.includes(f) || f === 'ticker')
            : Array.from(new Set([...localCols, ...groupFields]));
        setLocalCols(next);
        onSetColumns(next);
    };

    const handleReset = () => {
        const defaults = [...TABLE_VIEWS['overview'].fields];
        setLocalCols(defaults);
        onSetColumns(defaults);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: `${borderRadius.lg}px`,
                        maxHeight: '80vh',
                    },
                },
            }}
        >
            <DialogTitle sx={{ fontWeight: fontWeight.bold, fontSize: getResponsiveFontSize('lg'), pb: 0.5 }}>
                Tuỳ chỉnh cột hiển thị
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: getResponsiveFontSize('xxs') }}>
                    Chọn các cột bạn muốn hiển thị trong bảng kết quả
                </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0 }}>
                {COLUMN_GROUPS.map((group, gi) => {
                    const groupCols = ALL_COLUMNS.filter(c => c.group === group.key);
                    if (groupCols.length === 0) return null;

                    const allSelected = groupCols.every(c => localCols.includes(c.field));
                    const someSelected = groupCols.some(c => localCols.includes(c.field));

                    return (
                        <Box key={group.key}>
                            {gi > 0 && <Divider />}
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
                                    ({groupCols.filter(c => localCols.includes(c.field)).length}/{groupCols.length})
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexWrap: 'wrap', px: 2, py: 0.5 }}>
                                {groupCols.map(col => {
                                    const checked = localCols.includes(col.field);
                                    const isRequired = col.field === 'ticker';

                                    return (
                                        <Box
                                            key={col.field}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                width: { xs: '50%', sm: '25%' },
                                                py: 0.25,
                                                cursor: isRequired ? 'not-allowed' : 'pointer',
                                                opacity: isRequired ? 0.6 : 1,
                                            }}
                                            onClick={() => !isRequired && handleToggle(col.field)}
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
                    {localCols.length} cột đã chọn
                </Typography>
                <Button
                    onClick={handleReset}
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
