'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    TextField,
    InputAdornment,
    Box,
    useTheme,
    alpha,
    IconButton,
    Fade,
    Drawer,
    useMediaQuery,
    Tooltip,
    Paper,
    Typography,
    Divider,
    CircularProgress,
    Chip,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { getResponsiveFontSize, borderRadius, fontWeight, iconSize, shadows } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

// ============================================================================
// TYPES
// ============================================================================

interface SearchStock {
    ticker: string;
    ticker_name?: string;
    exchange?: string;
    industry_name?: string;
    close?: number;
    pct_change?: number;
}

interface SearchIndexItem {
    ticker: string;
    ticker_name?: string;
    type?: string; // 'industry' → /sectors, others → /groups
    close?: number;
    pct_change?: number;
}

interface SearchNewsItem {
    article_slug: string;
    title: string;
    news_type?: string;
    created_at?: string;
    tickers?: string[];
}

interface SearchReportItem {
    report_slug: string;
    title: string;
    report_type?: string;
    created_at?: string;
    tickers?: string[];
}

interface SearchResults {
    stocks: SearchStock[];
    indexes: SearchIndexItem[];
    news: SearchNewsItem[];
    reports: SearchReportItem[];
}

interface SearchBarProps {
    placeholder?: string;
    variant?: 'compact' | 'full' | 'icon';
}

// ============================================================================
// HELPERS
// ============================================================================

function formatPct(pct?: number): string {
    if (pct == null) return '';
    const val = pct * 100;
    if (val === 0) return '0.00%';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
}

function getPctColor(pct: number | undefined, theme: any): string {
    if (pct == null) return theme.palette.text.secondary;
    if (pct > 0) return theme.palette.trend?.up ?? theme.palette.success.main;
    if (pct < 0) return theme.palette.trend?.down ?? theme.palette.error.main;
    return theme.palette.trend?.ref ?? theme.palette.text.secondary;
}

const MAX_PER_SECTION = 5;
const DEBOUNCE_MS = 300;

// ============================================================================
// SEARCH LOGIC HOOK
// ============================================================================

function useSearchLogic() {
    const [allStocks, setAllStocks] = useState<SearchStock[]>([]);
    const [allIndexes, setAllIndexes] = useState<SearchIndexItem[]>([]);
    const [isPreloaded, setIsPreloaded] = useState(false);

    // Preload stocks and indexes on first use — delay để không tranh connection với API của page
    useEffect(() => {
        let cancelled = false;

        async function preload() {
            if (cancelled) return;
            try {
                const [stocksRes, indexesRes] = await Promise.all([
                    apiClient<SearchStock[]>({
                        url: '/api/v1/sse/rest/search_stocks',
                        method: 'GET',
                        requireAuth: false,
                        useCache: true,
                        cacheTtl: 60 * 1000, // 1 min — giá thay đổi liên tục
                    }),
                    apiClient<SearchIndexItem[]>({
                        url: '/api/v1/sse/rest/search_index',
                        method: 'GET',
                        requireAuth: false,
                        useCache: true,
                        cacheTtl: 60 * 1000, // 1 min
                    }),
                ]);
                if (!cancelled) {
                    if (stocksRes.data && Array.isArray(stocksRes.data)) setAllStocks(stocksRes.data);
                    if (indexesRes.data && Array.isArray(indexesRes.data)) setAllIndexes(indexesRes.data);
                    setIsPreloaded(true);
                }
            } catch (err) {
                console.warn('[SearchBar] Preload failed:', err);
            }
        }

        const timeoutId = setTimeout(preload, 1500);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, []);

    const search = useCallback(async (query: string): Promise<SearchResults> => {
        const trimmed = query.trim();
        const q = trimmed.toUpperCase();

        const sortByTicker = <T extends { ticker?: string }>(arr: T[]) =>
            [...arr].sort((a, b) => (a.ticker ?? '').localeCompare(b.ticker ?? ''));

        const sortByDate = <T extends { created_at?: string }>(arr: T[]) =>
            [...arr].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

        // Client-side filter stocks by ticker only, sorted A→Z
        const filteredStocks = trimmed
            ? sortByTicker(allStocks.filter(s => s.ticker?.toUpperCase().includes(q))).slice(0, MAX_PER_SECTION)
            : sortByTicker(allStocks).slice(0, MAX_PER_SECTION);

        // Client-side filter indexes by ticker only, sorted A→Z
        const filteredIndexes = trimmed
            ? sortByTicker(allIndexes.filter(s => s.ticker?.toUpperCase().includes(q))).slice(0, MAX_PER_SECTION)
            : sortByTicker(allIndexes).slice(0, MAX_PER_SECTION);

        // Remote search for news + reports (always called, empty query returns latest)
        try {
            const params = trimmed
                ? { search: trimmed, limit: MAX_PER_SECTION }
                : { limit: MAX_PER_SECTION };

            const [newsRes, reportsRes] = await Promise.all([
                apiClient<SearchNewsItem[]>({
                    url: '/api/v1/sse/rest/search_news',
                    method: 'GET',
                    queryParams: params,
                    requireAuth: false,
                    useCache: !trimmed,
                    cacheTtl: 5 * 60 * 1000,
                }),
                apiClient<SearchReportItem[]>({
                    url: '/api/v1/sse/rest/search_reports',
                    method: 'GET',
                    queryParams: params,
                    requireAuth: false,
                    useCache: !trimmed,
                    cacheTtl: 5 * 60 * 1000,
                }),
            ]);

            const news = sortByDate(newsRes.data && Array.isArray(newsRes.data) ? newsRes.data : []);
            const reports = sortByDate(reportsRes.data && Array.isArray(reportsRes.data) ? reportsRes.data : []);

            return { stocks: filteredStocks, indexes: filteredIndexes, news, reports };
        } catch {
            return { stocks: filteredStocks, indexes: filteredIndexes, news: [], reports: [] };
        }
    }, [allStocks, allIndexes]);

    return { search, isPreloaded };
}

// ============================================================================
// RESULT SECTION
// ============================================================================

interface SectionHeaderProps {
    icon: string;
    label: string;
}

function SectionHeader({ icon, label }: SectionHeaderProps) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                backgroundColor: theme.palette.background.default,
            }}
        >
            <Icon icon={icon} width={15} height={15} style={{ color: theme.palette.primary.main, flexShrink: 0 }} />
            <Typography
                sx={{
                    color: theme.palette.text.secondary,
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: getResponsiveFontSize('xs'),
                }}
            >
                {label}
            </Typography>
        </Box>
    );
}

interface StockResultItemProps {
    item: SearchStock;
    onClick: () => void;
}

function StockResultItem({ item, onClick }: StockResultItemProps) {
    const theme = useTheme();
    const pctColor = getPctColor(item.pct_change, theme);

    return (
        <Box
            onClick={onClick}
            sx={{
                px: 1.5,
                py: 0.75,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                borderRadius: `${borderRadius.sm}px`,
                mx: 0.5,
                transition: 'background-color 0.15s',
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.semibold, lineHeight: 1.3 }}>
                    {item.ticker}
                </Typography>
                <Typography noWrap sx={{ fontSize: getResponsiveFontSize('sm'), color: theme.palette.text.secondary, lineHeight: 1.2, maxWidth: 260 }}>
                    {item.ticker_name}
                </Typography>
            </Box>

            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                {item.close != null && (
                    <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.medium }}>
                        {item.close.toFixed(2)}
                    </Typography>
                )}
                {item.pct_change != null && (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: pctColor, fontWeight: fontWeight.medium }}>
                        {formatPct(item.pct_change)}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

interface IndexResultItemProps {
    item: SearchIndexItem;
    onClick: () => void;
}

function IndexResultItem({ item, onClick }: IndexResultItemProps) {
    const theme = useTheme();
    const pctColor = getPctColor(item.pct_change, theme);
    const isIndustry = item.type === 'industry';

    return (
        <Box
            onClick={onClick}
            sx={{
                px: 1.5,
                py: 0.75,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                borderRadius: `${borderRadius.sm}px`,
                mx: 0.5,
                transition: 'background-color 0.15s',
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.semibold, lineHeight: 1.3 }}>
                    {item.ticker_name || item.ticker}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: theme.palette.text.secondary, lineHeight: 1.2 }}>
                    {item.ticker} · {isIndustry ? 'Ngành' : 'Nhóm'}
                </Typography>
            </Box>
            {item.pct_change != null && (
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: pctColor, fontWeight: fontWeight.medium, flexShrink: 0 }}>
                    {formatPct(item.pct_change)}
                </Typography>
            )}
        </Box>
    );
}

interface NewsResultItemProps {
    item: SearchNewsItem;
    onClick: () => void;
}

function NewsResultItem({ item, onClick }: NewsResultItemProps) {
    const theme = useTheme();
    const date = item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '';

    return (
        <Box
            onClick={onClick}
            sx={{
                px: 1.5,
                py: 0.75,
                cursor: 'pointer',
                borderRadius: `${borderRadius.sm}px`,
                mx: 0.5,
                transition: 'background-color 0.15s',
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
            }}
        >
            <Typography sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.4, fontWeight: fontWeight.medium }}>
                {item.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                {item.tickers && item.tickers.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {item.tickers.slice(0, 3).map(t => (
                            <Chip key={t} label={t} size="small" sx={{ height: 18, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }} />
                        ))}
                    </Box>
                )}
                {date && (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: theme.palette.text.secondary }}>
                        {date}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

interface ReportResultItemProps {
    item: SearchReportItem;
    onClick: () => void;
}

function ReportResultItem({ item, onClick }: ReportResultItemProps) {
    const theme = useTheme();
    const date = item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '';

    return (
        <Box
            onClick={onClick}
            sx={{
                px: 1.5,
                py: 0.75,
                cursor: 'pointer',
                borderRadius: `${borderRadius.sm}px`,
                mx: 0.5,
                transition: 'background-color 0.15s',
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                },
            }}
        >
            <Typography sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.4, fontWeight: fontWeight.medium }}>
                {item.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                {item.tickers && item.tickers.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {item.tickers.slice(0, 3).map(t => (
                            <Chip key={t} label={t} size="small" sx={{ height: 18, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }} />
                        ))}
                    </Box>
                )}
                {date && (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: theme.palette.text.secondary }}>
                        {date}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

// ============================================================================
// DROPDOWN RESULTS PANEL
// ============================================================================

interface ResultsPanelProps {
    results: SearchResults;
    isLoading: boolean;
    query: string;
    onNavigate: (path: string) => void;
}

function ResultsPanel({ results, isLoading, query, onNavigate }: ResultsPanelProps) {
    const theme = useTheme();
    const hasStocks = results.stocks.length > 0;
    const hasIndexes = results.indexes.length > 0;
    const hasNews = results.news.length > 0;
    const hasReports = results.reports.length > 0;
    const hasAny = hasStocks || hasIndexes || hasNews || hasReports;

    return (
        <Box sx={{ maxHeight: '70vh', overflowY: 'auto', py: 0.5 }}>
            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={20} />
                </Box>
            )}

            {!isLoading && !hasAny && query.length > 0 && (
                <Box sx={{ py: 3, textAlign: 'center', color: theme.palette.text.secondary }}>
                    <Icon icon="fluent:search-off-24-regular" width={32} height={32} style={{ opacity: 0.5 }} />
                    <Typography sx={{ mt: 1, fontSize: getResponsiveFontSize('sm') }}>
                        Không tìm thấy kết quả cho &quot;{query}&quot;
                    </Typography>
                </Box>
            )}

            {/* Section 1: Cổ phiếu */}
            {hasStocks && (
                <>
                    <SectionHeader icon="fluent-color:data-trending-16" label="Cổ phiếu" />
                    {results.stocks.map(item => (
                        <StockResultItem
                            key={item.ticker}
                            item={item}
                            onClick={() => onNavigate(`/stocks/${item.ticker}`)}
                        />
                    ))}
                </>
            )}

            {/* Divider between sections */}
            {hasStocks && hasIndexes && <Divider sx={{ my: 0.5, mx: 1.5 }} />}

            {/* Section 2: Nhóm & Ngành */}
            {hasIndexes && (
                <>
                    <SectionHeader icon="fluent-color:diversity-16" label="Nhóm & Ngành" />
                    {results.indexes.map(item => (
                        <IndexResultItem
                            key={item.ticker}
                            item={item}
                            onClick={() => onNavigate(item.type === 'industry' ? `/sectors/${item.ticker}` : `/groups/${item.ticker}`)}
                        />
                    ))}
                </>
            )}

            {/* Divider */}
            {(hasStocks || hasIndexes) && hasNews && <Divider sx={{ my: 0.5, mx: 1.5 }} />}

            {/* Section 3: Tin tức */}
            {hasNews && (
                <>
                    <SectionHeader icon="fluent-color:news-28" label="Tin tức" />
                    {results.news.map(item => (
                        <NewsResultItem
                            key={item.article_slug}
                            item={item}
                            onClick={() => onNavigate(`/news/${item.article_slug}`)}
                        />
                    ))}
                </>
            )}

            {/* Divider */}
            {(hasStocks || hasIndexes || hasNews) && hasReports && <Divider sx={{ my: 0.5, mx: 1.5 }} />}

            {/* Section 4: Báo cáo */}
            {hasReports && (
                <>
                    <SectionHeader icon="fluent-color:document-edit-24" label="Báo cáo" />
                    {results.reports.map(item => (
                        <ReportResultItem
                            key={item.report_slug}
                            item={item}
                            onClick={() => onNavigate(`/reports/${item.report_slug}`)}
                        />
                    ))}
                </>
            )}
        </Box>
    );
}

// ============================================================================
// MAIN SEARCH BAR COMPONENT
// ============================================================================

export default function SearchBar({
    placeholder = 'Tìm cổ phiếu, nhóm ngành, tin tức...',
}: SearchBarProps) {
    const [searchValue, setSearchValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [results, setResults] = useState<SearchResults>({ stocks: [], indexes: [], news: [], reports: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentPlaceholder, setCurrentPlaceholder] = useState('');
    const [isTypingAnim, setIsTypingAnim] = useState(true);
    const [currentTextIndex, setCurrentTextIndex] = useState(0);

    const theme = useTheme();
    const router = useRouter();
    const lgDown = useMediaQuery(theme.breakpoints.down('lg'));
    const anchorRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const { search, isPreloaded } = useSearchLogic();

    // Placeholder typing animation
    const placeholderTexts = [
        'Tìm cổ phiếu, nhóm ngành...',
        'Nhập mã cổ phiếu VD: VNM...',
        'Tìm theo tên công ty...',
        'Tìm tin tức, báo cáo...',
    ];

    useEffect(() => {
        if (searchValue || isFocused) return;
        const currentText = placeholderTexts[currentTextIndex];
        let timeoutId: NodeJS.Timeout;
        if (isTypingAnim) {
            const next = currentPlaceholder.length + 1;
            if (next <= currentText.length) {
                timeoutId = setTimeout(() => setCurrentPlaceholder(currentText.slice(0, next)), 90);
            } else {
                timeoutId = setTimeout(() => setIsTypingAnim(false), 2000);
            }
        } else {
            if (currentPlaceholder.length > 0) {
                timeoutId = setTimeout(() => setCurrentPlaceholder(p => p.slice(0, -1)), 45);
            } else {
                setCurrentTextIndex(i => (i + 1) % placeholderTexts.length);
                setIsTypingAnim(true);
            }
        }
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPlaceholder, isTypingAnim, currentTextIndex, searchValue, isFocused]);

    // Debounced search
    const triggerSearch = useCallback((query: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        setIsSearching(true);
        setShowDropdown(true);

        debounceRef.current = setTimeout(async () => {
            const res = await search(query);
            setResults(res);
            setIsSearching(false);
        }, DEBOUNCE_MS);
    }, [search]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchValue(val);
        triggerSearch(val);
    };

    const handleClear = () => {
        setSearchValue('');
        setResults({ stocks: [], indexes: [], news: [], reports: [] });
        setShowDropdown(false);
    };

    const handleNavigate = (path: string) => {
        router.push(path);
        handleClear();
        setIsFocused(false);
        setShowDropdown(false);
        setIsDrawerOpen(false);
    };

    const handleClickAway = () => {
        setShowDropdown(false);
        setIsFocused(false);
    };

    const handleFocus = () => {
        setIsFocused(true);
        triggerSearch(searchValue);
    };

    // Helper to get the first navigable path from current results
    const getFirstResultPath = (): string | null => {
        if (results.stocks.length > 0) return `/stocks/${results.stocks[0].ticker}`;
        if (results.indexes.length > 0) {
            const item = results.indexes[0];
            return item.type === 'industry' ? `/sectors/${item.ticker}` : `/groups/${item.ticker}`;
        }
        if (results.news.length > 0) return `/news/${results.news[0].article_slug}`;
        if (results.reports.length > 0) return `/reports/${results.reports[0].report_slug}`;
        return null;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const path = getFirstResultPath();
            if (path) {
                handleNavigate(path);
            }
        }
    };

    const handleBlur = () => {
        // Delay so that clicks on result items register first
        setTimeout(() => {
            setShowDropdown(false);
            setIsFocused(false);
            setSearchValue('');
            setResults({ stocks: [], indexes: [], news: [], reports: [] });
        }, 150);
    };

    const inputSx = {
        borderRadius: borderRadius.pill,
        backgroundColor: theme.palette.background.paper,
        backdropFilter: 'blur(8px)',
        transition: theme.transitions.create(['box-shadow', 'background-color']),
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '&:hover': { backgroundColor: theme.palette.background.paper },
        '&.Mui-focused': {
            backgroundColor: theme.palette.background.paper,
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.25)}`,
        },
    };

    // ─── Mobile / Tablet: icon → drawer ───
    if (lgDown) {
        return (
            <>
                <Tooltip title="Tìm kiếm" placement="bottom">
                    <IconButton
                        onClick={() => setIsDrawerOpen(true)}
                        aria-label="Mở tìm kiếm"
                        sx={{
                            p: 0,
                            color: theme.palette.text.secondary,
                            '&:hover': { color: theme.palette.primary.main, backgroundColor: 'transparent' },
                        }}
                    >
                        <SearchIcon />
                    </IconButton>
                </Tooltip>

                <Drawer
                    anchor="right"
                    open={isDrawerOpen}
                    onClose={() => { setIsDrawerOpen(false); handleClear(); }}
                    ModalProps={{ keepMounted: true }}
                    elevation={0}
                    aria-label="Tìm kiếm"
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: { xs: 320, sm: 380 },
                            boxShadow: shadows.drawerLeft,
                            backdropFilter: 'blur(12px)',
                            backgroundColor: theme.palette.background.default,
                        },
                    }}
                >
                    <Box sx={{ p: 2, pt: 2.5 }}>
                        {/* Drawer Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: fontWeight.semibold, fontSize: getResponsiveFontSize('lg') }}>
                                Tìm kiếm
                            </Typography>
                            <IconButton size="small" onClick={() => { setIsDrawerOpen(false); handleClear(); }}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        {/* Search Input */}
                        <TextField
                            fullWidth
                            autoFocus
                            size="small"
                            value={searchValue}
                            onChange={handleChange}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder="Tìm cổ phiếu, nhóm ngành, tin tức..."
                            variant="outlined"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: theme.palette.primary.main, fontSize: iconSize.lg }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchValue && (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={handleClear}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                                sx: {
                                    ...inputSx,
                                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                                    '&.Mui-focused': {
                                        backgroundColor: alpha(theme.palette.text.primary, 0.05),
                                        boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.25)}`,
                                    },
                                },
                            }}
                        />

                        {/* Results */}
                        <Box sx={{ mt: 1.5 }}>
                            <ResultsPanel
                                results={results}
                                isLoading={isSearching}
                                query={searchValue}
                                onNavigate={handleNavigate}
                            />
                        </Box>
                    </Box>
                </Drawer>
            </>
        );
    }

    // ─── Desktop: inline search bar + absolute dropdown ───
    return (
        <Box
            ref={anchorRef}
            sx={{
                maxWidth: 500,
                minWidth: 380,
                width: '100%',
                position: 'relative',
            }}
        >
            <TextField
                fullWidth
                size="small"
                value={searchValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={isFocused ? '' : currentPlaceholder || placeholder}
                variant="outlined"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon
                                sx={{
                                    color: isFocused ? theme.palette.primary.main : theme.palette.text.secondary,
                                    fontSize: iconSize.md,
                                    transition: theme.transitions.create('color'),
                                }}
                            />
                        </InputAdornment>
                    ),
                    endAdornment: searchValue ? (
                        <InputAdornment position="end">
                            <Fade in={!!searchValue}>
                                <IconButton size="small" onClick={handleClear} sx={{ padding: 0.5 }}>
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </Fade>
                        </InputAdornment>
                    ) : isSearching ? (
                        <InputAdornment position="end">
                            <CircularProgress size={16} />
                        </InputAdornment>
                    ) : null,
                    sx: {
                        ...inputSx,
                        '& .MuiInputBase-input': {
                            fontSize: getResponsiveFontSize('sm'),
                            padding: '6px 0',
                        },
                    },
                }}
                sx={{
                    '& .MuiInputBase-input::placeholder': {
                        color: theme.palette.text.secondary,
                        opacity: 0.7,
                    },
                }}
            />

            {/* Dropdown results - absolute position, always rendered in same stacking context */}
            <Fade in={showDropdown}>
                <Paper
                    elevation={0}
                    onMouseDown={(e) => e.preventDefault()}
                    sx={{
                        display: showDropdown ? 'block' : 'none',
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 1400,
                        borderRadius: `${borderRadius.lg}px`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                        boxShadow: shadows.xl,
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        backgroundColor: theme.palette.background.default,
                        overflow: 'hidden',
                    }}
                >
                    <ResultsPanel
                        results={results}
                        isLoading={isSearching}
                        query={searchValue}
                        onNavigate={handleNavigate}
                    />
                </Paper>
            </Fade>
        </Box>
    );
}