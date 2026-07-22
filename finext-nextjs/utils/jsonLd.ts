/**
 * Serialize JSON-LD an toàn để nhúng vào <script type="application/ld+json">.
 *
 * JSON.stringify KHÔNG escape '<', nên một chuỗi chứa "</script>" trong dữ liệu
 * (title, sapo... đến từ pipeline crawler bên ngoài) sẽ đóng sớm thẻ script và
 * cho phép chèn mã tuỳ ý — XSS server-rendered trên trang public.
 *
 * Escape thêm U+2028/U+2029: hợp lệ trong JSON nhưng là line terminator trong
 * JavaScript, gây syntax error khi parse.
 */
export function serializeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
