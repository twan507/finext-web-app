import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setToCache, getFromCache, hasFreshCache, clearApiCache } from './apiCache.ts';

const URL_A = '/api/v1/sse/rest/phase_rank';

test('hasFreshCache: chưa có entry → false', () => {
    clearApiCache();
    assert.equal(hasFreshCache(URL_A), false);
});

test('hasFreshCache: vừa ghi → true', () => {
    clearApiCache();
    setToCache(URL_A, { data: [1, 2, 3] });
    assert.equal(hasFreshCache(URL_A), true);
});

test('hasFreshCache: quá TTL → false', () => {
    clearApiCache();
    setToCache(URL_A, { data: [1] });
    // ttl âm: mọi elapsed (kể cả 0ms) đều vượt → chắc chắn coi là hết hạn.
    assert.equal(hasFreshCache(URL_A, undefined, -1), false);
});

test('hasFreshCache KHÔNG xoá entry (khác getFromCache)', () => {
    clearApiCache();
    setToCache(URL_A, { data: [1] });

    // Thăm dò với ttl=0 → báo hết hạn nhưng không được đụng vào cache.
    assert.equal(hasFreshCache(URL_A, undefined, -1), false);
    // Với TTL mặc định thì entry vẫn còn nguyên.
    assert.equal(hasFreshCache(URL_A), true);
    assert.notEqual(getFromCache(URL_A), null);
});

test('getFromCache XOÁ entry hết hạn (hành vi cũ, giữ nguyên)', () => {
    clearApiCache();
    setToCache(URL_A, { data: [1] });
    assert.equal(getFromCache(URL_A, undefined, -1), null);
    assert.equal(hasFreshCache(URL_A), false, 'entry đã bị getFromCache xoá');
});

test('cache phân biệt theo queryParams', () => {
    clearApiCache();
    setToCache(URL_A, { data: [1] }, { page: 1 });
    assert.equal(hasFreshCache(URL_A, { page: 1 }), true);
    assert.equal(hasFreshCache(URL_A, { page: 2 }), false);
});
