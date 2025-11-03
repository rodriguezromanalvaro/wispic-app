import { computeFeed, computeSections, RawFeedItem } from 'lib/feed/computeFeed';

const baseNow = new Date('2025-10-05T12:00:00Z');
const iso = (offsetHours: number) => new Date(baseNow.getTime() + offsetHours*3600*1000).toISOString();

function mkSeries(id: number, priority: number, offsetHours: number, cityId=1): RawFeedItem {
  return {
    kind: 'series',
    id: `s-${id}`,
    series: { id, title: `Serie ${id}`, venue: { name: `Local ${id}` } },
    nextEv: { id: 1000+id, start_at: iso(offsetHours), city: 'CiudadA', city_id: cityId, title: `Serie ${id}` },
    sponsoredPriority: priority,
  } as any;
}

function mkEvent(id: number, priority: number, offsetHours: number, cityId=1): RawFeedItem {
  return {
    kind: 'event',
    id: `e-${id}`,
    ev: { id, title: `Evento ${id}`, start_at: iso(offsetHours), city: 'CiudadA', city_id: cityId, venue: { name: `Venue ${id}` } },
    sponsoredPriority: priority,
  } as any;
}

describe('computeFeed ordering & filtering', () => {
  const data: RawFeedItem[] = [
    mkEvent(1, 0, 5),
    mkEvent(2, 2, 2),
    mkSeries(10, 1, 1),
    mkSeries(11, 3, 4),
    mkEvent(3, 0, 1),
  ];

  test('feedScope=all groups series first then events, ordered by priority then time', () => {
    const res = computeFeed({ data, range:'all', search:'', selectedCityId:'all', feedScope:'all', now: baseNow });
    expect(res.map(i=>i.id)).toEqual(['s-11','s-10','e-2','e-3','e-1']);
  });

  test('feedScope=series only series', () => {
    const res = computeFeed({ data, range:'all', search:'', selectedCityId:'all', feedScope:'series', now: baseNow });
    expect(res.every(i=>i.kind==='series')).toBe(true);
  });

  test('range=7 filters out events beyond 7 days', () => {
    const farEvent = mkEvent(50,0, 24*8); // +8 days
    const res = computeFeed({ data:[...data, farEvent], range:'7', search:'', selectedCityId:'all', feedScope:'all', now: baseNow });
    expect(res.find(i=>i.id==='e-50')).toBeUndefined();
  });

  test('city filter excludes other cities', () => {
    const otherCitySeries = mkSeries(20,0,2, 999);
    const res = computeFeed({ data:[...data, otherCitySeries], range:'all', search:'', selectedCityId:1, feedScope:'all', now: baseNow });
    expect(res.find(i=>i.id==='s-20')).toBeUndefined();
  });

  test('search matches by title / venue / city (case-insensitive)', () => {
    const res = computeFeed({ data, range:'all', search:'evento 2', selectedCityId:'all', feedScope:'all', now: baseNow });
    expect(res.map(i=>i.id)).toEqual(['e-2']);
  });

  test('computeSections builds correct section titles', () => {
    const sections = computeSections({ data, range:'all', search:'', selectedCityId:'all', feedScope:'all', now: baseNow });
    expect(sections.map(s=>s.title)).toEqual(['LOCALES','EVENTOS']);
    expect(sections[0].data.every(i=>i.kind==='series')).toBe(true);
    expect(sections[1].data.every(i=>i.kind==='event')).toBe(true);
  });

  test('empty data returns empty list', () => {
    const res = computeFeed({ data: [], range:'all', search:'', selectedCityId:'all', feedScope:'all', now: baseNow });
    expect(res).toEqual([]);
  });

  test('tie in priority orders by earlier time', () => {
    const tData: RawFeedItem[] = [
      mkEvent(90, 1, 10), // later
      mkEvent(91, 1, 2),  // earlier
    ];
    const res = computeFeed({ data: tData, range:'all', search:'', selectedCityId:'all', feedScope:'events', now: baseNow });
    expect(res.map(i=>i.id)).toEqual(['e-91','e-90']);
  });

  test('search no results gives empty list', () => {
    const res = computeFeed({ data, range:'all', search:'inexistente', selectedCityId:'all', feedScope:'all', now: baseNow });
    expect(res.length).toBe(0);
  });

  test('range today excludes tomorrow', () => {
    const tomorrowEvent = mkEvent(77,0, 24); // +24h
    const todayEvent = mkEvent(78,0, 1); // +1h
    const res = computeFeed({ data:[tomorrowEvent, todayEvent], range:'today', search:'', selectedCityId:'all', feedScope:'events', now: baseNow });
    expect(res.map(i=>i.id)).toEqual(['e-78']);
  });
});
