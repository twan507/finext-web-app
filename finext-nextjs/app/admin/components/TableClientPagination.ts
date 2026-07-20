// finext-nextjs/app/admin/components/TableClientPagination.ts
//
// Tầng dùng chung cho phân trang/sắp xếp phía client của các bảng khu admin.
//
// Bối cảnh: backend chỉ hỗ trợ skip/limit (KHÔNG có search/sort server-side).
// Vì vậy các màn admin nạp TOÀN BỘ tập dữ liệu (limit = ALL_ROWS_VALUE) rồi
// lọc (ở component Search) -> sắp xếp -> phân trang phía client. Module này gom
// đúng bước "sắp xếp + phân trang + đếm tổng" để mọi màn dùng chung 1 nguồn,
// tránh lỗi copy-paste khiến sort/filter phá phân trang và hiển thị sai tổng.
//
// Lưu ý: chỉ import KIỂU từ TableSortUtils (bị strip khi chạy node --test),
// hàm sort được TIÊM vào qua tham số sortFn -> module này không phụ thuộc
// runtime vào module khác, chạy test độc lập được.

import type { SortConfig, ColumnConfig } from './TableSortUtils';

// Giá trị "ALL" của TablePaginationStyled (hiển thị toàn bộ, không cắt trang).
export const ALL_ROWS_VALUE = 99999;

export type SortFn = <T>(
    data: T[],
    sortConfig: SortConfig | null,
    column: ColumnConfig,
) => T[];

export interface ClientTableResult<T> {
    // Các dòng thuộc trang hiện tại (đã lọc + sắp xếp + cắt trang).
    pageItems: T[];
    // Tổng số dòng của TẬP ĐANG HIỂN THỊ (sau lọc/sắp xếp) — dùng cho phân trang.
    displayTotalCount: number;
}

// Cắt trang thuần: rowsPerPage >= ALL_ROWS_VALUE hoặc <= 0 => trả về nguyên tập.
export function paginateRows<T>(rows: T[], page: number, rowsPerPage: number): T[] {
    if (!Array.isArray(rows)) return [];
    if (rowsPerPage >= ALL_ROWS_VALUE || rowsPerPage <= 0) return rows;
    const start = page * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
}

// Tính dữ liệu trang + tổng số đúng ngữ nghĩa cho một bảng client-side.
// rows: TẬP ĐẦY ĐỦ đã được lọc bởi component Search (hoặc chưa lọc nếu không tìm kiếm).
export function computeClientTable<T>(params: {
    rows: T[];
    sortConfig: SortConfig | null;
    columns: ColumnConfig[];
    page: number;
    rowsPerPage: number;
    sortFn: SortFn;
}): ClientTableResult<T> {
    const { rows, sortConfig, columns, page, rowsPerPage, sortFn } = params;
    const base = Array.isArray(rows) ? rows : [];

    let sorted = base;
    if (sortConfig && sortConfig.direction) {
        const column = columns.find((c) => c.id === sortConfig.key);
        if (column && column.sortable) {
            sorted = sortFn(base, sortConfig, column);
        }
    }

    return {
        pageItems: paginateRows(sorted, page, rowsPerPage),
        // Tổng LUÔN là kích thước tập đang hiển thị (đã lọc/sắp xếp),
        // không phải length của riêng trang hiện tại.
        displayTotalCount: sorted.length,
    };
}
