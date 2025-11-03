import { useMemo, useState } from 'react';

import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

import Constants from 'expo-constants';
import { router } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CenterScaffold } from 'components/Scaffold';
import { Screen, H1, P, TextInput, SelectionTile, StickyFooterActions, UploadOverlayModal } from 'components/ui';
import { upsertOwnerOnboarding } from 'features/owner/api/supabase';
import { ProgressHeader } from 'features/owner/onboarding/ProgressHeader';
import { useOwnerOnboarding } from 'features/owner/onboarding/state';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import { uploadSinglePhoto } from 'lib/storage';
import { supabase } from 'lib/supabase';

export default function OwnerGoals() {
	const store = useOwnerOnboarding();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const someGoal = useMemo(() => store.goals.promote || store.goals.attract || (store.goals.other.trim().length > 0), [store.goals]);
	const insets = useSafeAreaInsets();
	const SALES_LABEL = 'Aumentar ventas';
	const otherList = useMemo(() => store.goals.other.split(',').map(s => s.trim()).filter(Boolean), [store.goals.other]);
	const hasSuggestion = (s: string) => otherList.includes(s);
	const toggleSuggestion = (s: string) => {
		const list = otherList;
		const next = hasSuggestion(s) ? list.filter(x => x !== s) : [...list, s];
		store.set({ goals: { ...store.goals, other: next.join(', ') } });
	};
	const [otherOpen, setOtherOpen] = useState<boolean>(false);

	const toggle = (key: 'promote' | 'attract') => {
		store.set({ goals: { ...store.goals, [key]: !store.goals[key] } });
	};

	const finish = async () => {
			if (loading) return;
			setError(null);
			setLoading(true);
		try {
			const { data: { session } } = await supabase.auth.getSession();
			const userId = session?.user?.id;
			if (!userId) throw new Error('No hay sesión activa. Inicia sesión de nuevo.');

			const mapCategory = (c: string | null) => {
				switch (c) {
					case 'Bar/Discoteca': return 'bar'; // si prefieres 'discoteca', lo cambiamos fácil
					case 'Sala de conciertos': return 'sala_conciertos';
					case 'Sala de concierto': return 'sala_conciertos'; // tolerar singular
					default: return 'bar';
				}
			};

					// If there's a local avatar uri, upload to storage to get a public URL
					let uploadedAvatarUrl: string | null = null;
					if (store.avatarUri && !/^https?:\/\//i.test(store.avatarUri)) {
						uploadedAvatarUrl = await uploadSinglePhoto({
							userId,
							uri: store.avatarUri,
							resize: { maxWidth: 1024, maxHeight: 1024, quality: 0.85 },
						});
					} else if (store.avatarUri) {
						uploadedAvatarUrl = store.avatarUri;
					}

					const increaseSales = hasSuggestion(SALES_LABEL);

					// Asegurar cityId si faltara (BD lo exige NOT NULL)
					let cityId = store.cityId;
					if (!cityId) {
						const placesKey = (Constants?.expoConfig as any)?.extra?.placesApiKey || (Constants as any)?.manifest?.extra?.placesApiKey;
						let cityName: string | null = null;
						let cc: string | null = null;
						let lat: number | null = null;
						let lon: number | null = null;
						const slugify = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
						try {
							if (placesKey) {
								if (store.placeId) {
									const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(store.placeId)}&fields=address_component,geometry&language=es&key=${encodeURIComponent(placesKey)}`;
									const detRes = await fetch(detUrl);
									const det = await detRes.json();
									const comps: any[] = det?.result?.address_components || [];
									const byType = (t: string) => comps.find(c => Array.isArray(c.types) && c.types.includes(t));
									cityName = (byType('locality')?.long_name || byType('postal_town')?.long_name || byType('administrative_area_level_2')?.long_name || byType('administrative_area_level_1')?.long_name || null);
									const countryComp = byType('country');
									cc = countryComp?.short_name ? String(countryComp.short_name).toUpperCase() : null;
									const countryLong: string | null = countryComp?.long_name ? String(countryComp.long_name) : null;
									const loc = det?.result?.geometry?.location;
									if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') { lat = loc.lat; lon = loc.lng; }
								} else if (store.locationText && store.locationText.trim().length > 4) {
									const fpUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(store.locationText)}&inputtype=textquery&fields=place_id,geometry&language=es&key=${encodeURIComponent(placesKey)}`;
									const fpRes = await fetch(fpUrl);
									const fp = await fpRes.json();
									const cand = Array.isArray(fp?.candidates) && fp.candidates.length ? fp.candidates[0] : null;
									const placeId = cand?.place_id as string | undefined;
									if (cand?.geometry?.location) {
										lat = typeof cand.geometry.location.lat === 'number' ? cand.geometry.location.lat : null;
										lon = typeof cand.geometry.location.lng === 'number' ? cand.geometry.location.lng : null;
									}
									if (placeId) {
										const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_component,geometry&language=es&key=${encodeURIComponent(placesKey)}`;
										const detRes = await fetch(detUrl);
										const det = await detRes.json();
										const comps: any[] = det?.result?.address_components || [];
										const byType = (t: string) => comps.find(c => Array.isArray(c.types) && c.types.includes(t));
										cityName = (byType('locality')?.long_name || byType('postal_town')?.long_name || byType('administrative_area_level_2')?.long_name || byType('administrative_area_level_1')?.long_name || null);
										const countryComp = byType('country');
										cc = countryComp?.short_name ? String(countryComp.short_name).toUpperCase() : null;
										const countryLong: string | null = countryComp?.long_name ? String(countryComp.long_name) : null;
										if (!lat || !lon) {
											const loc = det?.result?.geometry?.location;
											if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') { lat = loc.lat; lon = loc.lng; }
										}
									}
								}
							}
							if (cityName) {
								// Prefer server-side SECURITY DEFINER RPC to bypass RLS when inserting cities
								if (cc) {
									try {
										// Try to include country long name if we have it from the last details fetch
										const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_city_from_place', {
											p_name: cityName,
											p_country_code: cc,
											p_lat: typeof lat === 'number' && !Number.isNaN(lat) ? lat : null,
											p_lng: typeof lon === 'number' && !Number.isNaN(lon) ? lon : null,
											p_google_place_id: store.placeId ?? null,
											p_country: null, // best-effort; function will coalesce to cc if null
										});
										if (!rpcError && rpcData) cityId = Number(rpcData);
										else if (rpcError) {
											console.warn('upsert_city_from_place RPC failed:', rpcError.message);
										}
									} catch (e) { console.warn('RPC call threw', e); }
								}
								if (!cityId) {
									// Fallback: try select by slug (no create here to avoid RLS issues without cc)
									const slug = slugify(cityName);
									try {
										const resp = await supabase
											.from('cities')
											.select('id')
											.eq('slug', slug)
											.maybeSingle();
										const ex = (resp as any)?.data;
										if (ex?.id) cityId = Number(ex.id);
									} catch (e) {}
								}
								// As last resort, pick nearest city by coords within same country when available
								if (!cityId && typeof lat === 'number' && typeof lon === 'number' && cc) {
									try {
										const { data: candidates } = await supabase
											.from('cities')
											.select('id,name,lat,lng,country_code')
											.eq('country_code', cc)
											.not('lat','is', null)
											.not('lng','is', null)
											.limit(500);
										if (Array.isArray(candidates) && candidates.length) {
											let best = candidates[0];
											let bestD = Number.POSITIVE_INFINITY;
											for (const c of candidates as any[]) {
												const d = (c.lat - lat) * (c.lat - lat) + (c.lng - lon) * (c.lng - lon);
												if (d < bestD) { bestD = d; best = c; }
											}
											if (best?.id) cityId = Number(best.id);
										}
									} catch (e) {}
								}
							}
							else if (store.locationText && store.locationText.trim().length > 4) {
								// Fallback a geocodificador del dispositivo (expo-location)
								try {
									const ExpoLocation = await import('expo-location');
									const results = await (ExpoLocation as any).geocodeAsync(store.locationText);
									const g: any = results?.[0] || {};
									lat = typeof g.latitude === 'number' ? g.latitude : null;
									lon = typeof g.longitude === 'number' ? g.longitude : null;
									const gCity = (g.city || g.subregion || g.region || null)?.toString() || null;
									const gCc = (g.isoCountryCode || g.countryCode || null)?.toString().toUpperCase() || null;
									const gCountryName = (g.country || null)?.toString() || null;
									if (gCity) {
										if (gCc) {
											try {
												const { data: rpcData2, error: rpcError2 } = await supabase.rpc('upsert_city_from_place', {
													p_name: gCity,
													p_country_code: gCc,
													p_lat: typeof lat === 'number' && !Number.isNaN(lat) ? lat : null,
													p_lng: typeof lon === 'number' && !Number.isNaN(lon) ? lon : null,
													p_google_place_id: store.placeId ?? null,
													p_country: gCountryName,
												});
												if (!rpcError2 && rpcData2) cityId = Number(rpcData2);
												else if (rpcError2) {
													console.warn('upsert_city_from_place RPC failed (geocoder path):', rpcError2.message);
												}
											} catch (e) { console.warn('RPC call threw (geocoder path)', e); }
										}
										if (!cityId) {
											// Fallback select by slug
											const slug = slugify(gCity);
											try {
												const resp2 = await supabase
													.from('cities')
													.select('id')
													.eq('slug', slug)
													.maybeSingle();
												const ex2 = (resp2 as any)?.data;
												if (ex2?.id) cityId = Number(ex2.id);
											} catch (e) {}
											// Nearest fallback
											if (!cityId && typeof lat === 'number' && typeof lon === 'number' && gCc) {
												try {
													const { data: candidates2 } = await supabase
														.from('cities')
														.select('id,name,lat,lng,country_code')
														.eq('country_code', gCc)
														.not('lat','is', null)
														.not('lng','is', null)
														.limit(500);
													if (Array.isArray(candidates2) && candidates2.length) {
														let best = candidates2[0];
														let bestD = Number.POSITIVE_INFINITY;
														for (const c of candidates2 as any[]) {
															const d = (c.lat - lat) * (c.lat - lat) + (c.lng - lon) * (c.lng - lon);
															if (d < bestD) { bestD = d; best = c; }
														}
														if (best?.id) cityId = Number(best.id);
													}
												} catch (e) {}
											}
										}
									}
								} catch (e) {}
							}
						} catch (e) {
							// noop: validaremos abajo
						}
					}

					if (!cityId) {
						throw new Error('No se pudo detectar la ciudad. Elige una sugerencia de Google al escribir la dirección.');
					}

                    const payload = {
				userId,
				name: store.name.trim(),
				category: mapCategory(store.category) as any,
				cityId: cityId,
				locationText: store.locationText?.trim() || null,
				lat: typeof store.lat === 'number' ? store.lat : null,
				lng: typeof store.lng === 'number' ? store.lng : null,
				description: store.description?.trim() || null,
						avatarUrl: uploadedAvatarUrl,
					placeId: store.placeId ?? null,
				promote: !!store.goals.promote,
				attract: !!store.goals.attract,
					other: (store.goals.other?.trim() || null),
					increaseSales,
			};

		    await upsertOwnerOnboarding(payload as any);
	    // venue id is managed internally or retrieved later; no-op here
			router.replace('/(owner)/home' as any);
		} catch (e: any) {
			setError(e?.message || 'No se pudo completar el registro.');
		} finally {
			setLoading(false);
		}
	};

		return (
				<OwnerBackground>
							<Screen style={{ padding: 0, gap: 0 }} edges={['bottom']}>
											<ProgressHeader step={4} total={4} style={{ position: 'absolute' }} />
											<CenterScaffold transparentBg variant="minimal" paddedTop={insets.top + 52}>
									<KeyboardAvoidingView behavior={'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0} style={{ flex: 1 }}>
									<View style={{ flex: 1 }}>
											<ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
					<H1 style={styles.title}>Por último… ¿Qué te gustaría conseguir en Wispic?</H1>
					<P style={{ color: '#94A3B8' }}>Marca todo lo que te resuene. Puedes elegir varias opciones.</P>

					<View style={{ gap: 8 }}>
						<SelectionTile label="Dar visibilidad a mis eventos" active={store.goals.promote} onPress={() => toggle('promote')} indicator="check" />
						<SelectionTile label="Atraer nuevos clientes" active={store.goals.attract} onPress={() => toggle('attract')} indicator="check" />
						<SelectionTile label={SALES_LABEL} active={hasSuggestion(SALES_LABEL)} onPress={() => toggleSuggestion(SALES_LABEL)} indicator="check" />
						<SelectionTile label="Otro" active={otherOpen} onPress={() => setOtherOpen(v => !v)} indicator="check" />
					</View>

					{otherOpen && (
						<>
							<P style={styles.label}>Cuéntanos en tus palabras</P>
							<TextInput
								value={store.goals.other}
								onChangeText={(t) => store.set({ goals: { ...store.goals, other: t } })}
								placeholder="Escribe un objetivo breve"
								multiline
							/>
						</>
					)}

								<View style={{ height: 12 }} />
								<View style={{ height: 80 }} />
											</ScrollView>
										</View>
												<StickyFooterActions
										note={error ? <P style={{ color: '#ef4444' }}>{error}</P> : null}
										actions={[
													{ title: loading ? 'Guardando…' : '¡Empezar!', onPress: finish, disabled: !someGoal || loading },
																 { title: 'Atrás', onPress: () => router.back(), variant: 'outline' }
										]}
									/>
										</KeyboardAvoidingView>
						</CenterScaffold>
						<UploadOverlayModal visible={loading} title={'Subiendo fotos…'} />
				</Screen>
			</OwnerBackground>
	);
}

const styles = StyleSheet.create({
				center: { flexGrow: 1, alignItems: 'stretch', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 20 },
		title: { textAlign: 'left', marginBottom: 6 },
		label: { marginTop: 10 },
		suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
		chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#334155', backgroundColor: 'transparent' },
		chipActive: { backgroundColor: 'rgba(37,99,235,0.12)', borderColor: '#2563EB' },
		chipText: { color: '#94A3B8' },
		chipTextActive: { color: '#2563EB', fontWeight: '700' },
});

