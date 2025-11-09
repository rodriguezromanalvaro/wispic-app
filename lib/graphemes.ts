// Utility helpers for counting and truncating by user-perceived characters (grapheme clusters).
// Uses Intl.Segmenter when available; falls back to code point iteration via Array.from.

export function countGraphemes(input: string | null | undefined): number {
  if (!input) return 0;
  try {
    // @ts-ignore: Segmenter might not be in lib.dom
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      // @ts-ignore
      const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
      let count = 0;
      for (const _ of seg.segment(input)) count++;
      return count;
    }
  } catch {}
  // Fallback: approximate by code points
  return Array.from(input).length;
}

export function truncateByGraphemes(input: string, max: number): string {
  if (max <= 0) return '';
  if (!input) return '';
  try {
    // @ts-ignore
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      // @ts-ignore
      const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
      const it = seg.segment(input)[Symbol.iterator]();
      let out = '';
      let i = 0;
      while (i < max) {
        const n = it.next();
        if (n.done) break;
        out += n.value.segment;
        i++;
      }
      return out;
    }
  } catch {}
  // Fallback: approximate by code points
  return Array.from(input).slice(0, max).join('');
}
