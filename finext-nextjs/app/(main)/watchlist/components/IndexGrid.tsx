'use client';

import { Box } from '@mui/material';
import IndexCard from './IndexCard';
import { indexChartHref, indexDetailHref, type IndexData, type IndexKind } from './indexSections';

interface Props {
    codes: readonly string[];
    kind: IndexKind;
    dataMap: Map<string, IndexData>;
}

export default function IndexGrid({ codes, kind, dataMap }: Props) {
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
            {codes.map(code => {
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
