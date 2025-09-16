'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Box,
    Popover,
    useTheme,
    Tooltip,
    Paper,
    Typography,
    IconButton,
    Stack,
    Divider,
    Slider,
    TextField
} from '@mui/material';
import {
    Palette as PaletteIcon,
    Close as CloseIcon
} from '@mui/icons-material';

interface HSV {
    h: number; // 0-360
    s: number; // 0-100
    v: number; // 0-100
}

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
    label?: string;
    tooltip?: string;
    disabled?: boolean;
    variant?: 'button' | 'square' | 'circle';
}

// ======================================================================
// UTILITY FUNCTIONS (Đã kiểm tra và chuẩn hóa)
// ======================================================================
const hexToHsv = (hex: string): HSV => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;

    if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : Math.round((delta / max) * 100);
    const v = Math.round(max * 100);

    return { h: h >= 360 ? 0 : h, s, v };
};

const hsvToHex = ({ h, s, v }: HSV): string => {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

    const toHex = (val: number) => Math.round((val + m) * 255).toString(16).padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};


// ======================================================================
// COMPONENT
// ======================================================================
const ColorPicker: React.FC<ColorPickerProps> = ({
    value,
    onChange,
    size = 'medium',
    showLabel = false,
    label = 'Màu sắc',
    tooltip = 'Chọn màu',
    disabled = false,
    variant = 'square'
}) => {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [localHsv, setLocalHsv] = useState<HSV>(hexToHsv(value));
    const [hexInput, setHexInput] = useState(value);

    const isOpen = Boolean(anchorEl);

    // **SỬA LỖI LOGIC**: Đồng bộ state nội bộ khi prop `value` từ bên ngoài thay đổi
    useEffect(() => {
        setLocalHsv(hexToHsv(value));
        setHexInput(value);
    }, [value]);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        if (!disabled) {
            setAnchorEl(event.currentTarget);
            setLocalHsv(hexToHsv(value));
            setHexInput(value);
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    // **SỬA LỖI LOGIC**: Đảm bảo luồng dữ liệu nhất quán
    const handleHsvChange = useCallback((newHsv: Partial<HSV>) => {
        const updatedHsv = { ...localHsv, ...newHsv };
        setLocalHsv(updatedHsv);
        const newHex = hsvToHex(updatedHsv);
        setHexInput(newHex);
        onChange(newHex);
    }, [localHsv, onChange]);

    // **TÍNH NĂNG MỚI**: Xử lý nhập liệu từ ô HEX
    const handleHexInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newHex = event.target.value;
        setHexInput(newHex);
        if (/^#[0-9A-Fa-f]{6}$/i.test(newHex)) {
            onChange(newHex.toLowerCase());
        }
    };

    const getSizeConfig = () => {
        switch (size) {
            case 'small':
                return { width: 24, height: 24, borderRadius: variant === 'circle' ? '50%' : '4px' };
            case 'large':
                return { width: 40, height: 40, borderRadius: variant === 'circle' ? '50%' : '6px' };
            default:
                return { width: 32, height: 32, borderRadius: variant === 'circle' ? '50%' : '4px' };
        }
    };

    const sizeConfig = getSizeConfig();

    const renderTrigger = () => {
        // ... (Không thay đổi phần này)
        if (variant === 'button') {
            return (
                <IconButton
                    onClick={handleOpen}
                    disabled={disabled}
                    sx={{
                        width: sizeConfig.width + 8,
                        height: sizeConfig.height + 8,
                        backgroundColor: value,
                        border: `2px solid ${theme.palette.divider}`,
                        borderRadius: '8px',
                        '&:hover': {
                            backgroundColor: value,
                            opacity: 0.8,
                            transform: 'scale(1.05)',
                        },
                        '&:disabled': {
                            opacity: 0.5,
                            cursor: 'not-allowed'
                        },
                        transition: 'all 0.2s ease-in-out',
                    }}
                >
                    <PaletteIcon
                        sx={{
                            color: theme.palette.getContrastText(value),
                            fontSize: size === 'small' ? 16 : size === 'large' ? 24 : 20
                        }}
                    />
                </IconButton>
            );
        }

        return (
            <Box
                onClick={handleOpen}
                sx={{
                    ...sizeConfig,
                    backgroundColor: value,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    border: `2px solid ${theme.palette.divider}`,
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': disabled ? {} : {
                        opacity: 0.8,
                        transform: 'scale(1.05)',
                        boxShadow: theme.shadows[4],
                    },
                    opacity: disabled ? 0.5 : 1,
                    transition: 'all 0.2s ease-in-out',
                }}
            />
        );
    };

    return (
        <>
            <Stack direction="row" alignItems="center" spacing={1}>
                {showLabel && (
                    <Typography variant="body2" color="text.secondary">
                        {label}:
                    </Typography>
                )}
                <Tooltip title={disabled ? '' : tooltip}>
                    <div>{renderTrigger()}</div>
                </Tooltip>
            </Stack>

            <Popover
                open={isOpen}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    elevation: 8,
                    sx: {
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: `1px solid ${theme.palette.divider}`,
                        width: 250
                    }
                }}
            >
                <Paper sx={{ p: 0 }}>
                    {/* Header */}
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ p: 1.5, py: 1 }}
                    >
                        <Typography variant="subtitle2" fontWeight={600}>
                            Chọn màu sắc
                        </Typography>
                        <IconButton size="small" onClick={handleClose}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Stack>

                    <Divider />

                    {/* Color Picker Body */}
                    <Box sx={{ p: 2 }}>
                        {/* Saturation & Value Area */}
                        <Box
                            sx={{
                                width: '100%',
                                height: 150,
                                borderRadius: '6px',
                                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${localHsv.h}, 100%, 50%))`,
                                position: 'relative',
                                cursor: 'crosshair',
                                mb: 1.5,
                            }}
                            onMouseDown={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const handleMouseMove = (event: MouseEvent) => {
                                    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
                                    const y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
                                    handleHsvChange({ s: x * 100, v: y * 100 });
                                };
                                const handleMouseUp = () => {
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                                handleMouseMove(e.nativeEvent as unknown as MouseEvent);
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: `${localHsv.s}%`,
                                    top: `${100 - localHsv.v}%`,
                                    width: 14,
                                    height: 14,
                                    border: '2px solid white',
                                    borderRadius: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: '0 0 2px 1px rgba(0,0,0,0.3)',
                                    pointerEvents: 'none',
                                }}
                            />
                        </Box>

                        {/* Hue Slider */}
                        <Slider
                            value={localHsv.h}
                            onChange={(_, value) => handleHsvChange({ h: value as number })}
                            min={0}
                            max={359}
                            sx={{
                                // **SỬA LỖI GIAO DIỆN**: Kiểm soát chính xác chiều cao
                                padding: '0 !important',
                                height: 10,
                                mb: 2,
                                '& .MuiSlider-rail': {
                                    height: 10,
                                    borderRadius: '5px',
                                    opacity: 1,
                                    background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                                },
                                '& .MuiSlider-track': {
                                    // **SỬA LỖI GIAO DIỆN**: Cho track trong suốt
                                    height: 10,
                                    border: 'none',
                                    background: 'none',
                                },
                                '& .MuiSlider-thumb': {
                                    width: 18,
                                    height: 18,
                                    backgroundColor: `hsl(${localHsv.h}, 100%, 50%)`,
                                    border: `3px solid white`,
                                    boxShadow: '0 0 2px 1px rgba(0,0,0,0.3)',
                                    '&:before': {
                                        display: 'none',
                                    },
                                    '&:hover': {
                                        boxShadow: '0 0 4px 2px rgba(0,0,0,0.4)',
                                    }
                                },
                            }}
                        />

                        {/* HEX Input */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '6px',
                                    backgroundColor: value,
                                    border: `1px solid ${theme.palette.divider}`,
                                    flexShrink: 0,
                                }}
                            />
                            <TextField
                                label="HEX"
                                variant="outlined"
                                value={hexInput.toUpperCase()}
                                onChange={handleHexInputChange}
                                size="small"
                                fullWidth
                                inputProps={{
                                    style: { fontFamily: 'monospace', textTransform: 'uppercase' },
                                    maxLength: 7,
                                }}
                            />
                        </Stack>
                    </Box>
                </Paper>
            </Popover>
        </>
    );
};

export default ColorPicker;