import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { View, StyleSheet, ScrollView, Platform, KeyboardAvoidingView, Pressable, Text, BackHandler } from 'react-native';

import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CenterScaffold } from 'components/Scaffold';
import { Screen, H1, P, TextInput, StickyFooterActions } from 'components/ui';
import { ProgressHeader } from 'features/owner/onboarding/ProgressHeader';
import { useOwnerOnboarding } from 'features/owner/onboarding/state';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import { supabase } from 'lib/supabase';
// import { useAuth } from 'lib/useAuth';

export default function OwnerBasic() {
	const store = useOwnerOnboarding();
	const insets = useSafeAreaInsets();
	// const { user } = useAuth();
	const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
		// removed cityDetecting local state (wasn't used for UI)
	const [cityDetectMsg, setCityDetectMsg] = useState<string | null>(null);
  const placesKey = (Constants?.expoConfig as any)?.extra?.placesApiKey || (Constants as any)?.manifest?.extra?.placesApiKey;
  const sessionTokenRef = useRef<string>('');
	useEffect(() => { sessionTokenRef.current = Math.random().toString(36).slice(2) + Date.now().toString(36); }, []);
	const [searching, setSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<Array<{ label:string; placeId?:string; lat?:number; lng?:number }>>([]);
	const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

	// Small diacritics-safe slugify (ASCII-only, hyphenated)
	const slugify = (s: string) =>
		s
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

	const canNext = useMemo(
		() => store.name.trim().length > 0 && (store.locationText?.trim().length ?? 0) > 0 && (!!store.cityId || !!store.placeId),
		[store.name, store.locationText, store.cityId, store.placeId]
	);

	// Load cities list once to map detected city name to our cityId
	useEffect(() => {
		let alive = true;
		(async () => {
			const { data, error } = await supabase.from('cities').select('id,name');
			if (!error && alive) setCities((data as any) ?? []);
		})();
		return () => { alive = false; };
	}, []);

	// Debounced geocoding of address to detect city via Google Places (fallback to device geocoder)
	useEffect(() => {
		const q = store.locationText?.trim() || '';
		if (store.placeId) {
			// If we have a placeId (user selected a suggestion), use Place Details directly
			let alive = true;
			setCityDetectMsg('Detectando ciudad…');
			(async () => {
				try {
					let cityName: string | null = null;
					let cc: string | null = null;
					  let lat: number | null = null;
					  let lon: number | null = null;
					if (placesKey) {
						const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(store.placeId as string)}&fields=address_component,geometry&language=es&sessiontoken=${encodeURIComponent(sessionTokenRef.current)}&key=${encodeURIComponent(placesKey)}`;
						const detRes = await fetch(detUrl);
						const det = await detRes.json();
						const comps: any[] = det?.result?.address_components || [];
						const byType = (t: string) => comps.find(c => Array.isArray(c.types) && c.types.includes(t));
						cityName = (byType('locality')?.long_name
							|| byType('postal_town')?.long_name
							|| byType('administrative_area_level_2')?.long_name
							|| byType('administrative_area_level_1')?.long_name
							|| null);
						const countryComp = byType('country');
						cc = countryComp?.short_name ? String(countryComp.short_name).toUpperCase() : null;
						const loc = det?.result?.geometry?.location;
						if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') { lat = loc.lat; lon = loc.lng; }
					}
					if (!alive) return;
					if (cityName) {
						const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
						const target = norm(cityName);
						const localFound = cities.find(c => norm(c.name) === target);
						if (localFound) {
							store.set({ cityId: localFound.id });
							setCityDetectMsg(`Ciudad detectada: ${localFound.name}`);
							return;
						}
						const slug = slugify(cityName);
						if (cc) {
							const slug = slugify(cityName);
							try {
								const { data: existing, error: selErr } = await supabase
									.from('cities')
									.select('id,name')
									.eq('slug', slug)
									.eq('country_code', cc)
									.maybeSingle();
								if (!selErr && (existing as any)?.id) {
									store.set({ cityId: (existing as any).id });
									setCityDetectMsg(`Ciudad detectada: ${(existing as any).name}`);
									setCities(prev => [...prev, { id: (existing as any).id, name: (existing as any).name }]);
									return;
								}
							} catch (e) {}
							// No intentamos crear desde aquí para evitar bloqueos por permisos; continuamos con placeId
							setCityDetectMsg(`Ciudad detectada: ${cityName}.`);
						} else {
							// Sin country_code: intentar por slug solamente
							try {
								const { data: existingSlug, error: selErr2 } = await supabase
									.from('cities')
									.select('id,name')
									.eq('slug', slug)
									.maybeSingle();
								if (!selErr2 && (existingSlug as any)?.id) {
									store.set({ cityId: (existingSlug as any).id });
									setCityDetectMsg(`Ciudad detectada: ${(existingSlug as any).name}`);
									setCities(prev => [...prev, { id: (existingSlug as any).id, name: (existingSlug as any).name }]);
									return;
								}
							} catch (e) {}
							setCityDetectMsg(`Ciudad detectada: ${cityName}.`);
						}
					}
					}
					catch (e) {
						if (alive) setCityDetectMsg('No se pudo detectar la ciudad (sin conexión o límite alcanzado).');
					}
				})();
			return () => { alive = false; };
		}
		if (q.length < 5) { setCityDetectMsg(null); return; }
		// no-op (spinner not shown in UI)
		setCityDetectMsg('Detectando ciudad…');
		let alive = true;
		const handle = setTimeout(async () => {
			try {
				let cityName: string | null = null;
				let cc: string | null = null;
				let lat: number | null = null;
				let lon: number | null = null;
				if (placesKey) {
					// Use Google Places: Find Place from Text -> Place Details
					const fpUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(q)}&inputtype=textquery&fields=place_id,geometry&language=es&key=${encodeURIComponent(placesKey)}`;
					const fpRes = await fetch(fpUrl);
					const fpJson = await fpRes.json();
					const cand = Array.isArray(fpJson?.candidates) && fpJson.candidates.length ? fpJson.candidates[0] : null;
					const placeId = cand?.place_id as string | undefined;
					if (cand?.geometry?.location) {
						lat = typeof cand.geometry.location.lat === 'number' ? cand.geometry.location.lat : null;
						lon = typeof cand.geometry.location.lng === 'number' ? cand.geometry.location.lng : null;
					}
					if (placeId) {
						const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_component,geometry&language=es&sessiontoken=${encodeURIComponent(sessionTokenRef.current)}&key=${encodeURIComponent(placesKey)}`;
						const detRes = await fetch(detUrl);
						const det = await detRes.json();
						const comps: any[] = det?.result?.address_components || [];
						const byType = (t: string) => comps.find(c => Array.isArray(c.types) && c.types.includes(t));
						cityName = (byType('locality')?.long_name
							|| byType('postal_town')?.long_name
							|| byType('administrative_area_level_2')?.long_name
							|| byType('administrative_area_level_1')?.long_name
							|| null);
						const countryComp = byType('country');
						cc = countryComp?.short_name ? String(countryComp.short_name).toUpperCase() : null;
												if (!lat || !lon) {
							const loc = det?.result?.geometry?.location;
							if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') { lat = loc.lat; lon = loc.lng; }
						}
					}
				} else {
					// Fallback to device geocoder (expo-location) if no key
					try {
						const ExpoLocation = await import('expo-location');
						const results = await (ExpoLocation as any).geocodeAsync(q);
						const g: any = results?.[0] || {};
						lat = typeof g.latitude === 'number' ? g.latitude : null;
						lon = typeof g.longitude === 'number' ? g.longitude : null;
						cityName = (g.city || g.subregion || g.region || null)?.toString() || null;
						cc = (g.isoCountryCode || g.countryCode || null)?.toString().toUpperCase() || null;
					} catch (e) {}
				}
				if (!alive) return;
				if (cityName) {
					// First, quick local exact (normalized) match by name
					const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
					const target = norm(cityName);
					const localFound = cities.find(c => norm(c.name) === target);
								if (localFound) {
									store.set({ cityId: localFound.id, lat, lng: lon });
						setCityDetectMsg(`Ciudad detectada: ${localFound.name}`);
						return;
					}

					// Robust lookup/upsert by slug + country_code when possible
					if (cc) {
						const slug = slugify(cityName);
						try {
							const { data: existing, error: selErr } = await supabase
								.from('cities')
								.select('id,name')
								.eq('slug', slug)
								.eq('country_code', cc)
								.maybeSingle();
											if (!selErr && existing?.id) {
												store.set({ cityId: existing.id, lat, lng: lon });
								setCityDetectMsg(`Ciudad detectada: ${existing.name}`);
								// Cache locally for next time
								setCities(prev => [...prev, { id: existing.id, name: existing.name }]);
								return;
							}
						} catch (e) {}
						setCityDetectMsg(`Ciudad detectada: ${cityName}.`);
					} else {
						// Sin country_code: intentar por slug solamente
						const slug = slugify(cityName);
						try {
							const { data: existingSlug, error: selErr2 } = await supabase
								.from('cities')
								.select('id,name')
								.eq('slug', slug)
								.maybeSingle();
											if (!selErr2 && existingSlug?.id) {
												store.set({ cityId: existingSlug.id, lat, lng: lon });
								setCityDetectMsg(`Ciudad detectada: ${existingSlug.name}`);
								setCities(prev => [...prev, { id: existingSlug.id, name: existingSlug.name }]);
								return;
							}
						} catch (e) {}
						setCityDetectMsg(`Ciudad detectada: ${cityName}.`);
					}
				} else {
					setCityDetectMsg('No se pudo detectar una ciudad a partir de la dirección.');
				}
			} catch (e) {
				if (alive) setCityDetectMsg('No se pudo detectar la ciudad (sin conexión o límite alcanzado).');
					} finally {
						// end of detect op
					}
		}, 600);
		return () => { alive = false; clearTimeout(handle); };
	}, [store.locationText, store.placeId, cities.length]);

	// Android back button: on step 1 with no history, treat as Cancel (replace to home)
	useFocusEffect(
		useCallback(() => {
			if (Platform.OS !== 'android') return undefined;
			const onBackPress = () => {
				// Step 1: only forward navigation allowed; block hardware back
				return true; // consume and do nothing
			};
			const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
			return () => sub.remove();
		}, [])
	);

	// Autocomplete suggestions using Google Places when key present (fallback: none). Hide if placeId selected.
	useEffect(()=>{
		if(!placesKey || store.placeId) { setSearchResults([]); return; }
		if(debounceRef.current){ clearTimeout(debounceRef.current); debounceRef.current = null; }
		const q = store.locationText?.trim() || '';
		if(!q){ setSearchResults([]); setSearching(false); return; }
		debounceRef.current = setTimeout(async()=>{
			try{
				setSearching(true);
				const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&language=es&sessiontoken=${encodeURIComponent(sessionTokenRef.current)}&key=${encodeURIComponent(placesKey)}`;
				const res = await fetch(url); const json = await res.json();
				const preds = Array.isArray(json?.predictions)? json.predictions:[];
				setSearchResults(preds.slice(0,8).map((p:any)=> ({ label: p.description, placeId: p.place_id })));
			} catch (e) { setSearchResults([]); }
			finally{ setSearching(false); }
		}, 250);
		return ()=>{ if(debounceRef.current){ clearTimeout(debounceRef.current); debounceRef.current = null; } };
	},[store.locationText, store.placeId, placesKey]);

	const selectSuggestion = async (entry: { label:string; placeId?:string; lat?:number; lng?:number }) => {
		// Update address label immediately
		store.set({ locationText: entry.label, placeId: entry.placeId ?? null });
		setSearchResults([]);
		// Fetch details to detect city and map cityId
		let lat: number | null = entry.lat ?? null;
		let lon: number | null = entry.lng ?? null;
		let cityName: string | null = null;
		let cc: string | null = null;
			try{
			if(entry.placeId && placesKey){
				const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(entry.placeId)}&fields=address_component,geometry&language=es&sessiontoken=${encodeURIComponent(sessionTokenRef.current)}&key=${encodeURIComponent(placesKey)}`;
				const detRes = await fetch(detUrl); const det = await detRes.json();
				const comps: any[] = det?.result?.address_components || [];
				const byType = (t:string)=> comps.find(c=> Array.isArray(c.types) && c.types.includes(t));
				cityName = (byType('locality')?.long_name || byType('postal_town')?.long_name || byType('administrative_area_level_2')?.long_name || byType('administrative_area_level_1')?.long_name || null);
				const countryComp = byType('country');
				cc = countryComp?.short_name ? String(countryComp.short_name).toUpperCase() : null;
				const loc = det?.result?.geometry?.location;
				if(loc && typeof loc.lat==='number' && typeof loc.lng==='number'){ lat = loc.lat; lon = loc.lng; }
			}
			} catch (e) {}
			if(cityName){
				// Try map/upsert as in effect
				const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
				const target = norm(cityName);
				const localFound = cities.find(c => norm(c.name) === target);
						if(localFound) {
							store.set({ cityId: localFound.id, lat, lng: lon });
					setCityDetectMsg(`Ciudad detectada: ${localFound.name}`);
					return;
				}
			const slug = cityName ? slugify(cityName) : '';
			if (cc && cityName) {
				try {
					const { data: existing, error: selErr } = await supabase
						.from('cities')
						.select('id,name')
						.eq('slug', slug)
						.eq('country_code', cc)
						.maybeSingle();
								if (!selErr && (existing as any)?.id) {
						const id = (existing as any).id as number;
									store.set({ cityId: id, lat, lng: lon });
						setCityDetectMsg(`Ciudad detectada: ${(existing as any).name}`);
						setCities(prev => [...prev, { id, name: (existing as any).name }]);
						return;
					}
				} catch (e) {}
			} else if (cityName) {
				try {
					const { data: existingSlug, error: selErr3 } = await supabase
						.from('cities')
						.select('id,name')
						.eq('slug', slug)
						.maybeSingle();
								if (!selErr3 && (existingSlug as any)?.id) {
						const id = (existingSlug as any).id as number;
									store.set({ cityId: id, lat, lng: lon });
						setCityDetectMsg(`Ciudad detectada: ${(existingSlug as any).name}`);
						setCities(prev => [...prev, { id, name: (existingSlug as any).name }]);
						return;
					}
				} catch (e) {}
			}
			setCityDetectMsg(`Ciudad detectada: ${cityName}.`);
		}
	};

	  return (
		    <OwnerBackground>
		    	<Screen style={{ padding: 0, gap: 0 }} edges={['bottom']}>
					<ProgressHeader step={1} total={4} style={{ position: 'absolute' }} />
		    	<CenterScaffold transparentBg variant="minimal" paddedTop={insets.top + 52}>
						<KeyboardAvoidingView
							behavior={'padding'}
							keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
							style={{ flex: 1 }}
						>
						  <View style={{ flex: 1 }}>
							<ScrollView
								contentContainerStyle={styles.center}
								keyboardShouldPersistTaps="always"
								keyboardDismissMode="none"
							>
					<H1 style={styles.title}>Información básica</H1>

					<P style={styles.label}>Nombre del local (obligatorio)</P>
					<TextInput value={store.name} onChangeText={(t) => store.set({ name: t })} placeholder="Mi Local" />

							<P style={styles.label}>Dirección (obligatorio)</P>
							<TextInput value={store.locationText ?? ''} onChangeText={(t) => store.set({ locationText: t || null, placeId: null })} placeholder="Calle y número" />
							{!!placesKey && !store.placeId && !!searchResults.length && (
								<View style={{ marginTop: 4, borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow:'hidden' }}>
									{searchResults.map((r, idx) => (
										<Pressable key={`s-${idx}`} onPress={() => selectSuggestion(r)} style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(15,23,42,0.8)' }}>
											<Text style={{ color: '#E2E8F0' }}>{r.label}</Text>
										</Pressable>
									))}
									<View style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(15,23,42,0.9)', borderTopWidth: 1, borderTopColor: '#334155' }}>
										<Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'right' }}>Powered by Google</Text>
									</View>
								</View>
							)}
							{cityDetectMsg ? (
								<P style={{ color: '#6B7280' }}>{cityDetectMsg}</P>
							) : null}
							<P style={{ color: '#6B7280', fontSize: 12 }}>
								Usando Google Places si está disponible; si no, geocodificador del dispositivo.
							</P>

								<View style={{ height: 200 }} />
							</ScrollView>
						  </View>
						  <StickyFooterActions
								actions={[
											{ title: 'Continuar', onPress: () => router.push('/(owner-onboarding)/details' as any), disabled: !canNext }
								]}
							/>
					</KeyboardAvoidingView>
						</CenterScaffold>
				</Screen>
			</OwnerBackground>
	);
}

const styles = StyleSheet.create({
				center: { flexGrow: 1, alignItems: 'stretch', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 20 },
		title: { textAlign: 'left', marginBottom: 6 },
		label: { marginTop: 10 },
});

