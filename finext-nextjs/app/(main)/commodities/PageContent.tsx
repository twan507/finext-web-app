'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import OtherTickerTable, { OtherTickerData } from '@/components/common/OtherTickerTable';
import OtherTickerChart from '@/components/common/OtherTickerChart';
import { NewsBreadcrumb } from '../news/components';
import { getResponsiveFontSize, fontWeight, transitions, layoutTokens } from 'theme/tokens';

const CATEGORIES = [
    { id: 'metals', label: 'Kim loại' },
    { id: 'energy', label: 'Năng lượng' },
    { id: 'chemical', label: 'Hóa chất' },
    { id: 'agriculture', label: 'Nông sản' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

function SubNavbar({ activeTab, onTabChange }: {
    activeTab: CategoryId;
    onTabChange: (tab: CategoryId) => void;
}) {
    const theme = useTheme();

    return (
        <Box sx={{
            mx: { xs: 'calc(-50vw + 50%)', lg: `calc(-50vw + 50% + ${layoutTokens.compactDrawerWidth / 2}px)` },
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            bgcolor: theme.palette.background.default,
        }}>
            <Box sx={{
                maxWidth: 1400,
                mx: 'auto',
                px: { xs: 1.5, md: 2, lg: 3 },
                display: 'flex',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                msOverflowStyle: 'none',
            }}>
                {CATEGORIES.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <Box
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            sx={{
                                px: { xs: 2, md: 2.5 },
                                py: 1.5,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                position: 'relative',
                                borderBottom: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                                transition: transitions.colors,
                                '&:hover': { color: theme.palette.primary.main },
                            }}
                        >
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('md'),
                                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                                transition: transitions.colors,
                            }}>
                                {tab.label}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

const VALID_TABS: CategoryId[] = ['metals', 'energy', 'chemical', 'agriculture'];

export default function CommoditiesContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabParam = searchParams.get('tab') as CategoryId | null;

    const [activeTab, setActiveTab] = useState<CategoryId>(() => {
        if (tabParam && VALID_TABS.includes(tabParam)) return tabParam;
        return 'metals';
    });
    const [selectedRow, setSelectedRow] = useState<OtherTickerData | null>(null);

    useEffect(() => {
        if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = useCallback((tab: CategoryId) => {
        setActiveTab(tab);
        setSelectedRow(null);
        router.push(`?tab=${tab}`, { scroll: false });
    }, [router]);

    const handleTickerSelect = useCallback((row: OtherTickerData) => {
        setSelectedRow(row);
    }, []);

    return (
        <Box sx={{ py: 3 }}>
            <NewsBreadcrumb
                items={[]}
                sectionLabel="Hàng hóa"
                sectionHref="/commodities"
            />

            <Box sx={{ flex: 1, minWidth: 0 }}>
                {selectedRow && (
                    <OtherTickerChart
                        key={selectedRow.name}
                        ticker={selectedRow.ticker}
                        name={selectedRow.name || selectedRow.ticker_name || selectedRow.ticker}
                        chartMode={selectedRow.chart}
                        unit={selectedRow.unit}
                        height={345}
                    />
                )}
            </Box>

            <Box sx={{ mt: 4 }}>
                <SubNavbar activeTab={activeTab} onTabChange={handleTabChange} />
            </Box>

            <Box sx={{ mt: 3 }}>
                <OtherTickerTable
                    group="commodities"
                    category={activeTab}
                    selectedName={selectedRow?.name ?? null}
                    onTickerSelect={handleTickerSelect}
                />
            </Box>
        </Box>
    );
}
