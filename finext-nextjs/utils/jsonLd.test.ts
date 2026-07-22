import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeJsonLd } from './jsonLd.ts';

test('escape "<" nên không thể đóng sớm thẻ script', () => {
    const out = serializeJsonLd({ title: 'Tin</script><script>alert(1)</script>' });
    assert.ok(!out.includes('</script>'), 'không được còn chuỗi </script> thô');
    assert.ok(!out.includes('<'), 'không được còn ký tự < nào');
    assert.ok(out.includes('\\u003c'), 'phải escape thành \\u003c');
});

test('escape U+2028/U+2029 (line terminator trong JS)', () => {
    const out = serializeJsonLd({ sapo: String.fromCharCode(0x2028) + String.fromCharCode(0x2029) });
    assert.ok(!out.includes(String.fromCharCode(0x2028)));
    assert.ok(!out.includes(String.fromCharCode(0x2029)));
    assert.ok(out.includes('\\u2028'));
    assert.ok(out.includes('\\u2029'));
});

test('kết quả vẫn parse lại được và giữ nguyên dữ liệu', () => {
    const data = { '@type': 'NewsArticle', title: 'FPT </script> tăng 5%', n: 1, ok: true };
    assert.deepEqual(JSON.parse(serializeJsonLd(data)), data);
});

test('dữ liệu bình thường không bị đổi', () => {
    const data = { '@context': 'https://schema.org', headline: 'VNINDEX tăng điểm' };
    assert.equal(serializeJsonLd(data), JSON.stringify(data));
});
