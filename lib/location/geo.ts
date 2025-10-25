// Small geo helpers for city distance and nearest selection
export type CityRow = { id: number; name: string; country?: string | null; lat?: number | null; lng?: number | null };

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon));
  return R * c;
}

export function toRad(deg: number) { return (deg * Math.PI) / 180; }

export function nearestCities(
  cities: CityRow[],
  coords: { lat: number; lng: number },
  limit = 6
) {
  const withCoords = cities.filter(c => typeof c.lat === 'number' && typeof c.lng === 'number') as Required<CityRow>[];
  const scored = withCoords.map(c => ({ city: c, d: haversineKm(coords, { lat: c.lat!, lng: c.lng! }) }));
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, Math.max(0, limit)).map(s => s.city);
}
