import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioContext, PORTFOLIO_MAX } from './portfolioContext.ts';
import { PORTFOLIO_GREETING } from './portfolioMeta.ts';

test('mã cổ phiếu luôn VIẾT HOA trong ngữ cảnh', () => {
  const ctx = buildPortfolioContext({ name: 'Danh mục A', symbols: ['hpg', 'mwg'] });
  assert.ok(ctx.includes('HPG') && ctx.includes('MWG'), 'phải viết hoa mã');
  assert.ok(!ctx.includes('hpg'), 'không để mã chữ thường');
  assert.ok(ctx.includes('Danh mục A'), 'phải kèm tên danh mục');
});

test('có phaseLabel thì kèm dòng giai đoạn thị trường', () => {
  const ctx = buildPortfolioContext({ name: 'X', symbols: ['FPT'], phaseLabel: 'UPTREND', exposureHint: '100%' });
  assert.ok(/giai đoạn/i.test(ctx), 'phải nhắc giai đoạn thị trường');
  assert.ok(ctx.includes('UPTREND'));
});

test('không phaseLabel thì không chèn dòng giai đoạn', () => {
  const ctx = buildPortfolioContext({ name: 'X', symbols: ['FPT'] });
  assert.ok(!/giai đoạn/i.test(ctx), 'không có phase thì không nhắc');
});

test('ngữ cảnh không vượt giới hạn độ dài', () => {
  const many = Array.from({ length: 200 }, (_, i) => `MA${i}`);
  const ctx = buildPortfolioContext({ name: 'To', symbols: many, phaseLabel: 'SIDEWAY', exposureHint: '50%' });
  assert.ok(ctx.length <= PORTFOLIO_MAX, `phải cắt ≤ ${PORTFOLIO_MAX}, đang ${ctx.length}`);
});

test('greeting hợp lệ', () => {
  assert.ok(PORTFOLIO_GREETING.trim().length > 0, 'greeting không rỗng');
});
