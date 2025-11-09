// Utilities to resolve localized prompt content with a consistent fallback chain
// Minimal surface for Phase 1: locale chain + labels merge + title pick

export function getLocaleChain(current: string | undefined | null): string[] {
  const lang = String(current || 'en').split('-')[0].toLowerCase();
  // Preferred order: current -> es -> en (unique)
  const chain = [lang, 'es', 'en'];
  return Array.from(new Set(chain.filter(Boolean)));
}

export function parseLabels(val: any): Record<string, string> | null {
  if (!val) return null;
  if (typeof val === 'object') return val as Record<string, string>;
  try { return JSON.parse(val); } catch { return null; }
}

export function pickFirstNonEmptyTitle(locByLocale: Record<string, any> | undefined, chain: string[]): string | undefined {
  if (!locByLocale) return undefined;
  for (const loc of chain) {
    const row = locByLocale[loc];
    const title = row?.title;
    if (typeof title === 'string' && title.trim()) return title.trim();
  }
  return undefined;
}

export function pickFirstNonEmptyPlaceholder(locByLocale: Record<string, any> | undefined, chain: string[]): string | undefined {
  if (!locByLocale) return undefined;
  for (const loc of chain) {
    const row = locByLocale[loc];
    const ph = row?.placeholder;
    if (typeof ph === 'string' && ph.trim()) return ph.trim();
  }
  return undefined;
}

export function mergeChoiceLabels(locByLocale: Record<string, any> | undefined, chain: string[]): Record<string, string> | null {
  if (!locByLocale) return null;
  // Start from least preferred and let preferred override
  const precedence = [...chain].reverse();
  const merged: Record<string, string> = {};
  for (const loc of precedence) {
    const parsed = parseLabels(locByLocale[loc]?.choices_labels);
    if (parsed) Object.assign(merged, parsed);
  }
  return Object.keys(merged).length ? merged : null;
}
