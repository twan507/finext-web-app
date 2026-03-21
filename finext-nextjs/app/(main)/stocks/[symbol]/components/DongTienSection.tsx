'use client';

import { Box, Typography, useTheme, useMediaQuery, Skeleton } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import dynamic from 'next/dynamic';

const SucManhDongTien = dynamic(
    () => import('../../../groups/[groupId]/components/SucManhDongTien'),
    { ssr: false, loading: () => <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} /> }
);
const TuongQuanDongTien = dynamic(
    () => import('../../../groups/components/TuongQuanDongTien'),
    { ssr: false, loading: () => <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} /> }
);

interface DongTienSectionProps {
    // Pre-computed chart data from parent
    dongTienDates: string[];
    t5ScoreData: number[];
    t0ScoreData: number[];
    tuongQuanDates: string[];
    tuongQuanSeries: { name: string; data: number[] }[];
}

export default function DongTienSection({
    dongTienDates,
    t5ScoreData,
    t0ScoreData,
    tuongQuanDates,
    tuongQuanSeries,
}: DongTienSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const hasData = dongTienDates.length > 0;

    return (
        <Box>
            <Typography color="text.secondary" sx={{
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                mb: 1,
            }}>
                Dòng tiền
            </Typography>

            {hasData ? (
                <Box sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                    mt: 2,
                }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <SucManhDongTien
                            chartHeight="280px"
                            dates={dongTienDates}
                            t5ScoreData={t5ScoreData}
                            t0ScoreData={t0ScoreData}
                        />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TuongQuanDongTien
                            chartHeight="280px"
                            dates={tuongQuanDates}
                            series={tuongQuanSeries}
                            unit="percent"
                        />
                    </Box>
                </Box>
            ) : (
                <Box sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                    mt: 2,
                }}>
                    <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2, flex: 1 }} />
                    <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2, flex: 1 }} />
                </Box>
            )}
        </Box>
    );
}
