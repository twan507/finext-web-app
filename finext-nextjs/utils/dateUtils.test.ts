// finext-nextjs/utils/dateUtils.test.ts
// Run with: node --test utils/dateUtils.test.ts
// MUST be green in BOTH TZ=UTC and TZ=Asia/Ho_Chi_Minh (results must be
// independent of the browser/runtime timezone).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    convertGMT7ToUTC,
    convertUTCToGMT7DateString,
    formatUTCToGMT7,
} from './dateUtils.ts';

test('convertGMT7ToUTC: start of day GMT+7 -> UTC (prev day 17:00Z)', () => {
    assert.equal(convertGMT7ToUTC('2026-07-20'), '2026-07-19T17:00:00.000Z');
    assert.equal(convertGMT7ToUTC('2026-07-20', false), '2026-07-19T17:00:00.000Z');
});

test('convertGMT7ToUTC: end of day GMT+7 -> UTC (same day 16:59:59.999Z)', () => {
    assert.equal(convertGMT7ToUTC('2026-07-20', true), '2026-07-20T16:59:59.999Z');
});

test('convertGMT7ToUTC: January (month boundary) start of day', () => {
    // 01/01 00:00 GMT+7 -> 31/12 prev year 17:00Z
    assert.equal(convertGMT7ToUTC('2026-01-01'), '2025-12-31T17:00:00.000Z');
});

test('convertUTCToGMT7DateString: UTC -> GMT+7 date string', () => {
    // 2026-07-19T17:00:00Z + 7h = 2026-07-20T00:00Z (GMT+7 wall clock date)
    assert.equal(convertUTCToGMT7DateString('2026-07-19T17:00:00.000Z'), '2026-07-20');
    // Just before midnight UTC that crosses the date in GMT+7
    assert.equal(convertUTCToGMT7DateString('2026-07-20T16:59:59.999Z'), '2026-07-20');
    // 18:00Z + 7h = next day 01:00 GMT+7
    assert.equal(convertUTCToGMT7DateString('2026-07-20T18:00:00.000Z'), '2026-07-21');
});

test('round-trip: GMT7 date -> UTC -> GMT7 date string is stable', () => {
    const start = convertGMT7ToUTC('2026-07-20', false);
    assert.equal(convertUTCToGMT7DateString(start), '2026-07-20');
    const end = convertGMT7ToUTC('2026-07-20', true);
    assert.equal(convertUTCToGMT7DateString(end), '2026-07-20');
});

test('formatUTCToGMT7: with time -> DD/MM/YYYY HH:mm in GMT+7', () => {
    // 2026-07-19T17:00:00Z + 7h = 2026-07-20 00:00 GMT+7
    assert.equal(formatUTCToGMT7('2026-07-19T17:00:00.000Z'), '20/07/2026 00:00');
    // 2026-07-20T02:30:00Z + 7h = 2026-07-20 09:30 GMT+7
    assert.equal(formatUTCToGMT7('2026-07-20T02:30:00.000Z', true), '20/07/2026 09:30');
});

test('formatUTCToGMT7: date only -> DD/MM/YYYY', () => {
    assert.equal(formatUTCToGMT7('2026-07-19T17:00:00.000Z', false), '20/07/2026');
});
