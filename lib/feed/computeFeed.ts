// Extracted pure logic for ordering & filtering the events feed so we can unit test it.
export type FeedScope = 'all' | 'series' | 'events';
export type RangeFilter = 'today' | '7' | '30' | 'all';

// Minimal shapes needed for computation
export interface SeriesVenue { name?: string | null }
export interface SeriesNextEvent { id: number; start_at: string; city?: string | null; city_id?: number | null; title?: string | null }
export interface EventData { id: number; start_at: string; city?: string | null; city_id?: number | null; title?: string | null; venue?: SeriesVenue }

export interface SeriesItem {
  kind: 'series';
  id: string; // e.g. s-<id>
  series: { id: number; title?: string | null; venue?: SeriesVenue };
  nextEv: SeriesNextEvent;
  sponsoredPriority?: number;
}

export interface EventItem {
  kind: 'event';
  id: string; // e.g. e-<id>
  ev: EventData;
  sponsoredPriority?: number;
}

export type RawFeedItem = SeriesItem | EventItem;

export interface ComputeFeedParams {
  data: RawFeedItem[] | undefined | null;
  range: RangeFilter;
  search: string;
  selectedCityId: number | 'all';
  feedScope: FeedScope;
  now?: Date; // injectable for tests
}

export function computeFeed({ data, range, search, selectedCityId, feedScope, now = new Date() }: ComputeFeedParams): RawFeedItem[] {
  if (!data || !data.length) return [];
  const nowTs = now.getTime();
  let limit: number | null = null;
  if (range === 'today') {
    const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999); limit = todayEnd.getTime();
  } else if (range === '7') limit = nowTs + 7*24*60*60*1000;
  else if (range === '30') limit = nowTs + 30*24*60*60*1000;

  const q = search.trim().toLowerCase();
  let base: RawFeedItem[] = data;
  if (feedScope === 'series') base = base.filter(i=>i.kind==='series');
  else if (feedScope === 'events') base = base.filter(i=>i.kind==='event');

  const filtered = base.filter(item => {
    const isSeries = item.kind === 'series';
    const when = isSeries ? item.nextEv.start_at : item.ev.start_at;
    const t = new Date(when).getTime();
    if (limit!==null && t>limit) return false;
    const cityId = isSeries ? item.nextEv.city_id : item.ev.city_id;
    if (selectedCityId !== 'all' && cityId !== selectedCityId) return false;
    if (q) {
      const evTitle = isSeries ? (item.series.title || item.nextEv.title || '') : (item.ev.title || '');
      const venueName = isSeries ? (item.series.venue?.name || '') : (item.ev.venue?.name || '');
      const city = isSeries ? (item.nextEv.city || '') : (item.ev.city || '');
      const hay = `${evTitle.toLowerCase()} ${venueName.toLowerCase()} ${city.toLowerCase()}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const cmp = (a: RawFeedItem, b: RawFeedItem) => {
    const ap = a.sponsoredPriority || 0; const bp = b.sponsoredPriority || 0;
    if (ap!==bp) return bp-ap;
    const at = new Date(a.kind==='series'?a.nextEv.start_at:a.ev.start_at).getTime();
    const bt = new Date(b.kind==='series'?b.nextEv.start_at:b.ev.start_at).getTime();
    return at-bt;
  };

  if (feedScope==='all') {
    const s = filtered.filter(i=>i.kind==='series').sort(cmp);
    const e = filtered.filter(i=>i.kind==='event').sort(cmp);
    return [...s,...e];
  }
  return filtered.sort(cmp);
}

export interface ComputeSectionsParams extends Omit<ComputeFeedParams,'feedScope'> {
  feedScope: FeedScope;
}

export interface FeedSection { title: string; data: RawFeedItem[] }

export function computeSections(params: ComputeSectionsParams): FeedSection[] {
  const list = computeFeed(params);
  if (params.feedScope === 'series') return [{ title:'LOCALES', data: list }];
  if (params.feedScope === 'events') return [{ title:'EVENTOS', data: list }];
  const series = list.filter(i=>i.kind==='series');
  const events = list.filter(i=>i.kind==='event');
  const out: FeedSection[] = [];
  if (series.length) out.push({ title:'LOCALES', data: series });
  if (events.length) out.push({ title:'EVENTOS', data: events });
  return out;
}
