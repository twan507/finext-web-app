// finext-nextjs/app/admin/components/TableClientPagination.test.ts
// Chạy: node --test app/admin/components/TableClientPagination.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    paginateRows,
    computeClientTable,
    ALL_ROWS_VALUE,
} from './TableClientPagination.ts';
import { sortData, type ColumnConfig } from './TableSortUtils.ts';

interface Row {
    id: string;
    name: string;
    price: number;
}

// 23 dòng -> nhiều hơn 1 trang (10/trang) để lộ bug "tổng = length trang hiện tại".
const rows: Row[] = Array.from({ length: 23 }, (_, i) => ({
    id: String(i),
    name: `row-${String(i).padStart(2, '0')}`,
    price: 23 - i, // giảm dần: dòng 0 giá cao nhất
}));

const columns: ColumnConfig[] = [
    { id: 'name', label: 'Name', sortable: true, sortType: 'string', accessor: (r: Row) => r.name },
    { id: 'price', label: 'Price', sortable: true, sortType: 'number', accessor: (r: Row) => r.price },
    { id: 'actions', label: '', sortable: false, sortType: 'string', accessor: () => '' },
];

test('paginateRows: cắt đúng theo trang', () => {
    assert.deepEqual(paginateRows(rows, 0, 10).map((r) => r.id), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    assert.deepEqual(paginateRows(rows, 2, 10).map((r) => r.id), ['20', '21', '22']); // trang cuối 3 dòng
    assert.equal(paginateRows(rows, 1, 10).length, 10);
});

test('paginateRows: ALL trả về nguyên tập', () => {
    assert.equal(paginateRows(rows, 0, ALL_ROWS_VALUE).length, 23);
});

test('paginateRows: rowsPerPage <= 0 hoặc không phải mảng', () => {
    assert.equal(paginateRows(rows, 0, 0).length, 23);
    // @ts-expect-error test đầu vào lỗi
    assert.deepEqual(paginateRows(null, 0, 10), []);
});

test('computeClientTable: displayTotalCount là TỔNG cả tập, không phải length trang', () => {
    const { pageItems, displayTotalCount } = computeClientTable({
        rows, sortConfig: null, columns, page: 0, rowsPerPage: 10, sortFn: sortData,
    });
    assert.equal(pageItems.length, 10);
    assert.equal(displayTotalCount, 23); // bug cũ sẽ trả 10
});

test('computeClientTable: sort áp lên TOÀN BỘ tập rồi mới cắt trang', () => {
    // Sắp xếp giá tăng dần: trang đầu phải là các giá nhỏ nhất (1..10),
    // tức là các dòng cuối của tập gốc (id 22,21,...). Nếu sort chỉ trên trang
    // hiện tại (bug cũ) sẽ ra kết quả khác.
    const { pageItems, displayTotalCount } = computeClientTable({
        rows,
        sortConfig: { key: 'price', direction: 'asc' },
        columns, page: 0, rowsPerPage: 10, sortFn: sortData,
    });
    assert.equal(displayTotalCount, 23);
    assert.deepEqual(pageItems.map((r) => r.price), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(pageItems[0].id, '22');
});

test('computeClientTable: trang cuối khi có sort', () => {
    const { pageItems } = computeClientTable({
        rows,
        sortConfig: { key: 'price', direction: 'asc' },
        columns, page: 2, rowsPerPage: 10, sortFn: sortData,
    });
    assert.deepEqual(pageItems.map((r) => r.price), [21, 22, 23]);
});

test('computeClientTable: tập đã lọc (search) -> tổng theo tập đã lọc', () => {
    const filtered = rows.filter((r) => r.price <= 5); // 5 dòng
    const { pageItems, displayTotalCount } = computeClientTable({
        rows: filtered,
        sortConfig: { key: 'price', direction: 'desc' },
        columns, page: 0, rowsPerPage: 10, sortFn: sortData,
    });
    assert.equal(displayTotalCount, 5);
    assert.deepEqual(pageItems.map((r) => r.price), [5, 4, 3, 2, 1]);
});

test('computeClientTable: cột không sortable thì giữ nguyên thứ tự', () => {
    const { pageItems, displayTotalCount } = computeClientTable({
        rows,
        sortConfig: { key: 'actions', direction: 'asc' },
        columns, page: 0, rowsPerPage: 5, sortFn: sortData,
    });
    assert.equal(displayTotalCount, 23);
    assert.deepEqual(pageItems.map((r) => r.id), ['0', '1', '2', '3', '4']);
});
