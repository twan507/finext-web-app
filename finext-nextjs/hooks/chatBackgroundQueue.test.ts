import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUSY_NOTICE, MAX_POLLS, POLL_MS, isTurnPending } from './chatBackgroundQueue.ts';

type Msg = { role: 'user' | 'assistant' };

test('tin cuối = user → turn đang chạy nền (cần chờ + poll)', () => {
  assert.equal(isTurnPending([{ role: 'user' }]), true);
  assert.equal(isTurnPending([{ role: 'assistant' }, { role: 'user' }]), true);
});

test('tin cuối = assistant → đã có trả lời, KHÔNG poll', () => {
  assert.equal(isTurnPending([{ role: 'user' }, { role: 'assistant' }]), false);
  assert.equal(isTurnPending([{ role: 'assistant' }]), false);
});

test('hội thoại rỗng → không coi là đang chờ (tránh poll nhầm)', () => {
  assert.equal(isTurnPending([]), false);
});

test('chuyển trạng thái khi reply về: pending → không pending', () => {
  const before: Msg[] = [{ role: 'user' }];
  const after: Msg[] = [...before, { role: 'assistant' }];
  assert.equal(isTurnPending(before), true);
  assert.equal(isTurnPending(after), false);
});

test('hằng số cấu hình hợp lệ (nhịp/dừng poll thực sự dừng, không vô hạn)', () => {
  assert.equal(POLL_MS, 2500);
  assert.ok(Number.isInteger(MAX_POLLS) && MAX_POLLS > 0, 'MAX_POLLS phải là số nguyên dương để dừng poll');
  assert.equal(BUSY_NOTICE, 'Đang bận, thử lại sau.'); // phải khớp detail 429 backend để nhận diện "bận"
});
