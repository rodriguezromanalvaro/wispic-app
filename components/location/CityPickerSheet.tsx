import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, TextInput as RNTextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { CityRow, nearestCities, haversineKm } from '../../lib/location/geo';
import { useToast } from '../../lib/toast';

type GeoSelection = { kind: 'geo'; label: string; lat: number; lng: number };
type Props = {
  visible: boolean;
  onClose: () => void;
  // If used from eventos tab, we'll pass DB city id; if used from perfil, we can pass a custom free-text city
  onSelect: (city: { id: number; name: string } | { id: 'all'; name: string } | { id: 'custom'; name: string } | GeoSelection) => void;
  showAllOption?: boolean;
  enableUseCurrent?: boolean;
  // When true, selecting un-catalogued places (geocoding) will pass text instead of mapping to DB city
  forProfile?: boolean;
};

export const CityPickerSheet: React.FC<Props> = ({ visible, onClose, onSelect, showAllOption = true, enableUseCurrent = true, forProfile = false }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [resolvingCurrent, setResolvingCurrent] = useState(false);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [globalResults, setGlobalResults] = useState<Array<{ label: string; placeId?: string; lat?: number; lng?: number }>>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const placesKey = (Constants?.expoConfig as any)?.extra?.placesApiKey || (Constants?.manifest as any)?.extra?.placesApiKey;
  const [sessionToken, setSessionToken] = useState<string>('');

  // Remove accents in a broadly compatible way for RN/Hermes
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const findCityByName = (name: string | null | undefined, list: CityRow[] | undefined) => {
    if (!name || !list) return null;
    const target = norm(name);
    return list.find(c => norm(c.name) === target) || null;
  };

  function newSessionToken() {
    // Lightweight token good enough for session grouping
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  useEffect(() => {
    if (visible) {
      setSessionToken(newSessionToken());
    } else {
      setSearch('');
      setGlobalResults([]);
    }
  }, [visible]);

  const { data: cities, isLoading } = useQuery<CityRow[]>({
    queryKey: ['cities:with-geo'],
    queryFn: async () => {
      // Try selecting lat/lng; if columns don't exist, fallback to name-only
      const trySelect = async (cols: string) => {
        const { data, error } = await supabase.from('cities').select(cols).order('name');
        if (error) throw error;
        return data as any[];
      };
      try {
        return await trySelect('id,name,country,lat,lng');
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('column') && (msg.includes('lat') || msg.includes('lng'))) {
          const fallback = await trySelect('id,name,country');
          return fallback.map((c: any) => ({ ...c, lat: null, lng: null }));
        }
        throw e;
      }
    },
  });

  const filtered = useMemo(() => {
    const list = cities || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c => c.name.toLowerCase().includes(q));
  }, [cities, search]);

  // Global search: prefer Google Places Autocomplete if key present; fallback to expo-location geocoder
  useEffect(() => {
    if (!visible) return; // avoid work when hidden
    const q = search.trim();
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (q.length < 2) { setGlobalResults([]); setSearchingGlobal(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        setSearchingGlobal(true);
        if (placesKey) {
          // Autocomplete for cities only; do NOT fetch details here (cost optimization)
          const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&language=es&sessiontoken=${encodeURIComponent(sessionToken)}&key=${encodeURIComponent(placesKey)}`;
          const res = await fetch(url);
          const json = await res.json();
          const predictions = Array.isArray(json?.predictions) ? json.predictions : [];
          const out: Array<{ label: string; placeId: string }> = predictions.slice(0, 8).map((p: any) => ({ label: p.description, placeId: p.place_id }));
          setGlobalResults(out);
        } else {
          // Fallback to system geocoder
          const ExpoLocation = await import('expo-location');
          const results = await ExpoLocation.geocodeAsync(q);
          const mapped: Array<{ label: string; lat: number; lng: number }> = (results || []).map((r: any) => {
            const parts: string[] = [];
            const n = (r.name || r.city || r.subregion || r.region || '').toString().trim();
            const country = (r.country || '').toString().trim();
            if (n) parts.push(n);
            if (country) parts.push(country);
            const label = parts.filter(Boolean).join(', ') || q;
            return { label, lat: r.latitude, lng: r.longitude };
          });
          const seen = new Set<string>();
          const unique = mapped.filter(m => { if (seen.has(m.label)) return false; seen.add(m.label); return true; });
          setGlobalResults(unique);
        }
      } catch (e) {
        setGlobalResults([]);
      } finally {
        setSearchingGlobal(false);
      }
    }, 300);
    return () => { if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; } };
  }, [search, visible, sessionToken, placesKey]);

  async function useCurrentLocation() {
    try {
      setResolvingCurrent(true);
      const ExpoLocation = await import('expo-location');
      const perm = await ExpoLocation.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== 'granted') {
        const req = await ExpoLocation.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') { setResolvingCurrent(false); return; }
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      // Intentar registrar ciudad canónica vía RPC usando reverse geocode
      try {
        const r = await ExpoLocation.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const item: any = r?.[0] || {};
        const cityName = (item.city || item.district || item.subregion || item.region || '').toString();
        const cc = (item.isoCountryCode || item.countryCode || '').toString();
        if (cityName && cc) {
          const { data: upsertId, error } = await supabase.rpc('upsert_city_from_place', {
            p_name: cityName,
            p_country_code: cc,
            p_lat: pos.coords.latitude,
            p_lng: pos.coords.longitude,
            p_google_place_id: null,
            p_country: (item.country || null) as any,
          });
          if (!error && typeof upsertId === 'number') {
            onSelect({ id: upsertId, name: cityName });
            qc.invalidateQueries({ queryKey: ['cities'] });
            qc.invalidateQueries({ queryKey: ['cities:with-geo'] });
            onClose();
            return;
          }
        }
      } catch {}

      // Fallback final: nearest con umbral amplio, si nada más funcionó
      const list = cities || [];
      const nearest = nearestCities(list, { lat: pos.coords.latitude, lng: pos.coords.longitude }, 1)[0];
      if (nearest && typeof nearest.lat === 'number' && typeof nearest.lng === 'number') {
        const d = haversineKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat: nearest.lat, lng: nearest.lng });
        if (d <= 50) {
          onSelect({ id: nearest.id, name: nearest.name });
          onClose();
          return;
        }
      }
      onSelect({ id: 'all', name: 'Todas' } as any);
      onClose();
    } catch {
      // silent
    } finally {
      setResolvingCurrent(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={{ marginTop: 'auto' }}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.bg,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '88%',
              paddingBottom: 8 + insets.bottom,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >
          <View style={{ padding: 12, paddingBottom: 6 }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>Elige ubicación</Text>
            <RNTextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar ubicación…"
              placeholderTextColor={theme.colors.textDim}
              style={{ marginTop: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, backgroundColor: theme.colors.card }}
            />
          </View>
          {isLoading ? (
            <View style={{ padding: 16 }}><ActivityIndicator color={theme.colors.primary} /></View>
          ) : (
            <ScrollView style={{ paddingHorizontal: 8 }} contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}>
              {showAllOption && (
                <Pressable onPress={() => { onSelect({ id: 'all', name: 'Todas' } as any); onClose(); }} style={{ paddingHorizontal: 8, paddingVertical: 10, borderRadius: 8 }}>
                  <Text style={{ color: theme.colors.text }}>Todas las ciudades</Text>
                </Pressable>
              )}

              {enableUseCurrent && (
                <Pressable onPress={useCurrentLocation} disabled={resolvingCurrent} style={{ paddingHorizontal: 8, paddingVertical: 10, borderRadius: 8, opacity: resolvingCurrent ? 0.6 : 1 }}>
                  <Text style={{ color: theme.colors.primary }}>{resolvingCurrent ? 'Detectando ubicación…' : 'Usar mi ubicación actual'}</Text>
                </Pressable>
              )}

              {filtered.map((c) => (
                <Pressable key={c.id} onPress={() => { onSelect({ id: c.id, name: c.name }); onClose(); }} style={{ paddingHorizontal: 8, paddingVertical: 10, borderRadius: 8 }}>
                  <Text style={{ color: theme.colors.text }}>{c.name}</Text>
                </Pressable>
              ))}

              {/* Global results (from geocoder) */}
              {!!globalResults.length && (
                <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
                  <Text style={{ color: theme.colors.textDim, fontSize: 12, marginBottom: 6 }}>Resultados {placesKey ? 'de Google' : 'globales'}</Text>
                </View>
              )}
              {searchingGlobal && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              )}
              {globalResults.map((r, idx) => {
                return (
                  <Pressable
                    key={`${r.label}-${r.placeId || idx}`}
                    onPress={async () => {
                      try {
                        let label = r.label;
                        let coords: { lat: number; lng: number } | null = null;
                        if (placesKey && r.placeId) {
                          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(r.placeId)}&fields=geometry/location,name,formatted_address,address_component&language=es&sessiontoken=${encodeURIComponent(sessionToken)}&key=${encodeURIComponent(placesKey)}`;
                          const dRes = await fetch(detailUrl);
                          const dJson = await dRes.json();
                          const loc = dJson?.result?.geometry?.location;
                          const formatted = dJson?.result?.formatted_address;
                          const comps: Array<{ long_name: string; short_name: string; types: string[] }> = dJson?.result?.address_components || dJson?.result?.address_component || [];
                          // Prefer 'locality' or 'postal_town', fallback to admin levels
                          const fromComps = () => {
                            if (!Array.isArray(comps)) return null;
                            const pick = (t: string) => comps.find(c => Array.isArray(c.types) && c.types.includes(t))?.long_name || null;
                            return pick('locality') || pick('postal_town') || pick('administrative_area_level_3') || pick('administrative_area_level_2') || pick('administrative_area_level_1') || null;
                          };
                          let compCity = fromComps();
                          let compCountry = Array.isArray(comps) ? (comps.find(c => c.types?.includes('country'))?.long_name || null) : null;
                          let compCountryCode = Array.isArray(comps) ? (comps.find(c => c.types?.includes('country'))?.short_name || null) : null;
                          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                            coords = { lat: loc.lat, lng: loc.lng };
                          }
                          if (formatted) label = formatted;
                          // Try direct match by name if available
                          const byName = compCity ? findCityByName(compCity, cities) : null;
                          if (!forProfile && byName) {
                            onSelect({ id: byName.id, name: byName.name });
                            setSessionToken(newSessionToken());
                            // Best effort refresh
                            qc.invalidateQueries({ queryKey: ['cities'] });
                            qc.invalidateQueries({ queryKey: ['cities:with-geo'] });
                            onClose();
                            return;
                          }
                          // If missing city/country, try reverse geocode via device (sin coste)
                          if ((!compCity || !compCountryCode) && coords) {
                            try {
                              const ExpoLocation = await import('expo-location');
                              const rr = await ExpoLocation.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
                              const ii: any = rr?.[0] || {};
                              compCity = compCity || (ii.city || ii.district || ii.subregion || ii.region || '').toString();
                              if (!compCountryCode) compCountryCode = (ii.isoCountryCode || ii.countryCode || '').toString();
                              if (!compCountry && ii.country) compCountry = ii.country.toString();
                            } catch {}
                          }
                          // Upsert via RPC para tener un city_id real
                          if (!forProfile && compCity && compCountryCode && coords) {
                            const { data: upsertId, error } = await supabase.rpc('upsert_city_from_place', {
                              p_name: compCity,
                              p_country_code: compCountryCode,
                              p_lat: coords.lat,
                              p_lng: coords.lng,
                              p_google_place_id: r.placeId,
                              p_country: compCountry || null,
                            });
                            if (!error && typeof upsertId === 'number') {
                              // Devolvemos coordenadas para filtros por radio en la pestaña de eventos
                              onSelect({ kind:'geo', label: compCity, lat: coords.lat, lng: coords.lng });
                              setSessionToken(newSessionToken());
                              qc.invalidateQueries({ queryKey: ['cities'] });
                              qc.invalidateQueries({ queryKey: ['cities:with-geo'] });
                              onClose();
                              return;
                            }
                          }
                        } else if (typeof r.lat === 'number' && typeof r.lng === 'number') {
                          coords = { lat: r.lat, lng: r.lng };
                        }

                        if (forProfile) {
                          onSelect({ id: 'custom', name: label });
                          setSessionToken(newSessionToken());
                          onClose();
                          return;
                        }

                        // Último recurso: si no pudimos upsert, intentamos nearest suave
                        if (!forProfile && coords) {
                          onSelect({ kind:'geo', label, lat: coords.lat, lng: coords.lng });
                          setSessionToken(newSessionToken());
                          onClose();
                          return;
                        }
                        // Fallback seguro: si no podemos mapear a DB, volvemos a 'todas'
                        onSelect({ id: 'all', name: 'Todas' });
                        setSessionToken(newSessionToken());
                        onClose();
                      } catch {
                        onSelect({ id: 'all', name: 'Todas' });
                        setSessionToken(newSessionToken());
                        onClose();
                      }
                    }}
                    style={{ paddingHorizontal: 8, paddingVertical: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: theme.colors.text }}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

export default CityPickerSheet;
