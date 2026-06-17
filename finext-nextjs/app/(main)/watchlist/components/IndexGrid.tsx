'use client';

import { useMemo } from 'react';
import { Box } from '@mui/material';
import IndexCard from './IndexCard';
import { indexChartHref, indexDetailHref, type IndexData, type IndexKind } from './indexSections';

interface Props {
    codes: readonly string[];
    kind: IndexKind;
    dataMap: Map<string, IndexData>;
    sortByTradingValue?: boolean;
}

export default function IndexGrid({ codes, kind, dataMap, sortByTradingValue = false }: Props) {
    // Sắp theo GTGD giảm dần (mã chưa có data xuống cuối)
    const orderedCodes = useMemo(() => {
        if (!sortByTradingValue) return codes;
        return [...codes].sort((a, b) => {
            const ta = dataMap.get(a)?.trading_value ?? -Infinity;
            const tb = dataMap.get(b)?.trading_value ?? -Infinity;
            return tb - ta;
        });
    }, [codes, dataMap, sortByTradingValue]);

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
                lg: 'repeat(6, 1fr)',
            },
            gap: 1,
        }}>
            {orderedCodes.map(code => {
                const data = dataMap.get(code);
                return (
                    <IndexCard
                        key={code}
                        code={code}
                        name={data?.ticker_name}
                        data={data}
                        detailHref={indexDetailHref(code, kind)}
                        chartHref={indexChartHref(code)}
                    />
                );
            })}
        </Box>
    );
}
