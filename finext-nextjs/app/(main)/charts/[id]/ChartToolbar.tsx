'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Divider,
    Tooltip,
    InputAdornment,
    useTheme,
    ToggleButtonGroup,
    ToggleButton,
    Paper,
    Typography,
    List,
    ListItemButton,
    ListItemText,
    ClickAwayListener,
    Popper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import IndicatorsIcon from '@mui/icons-material/Insights';
import BarChartIcon from '@mui/icons-material/BarChart';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TuneIcon from '@mui/icons-material/Tune';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { getResponsiveFontSize } from 'theme/tokens';

export interface TickerItem {
    ticker: string;
    ticker_name: string | null;
}

interface ChartToolbarProps {
    ticker: string;
    tickers: TickerItem[];
    chartType?: 'candlestick' | 'line';
    showIndicators?: boolean;
    showVolume?: boolean;
    showLegend?: boolean;
    showIndicatorsPanel?: boolean;
    showWatchlistPanel?: boolean;
    isFullscreen?: boolean;
    onTickerChange?: (ticker: string) => void;
    onChartTypeChange?: (type: 'candlestick' | 'line') => void;
    onToggleIndicators?: () => void;
    onToggleVolume?: () => void;
    onToggleLegend?: () => void;
    onToggleIndicatorsPanel?: () => void;
    onToggleWatchlistPanel?: () => void;
    onToggleFullscreen?: () => void;
}

const MAX_RESULTS = 50;

export default function ChartToolbar({
    ticker,
    tickers,
    chartType = 'candlestick',
    showIndicators = true,
    showVolume = true,
    showLegend = true,
    showIndicatorsPanel = false,
    showWatchlistPanel = false,
    isFullscreen = false,
    onTickerChange,
    onChartTypeChange,
    onToggleIndicators,
    onToggleVolume,
    onToggleLegend,
    onToggleIndicatorsPanel,
    onToggleWatchlistPanel,
    onToggleFullscreen,
}: ChartToolbarProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [searchValue, setSearchValue] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const anchorRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Filter tickers based on search value
    const filteredTickers = useMemo(() => {
        if (!searchValue.trim()) return [];
        const query = searchValue.trim().toLowerCase();
        return tickers
            .filter((t) => {
                const tickerMatch = t.ticker.toLowerCase().startsWith(query);
                const nameMatch = t.ticker_name?.toLowerCase().startsWith(query);
                return tickerMatch || nameMatch;
            })
            .slice(0, MAX_RESULTS);
    }, [searchValue, tickers]);

    // Reset highlight when results change
    useEffect(() => {
        setHighlightIndex(-1);
    }, [filteredTickers.length]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex >= 0 && listRef.current) {
            const items = listRef.current.querySelectorAll('[role="option"]');
            items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightIndex]);

    const handleSelectTicker = useCallback(
        (selectedTicker: string) => {
            setSearchValue('');
            setIsSearchOpen(false);
            setHighlightIndex(-1);
            if (selectedTicker !== ticker && onTickerChange) {
                onTickerChange(selectedTicker);
            }
        },
        [ticker, onTickerChange],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!isSearchOpen || filteredTickers.length === 0) {
                if (e.key === 'Enter' && searchValue.trim()) {
                    // Try exact match
                    const exact = tickers.find(
                        (t) => t.ticker.toLowerCase() === searchValue.trim().toLowerCase(),
                    );
                    if (exact) handleSelectTicker(exact.ticker);
                }
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightIndex((prev) =>
                        prev < filteredTickers.length - 1 ? prev + 1 : 0,
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightIndex((prev) =>
                        prev > 0 ? prev - 1 : filteredTickers.length - 1,
                    );
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightIndex >= 0 && highlightIndex < filteredTickers.length) {
                        handleSelectTicker(filteredTickers[highlightIndex].ticker);
                    } else if (filteredTickers.length > 0) {
                        handleSelectTicker(filteredTickers[0].ticker);
                    }
                    break;
                case 'Escape':
                    setIsSearchOpen(false);
                    setSearchValue('');
                    setHighlightIndex(-1);
                    break;
            }
        },
        [isSearchOpen, filteredTickers, highlightIndex, searchValue, tickers, handleSelectTicker],
    );

    const showDropdown = isSearchOpen && filteredTickers.length > 0;

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                py: 0.5,
                borderBottom: 1,
                borderColor: 'divider',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(8px)',
                flexShrink: 0,
                overflow: 'hidden',
            }}
        >
            {/* Left fixed group: Search + Chart Type */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                {/* Search Ticker with Autocomplete */}
                <ClickAwayListener onClickAway={() => { setIsSearchOpen(false); setHighlightIndex(-1); setSearchValue(''); }}>
                    <Box sx={{ position: 'relative' }} ref={anchorRef}>
                        <TextField
                            size="small"
                            placeholder={ticker}
                            value={searchValue}
                            onChange={(e) => {
                                setSearchValue(e.target.value);
                                setIsSearchOpen(true);
                            }}
                            onFocus={() => {
                                if (searchValue.trim()) setIsSearchOpen(true);
                            }}
                            onKeyDown={handleKeyDown}
                            autoComplete="off"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                width: 110,
                                '& .MuiOutlinedInput-root': {
                                    fontSize: getResponsiveFontSize('xs'),
                                    height: 32,
                                    pl: 0,
                                    pr: 0,
                                    '& fieldset': {
                                        border: 'none',
                                    },
                                },
                                '& .MuiInputBase-input': {
                                    pr: 0,
                                },
                                '& .MuiInputBase-input::placeholder': {
                                    fontWeight: 600,
                                    opacity: 0.8,
                                },
                                '& .MuiInputBase-input:focus::placeholder': {
                                    opacity: 0.5,
                                },
                            }}
                        />
                        <Popper
                            open={showDropdown}
                            anchorEl={anchorRef.current}
                            placement="bottom-start"
                            style={{ zIndex: 1300 }}
                            modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
                        >
                            <Paper
                                elevation={0}
                                sx={{
                                    width: 280,
                                    maxHeight: 320,
                                    overflow: 'auto',
                                    border: 1,
                                    borderColor: 'divider',
                                    bgcolor: isDark
                                        ? 'rgba(30, 30, 30, 0.8)'
                                        : 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(8px)',
                                }}
                            >
                                <List dense disablePadding ref={listRef} role="listbox">
                                    {filteredTickers.map((item, idx) => {
                                        const isHighlighted = idx === highlightIndex;
                                        const isActive = item.ticker === ticker;
                                        return (
                                            <ListItemButton
                                                key={item.ticker}
                                                role="option"
                                                selected={isHighlighted}
                                                onClick={() => handleSelectTicker(item.ticker)}
                                                sx={{
                                                    py: 0.5,
                                                    px: 1.5,
                                                    '&.Mui-selected': {
                                                        bgcolor: isDark
                                                            ? 'rgba(255,255,255,0.08)'
                                                            : 'rgba(0,0,0,0.04)',
                                                    },
                                                }}
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography
                                                                sx={{
                                                                    fontSize: getResponsiveFontSize('sm'),
                                                                    fontWeight: isActive ? 700 : 600,
                                                                    color: isActive
                                                                        ? 'primary.main'
                                                                        : 'text.primary',
                                                                }}
                                                            >
                                                                {item.ticker}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary={
                                                        item.ticker_name && (
                                                            <Typography
                                                                sx={{
                                                                    fontSize: getResponsiveFontSize('xs'),
                                                                    color: 'text.secondary',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {item.ticker_name}
                                                            </Typography>
                                                        )
                                                    }
                                                />
                                            </ListItemButton>
                                        );
                                    })}
                                </List>
                            </Paper>
                        </Popper>
                    </Box>
                </ClickAwayListener>

                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

                {/* Chart Type Toggle */}
                <ToggleButtonGroup
                    value={chartType}
                    exclusive
                    onChange={(e, newType) => {
                        if (newType && onChartTypeChange) {
                            onChartTypeChange(newType);
                        }
                    }}
                    size="small"
                    sx={{
                        height: 32,
                        '& .MuiToggleButton-root': {
                            p: 0.5,
                            border: 'none',
                            borderRadius: 0,
                            fontSize: getResponsiveFontSize('xs'),
                            color: 'text.secondary',
                            backgroundColor: 'transparent',
                            '&.Mui-selected': {
                                color: 'primary.main',
                                backgroundColor: 'transparent',
                                '&:hover': {
                                    backgroundColor: 'transparent',
                                },
                            },
                            '&:hover': {
                                backgroundColor: 'transparent',
                            },
                        },
                    }}
                >
                    <ToggleButton value="candlestick">
                        <Tooltip title="Biểu đồ nến">
                            <CandlestickChartIcon fontSize="small" />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="line">
                        <Tooltip title="Biểu đồ đường">
                            <ShowChartIcon fontSize="small" />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ my: 0.5, mx: 0.5, flexShrink: 0 }} />

            {/* Middle scrollable group: Toggle Buttons */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flex: 1,
                    minWidth: 0,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                }}
            >
                <Tooltip title={showIndicators ? "Ẩn chỉ báo" : "Hiện chỉ báo"}>
                    <IconButton
                        size="small"
                        onClick={onToggleIndicators}
                        sx={{
                            p: 0.5,
                            color: showIndicators ? 'primary.main' : 'text.secondary',
                            borderRadius: 0,
                            flexShrink: 0,
                            '&:hover': {
                                color: 'primary.main',
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        <IndicatorsIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <Tooltip title={showVolume ? "Ẩn khối lượng" : "Hiện khối lượng"}>
                    <IconButton
                        size="small"
                        onClick={onToggleVolume}
                        sx={{
                            p: 0.5,
                            color: showVolume ? 'primary.main' : 'text.secondary',
                            borderRadius: 0,
                            flexShrink: 0,
                            '&:hover': {
                                color: 'primary.main',
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        <BarChartIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <Tooltip title={showLegend ? "Ẩn chú thích" : "Hiện chú thích"}>
                    <IconButton
                        size="small"
                        onClick={onToggleLegend}
                        sx={{
                            p: 0.5,
                            color: showLegend ? 'primary.main' : 'text.secondary',
                            borderRadius: 0,
                            flexShrink: 0,
                            '&:hover': {
                                color: 'primary.main',
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        <TextFieldsIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ my: 0.5, mx: 0.5, flexShrink: 0 }} />

            {/* Right fixed group: Indicators Panel + Watchlist Panel */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                {/* Indicators Panel */}
                <Tooltip title={showIndicatorsPanel ? "Ẩn các chỉ báo" : "Hiện các chỉ báo"}>
                    <IconButton
                        size="small"
                        onClick={onToggleIndicatorsPanel}
                        sx={{
                            p: 0.5,
                            color: showIndicatorsPanel ? 'primary.main' : 'text.secondary',
                            borderRadius: 0,
                            '&:hover': {
                                color: 'primary.main',
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        <TuneIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                {/* Watchlist Panel */}
                <Tooltip title={showWatchlistPanel ? "Ẩn Watchlist" : "Hiện Watchlist"}>
                    <IconButton
                        size="small"
                        onClick={onToggleWatchlistPanel}
                        sx={{
                            p: 0.5,
                            color: showWatchlistPanel ? 'primary.main' : 'text.secondary',
                            borderRadius: 0,
                            '&:hover': {
                                color: 'primary.main',
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        <FormatListBulletedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                {/* Fullscreen button */}
                <Tooltip title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}>
                    <IconButton
                        size="small"
                        onClick={onToggleFullscreen}
                        sx={{
                            p: 0.5,
                            color: isFullscreen ? 'primary.main' : 'text.secondary',
                            borderRadius: 0,
                            '&:hover': {
                                color: 'primary.main',
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
}
