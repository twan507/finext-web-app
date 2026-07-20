// Bốc ngẫu nhiên cho nội dung bubble (câu chào, chip gợi ý, câu mời).
// CHỈ được gọi từ lớp đã chốt giá trị (useMemo / useState / useEffect) — gọi thẳng trong
// thân render sẽ đổi kết quả mỗi lần re-render và chữ nhảy loạn trước mắt user.

/** Một câu ngẫu nhiên; `avoid` để không lặp lại đúng câu vừa hiện. Kho rỗng → chuỗi rỗng. */
export function pickOne(items: readonly string[], avoid?: string): string {
  if (items.length === 0) return '';
  const rest = avoid ? items.filter((s) => s !== avoid) : items;
  const pool = rest.length > 0 ? rest : items; // kho chỉ có đúng câu cần tránh thì đành lặp
  return pool[Math.floor(Math.random() * pool.length)] ?? '';
}

/** Tối đa `n` câu khác nhau, thứ tự ngẫu nhiên. Kho ít hơn `n` thì trả về hết, không trùng. */
export function pickSome(items: readonly string[], n: number): string[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
}
