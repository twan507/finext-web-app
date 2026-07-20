import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInternalPath } from './urlSafety.ts';

test('giữ nguyên đường dẫn nội bộ hợp lệ', () => {
    assert.equal(sanitizeInternalPath('/admin/users'), '/admin/users');
    assert.equal(sanitizeInternalPath('/'), '/');
    assert.equal(sanitizeInternalPath('/stocks/HPG?tab=news#top'), '/stocks/HPG?tab=news#top');
});

test('cắt khoảng trắng thừa nhưng vẫn giữ đường dẫn nội bộ', () => {
    assert.equal(sanitizeInternalPath('  /watchlist  '), '/watchlist');
});

test('chặn absolute URL (https) → về /', () => {
    assert.equal(sanitizeInternalPath('https://evil.com'), '/');
});

test('chặn http:// → về /', () => {
    assert.equal(sanitizeInternalPath('http://x'), '/');
});

test('chặn protocol-relative // → về /', () => {
    assert.equal(sanitizeInternalPath('//evil.com'), '/');
});

test('chặn thủ thuật backslash /\\ → về /', () => {
    assert.equal(sanitizeInternalPath('/\\evil.com'), '/');
    assert.equal(sanitizeInternalPath('/\\/evil.com'), '/');
});

test('chặn scheme javascript: → về /', () => {
    assert.equal(sanitizeInternalPath('javascript:alert(1)'), '/');
});

test('chặn chuỗi chứa :// → về /', () => {
    assert.equal(sanitizeInternalPath('/redirect://evil.com'), '/');
});

test('chặn ký tự điều khiển (tab/newline) né lọc trình duyệt → về /', () => {
    assert.equal(sanitizeInternalPath('/\t/evil.com'), '/');
    assert.equal(sanitizeInternalPath('/\n//evil.com'), '/');
});

test('null / rỗng / chỉ khoảng trắng → về /', () => {
    assert.equal(sanitizeInternalPath(null), '/');
    assert.equal(sanitizeInternalPath(''), '/');
    assert.equal(sanitizeInternalPath('   '), '/');
    assert.equal(sanitizeInternalPath(undefined), '/');
});
