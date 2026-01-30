'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Data stays fresh for 5 minutes
                        staleTime: 5 * 60 * 1000,
                        // Unused data stays in memory for 10 minutes
                        gcTime: 10 * 60 * 1000,
                        // Do not refetch on window focus (optional, good for financial apps to avoid flicker)
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
