import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPageContext, getSuggestionPool, getSuggestions, hasBubble,
  BUBBLE_GREETINGS, PAGE_CONTEXT_MAX, SUGGESTIONS_SHOWN,
} from './chatPageContext.ts';

const ROUTES_CO_BUBBLE = [
  '/', '/markets', '/phase', '/stocks', '/sectors', '/groups',
  '/commodities', '/macro', '/international', '/watchlist',
  '/stocks/HPG', '/sectors/nganhang', '/groups/FNXINDEX', '/charts/VNINDEX',
];

/** Mọi tổ hợp trang · tab có kho riêng — phải phủ hết, không được rơi về kho mặc định của trang. */
const TABS_THEO_TRANG: Record<string, string[]> = {
  '/markets': ['volatility', 'cashflow', 'valuation', 'ptkt', 'foreign', 'proprietary'],
  '/phase': ['conservative', 'aggressive', 'core'],
  '/commodities': ['metals', 'energy', 'chemical', 'agriculture'],
  '/macro': ['economy', 'monetary', 'exchange_rate'],
  '/international': ['global_index', 'fx', 'bonds', 'crypto'],
  '/stocks/HPG': ['cashflow', 'pricemap', 'financials', 'news'],
  '/sectors/nganhang': ['cashflow', 'stocks', 'financials', 'news'],
};

test('đủ 14 trang sản phẩm đều dựng được ngữ cảnh', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const ctx = buildPageContext(r);
    assert.ok(ctx, `thiếu ngữ cảnh cho ${r}`);
    assert.ok(!ctx.includes('NGỮ CẢNH TRANG'), `nhãn thừa ở ${r} — backend đã chèn`);
    assert.ok(ctx.startsWith('Trang: '), `thiếu tên trang ở ${r}`);
    assert.ok(hasBubble(r), `hasBubble sai ở ${r}`);
  }
});

test('buildPageContext KHÔNG tự chèn nhãn — backend sở hữu phần bọc', () => {
  const ctx = buildPageContext('/stocks/HPG');
  assert.ok(ctx);
  assert.ok(!ctx.includes('NGỮ CẢNH TRANG'), 'nhãn do backend chèn, chèn ở đây là trùng hai lần');
});

test('trang ngoài danh sách không có ngữ cảnh và không có bubble', () => {
  for (const r of ['/chat', '/chat/abc', '/profile', '/profile/ai-usage', '/news', '/news/bai-viet', '/reports', '/plans', '/open-account', '/guides/overview', '/policies/privacy', '/support/email', '/charts']) {
    assert.equal(buildPageContext(r), undefined, `không được có ngữ cảnh ở ${r}`);
    assert.equal(hasBubble(r), false, `không được hiện bubble ở ${r}`);
  }
});

test('trang chi tiết đưa được chủ thể đang xem vào ngữ cảnh', () => {
  assert.ok(buildPageContext('/stocks/HPG')!.includes('HPG'));
  assert.ok(buildPageContext('/sectors/nganhang')!.includes('nganhang'));
  assert.ok(buildPageContext('/groups/FNXINDEX')!.includes('FNXINDEX'));
  assert.ok(buildPageContext('/charts/VNINDEX')!.includes('VNINDEX'));
});

test('tab trên URL được đưa vào ngữ cảnh', () => {
  const ctx = buildPageContext('/stocks/HPG', new URLSearchParams('tab=dongtien'));
  assert.ok(ctx!.includes('Tab: '), 'phải có dòng Tab khi URL có ?tab=');
});

test('tab lạ vẫn không làm hỏng ngữ cảnh', () => {
  const ctx = buildPageContext('/markets', new URLSearchParams('tab=khong-ton-tai'));
  assert.ok(ctx, 'tab lạ không được làm mất ngữ cảnh');
  assert.ok(ctx.includes('Trang: '));
});

test('đường dẫn có dấu / thừa vẫn khớp', () => {
  assert.ok(buildPageContext('/markets/'));
  assert.ok(buildPageContext('/stocks/HPG/'));
});

test('đường dẫn con không khai báo thì không khớp nhầm', () => {
  assert.equal(buildPageContext('/stocks/HPG/them/nua'), undefined);
});

test('ngữ cảnh không bao giờ vượt giới hạn độ dài', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    assert.ok(buildPageContext(r)!.length <= PAGE_CONTEXT_MAX, `quá dài ở ${r}`);
  }
});

test('ngữ cảnh không chứa chữ số (tránh guard chống bịa số chặn nhầm)', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const body = buildPageContext(r)!.split('\n').slice(1).join('\n'); // bỏ dòng "Trang:"
    assert.equal(/\d/.test(body), false, `phần mô tả của ${r} không được chứa số`);
  }
});

test('ngữ cảnh luôn kèm chỉ dẫn trả lời ngắn cho khung hẹp', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const ctx = buildPageContext(r)!;
    assert.ok(/hẹp/.test(ctx), `thiếu chỉ dẫn khung hẹp ở ${r}`);
    assert.ok(/ngắn gọn/.test(ctx), `thiếu chỉ dẫn trả lời ngắn ở ${r}`);
  }
});

test('mỗi trang có kho tối thiểu ba câu, không câu rỗng, không trùng nhau', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const pool = getSuggestionPool(r);
    assert.ok(pool.length >= 3, `${r} phải có ít nhất 3 câu trong kho, đang có ${pool.length}`);
    for (const q of pool) assert.ok(q.trim().length > 0, `câu rỗng trong kho của ${r}`);
    assert.equal(new Set(pool).size, pool.length, `kho của ${r} có câu trùng`);
  }
  assert.deepEqual(getSuggestionPool('/chat'), []);
  assert.deepEqual(getSuggestions('/chat'), []);
});

test('mỗi tab có kho riêng, tối thiểu ba câu và khác kho mặc định của trang', () => {
  for (const [route, tabs] of Object.entries(TABS_THEO_TRANG)) {
    const base = getSuggestionPool(route);
    for (const tab of tabs) {
      const pool = getSuggestionPool(route, new URLSearchParams(`tab=${tab}`));
      assert.ok(pool.length >= 3, `${route}?tab=${tab} phải có ít nhất 3 câu, đang có ${pool.length}`);
      for (const q of pool) assert.ok(q.trim().length > 0, `câu rỗng ở ${route}?tab=${tab}`);
      assert.notDeepEqual(pool, base, `${route}?tab=${tab} chưa có kho riêng`);
    }
  }
});

test('tab lạ rơi về kho mặc định của trang chứ không rỗng', () => {
  const pool = getSuggestionPool('/markets', new URLSearchParams('tab=khong-ton-tai'));
  assert.deepEqual(pool, getSuggestionPool('/markets'));
});

test('getSuggestions cắt đúng số câu giao diện render được', () => {
  for (const r of ROUTES_CO_BUBBLE) {
    const shown = getSuggestions(r);
    assert.ok(shown.length <= SUGGESTIONS_SHOWN, `${r} trả quá ${SUGGESTIONS_SHOWN} câu`);
    assert.deepEqual(shown, getSuggestionPool(r).slice(0, SUGGESTIONS_SHOWN), `${r} phải lấy đúng đầu kho`);
  }
});

test('câu hỏi không dùng tên tab nội bộ và không lộ slug đường dẫn', () => {
  const CAM = [/\btab\b/i, /nganhang/, /FNXINDEX/];
  for (const r of ROUTES_CO_BUBBLE) {
    const tabs = TABS_THEO_TRANG[r] ?? [];
    const pools = [getSuggestionPool(r), ...tabs.map((t) => getSuggestionPool(r, new URLSearchParams(`tab=${t}`)))];
    for (const q of pools.flat()) {
      for (const bad of CAM) assert.equal(bad.test(q), false, `câu "${q}" ở ${r} vi phạm ${bad}`);
    }
  }
});

test('gợi ý ở trang chi tiết cổ phiếu nhắc tên mã', () => {
  assert.ok(getSuggestions('/stocks/HPG').some((q) => q.includes('HPG')));
  assert.ok(getSuggestions('/charts/VNINDEX').some((q) => q.includes('VNINDEX')));
});

test('mã/chỉ số trong URL viết thường được VIẾT HOA ở câu gợi ý', () => {
  // /charts/fnxindex (slug thường từ URL) → câu gợi ý phải hiện 'FNXINDEX', không phải 'fnxindex'.
  const charts = getSuggestions('/charts/fnxindex');
  assert.ok(charts.some((q) => q.includes('FNXINDEX')), 'phải viết hoa FNXINDEX');
  assert.ok(!charts.some((q) => q.includes('fnxindex')), 'không được để nguyên chữ thường');
  assert.ok(getSuggestions('/stocks/vnm').some((q) => q.includes('VNM')), 'mã cổ phiếu cũng viết hoa');
  // Ngược lại: slug ngành KHÔNG viết hoa (đã dùng 'ngành này', không chèn slug).
  assert.ok(!getSuggestions('/sectors/nganhang').some((q) => q.includes('NGANHANG')), 'slug ngành giữ nguyên');
});

test('có nhiều câu chào để lớp UI xoay vòng', () => {
  assert.ok(BUBBLE_GREETINGS.length >= 3, 'cần ít nhất 3 câu chào');
  for (const g of BUBBLE_GREETINGS) assert.ok(g.trim().length > 0, 'câu chào rỗng');
  assert.equal(new Set(BUBBLE_GREETINGS).size, BUBBLE_GREETINGS.length, 'câu chào bị trùng');
});
