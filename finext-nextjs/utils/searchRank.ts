// Match-based ranking cho thanh tìm kiếm ticker:
// exact (0) → startsWith (1) → contains tại idx (2 + idx).
// Tie-break: trường primary ngắn hơn trước → alphabetical.

export function matchScore(text: string | undefined | null, query: string): number {
    if (!text) return 999;
    const t = text.toUpperCase();
    if (t === query) return 0;
    if (t.startsWith(query)) return 1;
    const idx = t.indexOf(query);
    return idx >= 0 ? 2 + idx : 999;
}

export function rankByMatch<T>(
    items: T[],
    query: string,
    getFields: (item: T) => Array<string | undefined | null>,
): T[] {
    const trimmed = query.trim();
    if (!trimmed) return items;
    const q = trimmed.toUpperCase();

    return [...items]
        .map(item => {
            const fields = getFields(item);
            const score = Math.min(...fields.map(f => matchScore(f, q)));
            const primary = (fields[0] ?? '').toUpperCase();
            return { item, score, primary };
        })
        .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            if (a.primary.length !== b.primary.length) return a.primary.length - b.primary.length;
            return a.primary.localeCompare(b.primary);
        })
        .map(x => x.item);
}
