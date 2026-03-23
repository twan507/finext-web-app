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
        // When dragging: hide original (DragOverlay shows the preview), no transition on pickup
        // When not dragging: smooth transition for items shifting around
        transition: isDragging ? 'none' : (transition || undefined),
        opacity: isDragging ? 0 : 1,
        willChange: transform ? 'transform' : undefined,
        // Placeholder reserves only collapsed header height so neighbors shift minimally
        ...(isDragging ? { height: 36, overflow: 'hidden' } : {}),
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
