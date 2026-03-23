'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box } from '@mui/material';

interface SortableWatchlistCardProps {
    id: string;
    disabled?: boolean;
    children: (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
}

export default function SortableWatchlistCard({ id, disabled, children }: SortableWatchlistCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition: transition || undefined,
        opacity: isDragging ? 0.4 : 1,
        willChange: transform ? 'transform' : undefined,
    };

    const dragHandleProps: React.HTMLAttributes<HTMLDivElement> = {
        ...(listeners ?? {}),
    };

    return (
        <Box ref={setNodeRef} style={style} {...attributes}>
            {children(dragHandleProps)}
        </Box>
    );
}
