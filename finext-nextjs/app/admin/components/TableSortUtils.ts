import { parseISO, isValid } from 'date-fns';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
    key: string;
    direction: SortDirection;
}

export type SortType = 'string' | 'number' | 'date' | 'boolean';

export interface ColumnConfig {
    id: string;
    label: string;
    sortable: boolean;
    sortType: SortType;
    accessor: (item: any) => any;
    minWidth?: number | 'auto';
    align?: 'left' | 'center' | 'right';
    format?: (value: any) => string;
    responsive?: {
        xs?: 'none' | 'table-cell';
        sm?: 'none' | 'table-cell';
        md?: 'none' | 'table-cell';
        lg?: 'none' | 'table-cell';
    };
}

// Helper function to extract value from nested object path
export const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Helper function to convert value for comparison
export const normalizeValueForSort = (value: any, sortType: SortType): any => {
    if (value === null || value === undefined) {
        return sortType === 'string' ? '' : sortType === 'number' ? -Infinity : new Date(0);
    }

    switch (sortType) {
        case 'string':
            return String(value).toLowerCase().trim();

        case 'number':
            const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
            return isNaN(num) ? -Infinity : num;

        case 'date':
            if (typeof value === 'string') {
                try {
                    const date = parseISO(value);
                    return isValid(date) ? date : new Date(0);
                } catch {
                    return new Date(0);
                }
            }
            return value instanceof Date ? value : new Date(0);

        case 'boolean':
            return Boolean(value);

        default:
            return value;
    }
};

// Main sorting function
export const sortData = <T>(
    data: T[],
    sortConfig: SortConfig | null,
    columnConfig: ColumnConfig
): T[] => {
    if (!sortConfig || !sortConfig.direction) {
        return data;
    }

    const { key, direction } = sortConfig;
    const column = columnConfig;

    if (!column || !column.sortable) {
        return data;
    }

    return [...data].sort((a, b) => {
        const aValue = column.accessor(a);
        const bValue = column.accessor(b);

        const normalizedA = normalizeValueForSort(aValue, column.sortType);
        const normalizedB = normalizeValueForSort(bValue, column.sortType);

        let comparison = 0;

        if (column.sortType === 'date') {
            comparison = normalizedA.getTime() - normalizedB.getTime();
        } else if (column.sortType === 'number') {
            comparison = normalizedA - normalizedB;
        } else if (column.sortType === 'boolean') {
            comparison = normalizedA === normalizedB ? 0 : normalizedA ? 1 : -1;
        } else {
            // string comparison
            comparison = normalizedA.localeCompare(normalizedB, 'vi', {
                numeric: true,
                sensitivity: 'base'
            });
        }

        return direction === 'desc' ? -comparison : comparison;
    });
};

// Helper to get next sort direction
export const getNextSortDirection = (currentDirection: SortDirection): SortDirection => {
    switch (currentDirection) {
        case null:
            return 'asc';
        case 'asc':
            return 'desc';
        case 'desc':
            return null;
        default:
            return 'asc';
    }
};

// Helper function to get responsive display style for table cells
export const getResponsiveDisplayStyle = (column: ColumnConfig, expandedView: boolean = false) => {
    // If expandedView is true, always show all columns
    if (expandedView) {
        return { display: 'table-cell' };
    }

    // If no responsive config, show in compact view
    if (!column.responsive) {
        return { display: 'table-cell' };
    }

    // Check if column should only show in detail view (all breakpoints are 'none')
    const allBreakpointsNone = column.responsive.xs === 'none' &&
        column.responsive.sm === 'none' &&
        column.responsive.md === 'none' &&
        column.responsive.lg === 'none';

    if (allBreakpointsNone) {
        // Only show in detail view, hide in compact view at all breakpoints
        return { display: 'none' };
    }

    // Build responsive display object for Material-UI
    const responsiveStyles: any = {};

    // For phone_number and is_active columns: hide from sm down (xs: none, sm: none, but md+ can show)
    if (column.responsive.xs === 'none' && column.responsive.sm === 'none' &&
        (!column.responsive.md || column.responsive.md === 'table-cell')) {
        responsiveStyles.display = {
            xs: 'none',
            sm: 'none',
            md: 'table-cell'
        };
    }
    // For subscription column: hide only at xs (xs: none, but sm+ can show)
    else if (column.responsive.xs === 'none' &&
        (!column.responsive.sm || column.responsive.sm === 'table-cell')) {
        responsiveStyles.display = {
            xs: 'none',
            sm: 'table-cell'
        };
    }
    // Default: show column
    else {
        responsiveStyles.display = 'table-cell';
    }

    return responsiveStyles;
};
