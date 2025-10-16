import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Screen, H1, P, TextInput, Button, StickyFooterActions } from '../../components/ui';
import { OwnerBackground } from '../../components/OwnerBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../components/Scaffold';
import { ProgressHeader } from '../../features/owner/onboarding/ProgressHeader';
import { useOwnerOnboarding } from '../../features/owner/onboarding/state';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';

export default function OwnerBasic() {
	const store = useOwnerOnboarding();
	const [sameEmailUsed, setSameEmailUsed] = useState(false);
	const insets = useSafeAreaInsets();
  const { user } = useAuth();
	const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
	const [cityDetecting, setCityDetecting] = useState(false);
	const [cityDetectMsg, setCityDetectMsg] = useState<string | null>(null);

	// Small diacritics-safe slugify (ASCII-only, hyphenated)
	const slugify = (s: string) =>
		s
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

	const canNext = useMemo(() => store.name.trim().length > 0 && (store.locationText?.trim().length ?? 0) > 0, [store.name, store.locationText]);

	const useSameEmail = () => {
		if (!sameEmailUsed) {
			const emailFromAuth = user?.email ?? null;
			if (emailFromAuth) {
				store.set({ email: emailFromAuth });
				setSameEmailUsed(true);
			}
		}
	};

	// Load cities list once to map detected city name to our cityId
	useEffect(() => {
		let alive = true;
		(async () => {
			const { data, error } = await supabase.from('cities').select('id,name');
			if (!error && alive) setCities((data as any) ?? []);
		})();
		return () => { alive = false; };
	}, []);

	// Debounced geocoding of address to detect city via Nominatim (free)
	useEffect(() => {
		const q = store.locationText?.trim() || '';
		if (q.length < 5) { setCityDetectMsg(null); return; }
		setCityDetecting(true);
		setCityDetectMsg('Detectando ciudad…');
		let alive = true;
		const handle = setTimeout(async () => {
			try {
				const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`;
				const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'WispicApp/1.0 (support@wispic.app)' } as any });
				const json: any[] = await res.json();
				const first = json?.[0];
				const addr = first?.address;
				let cityName: string | null = null;
				if (addr) {
					cityName = addr.city || addr.town || addr.village || addr.municipality || addr.state || null;
				}
				const cc = (addr?.country_code ? String(addr.country_code).toUpperCase() : null) as string | null;
				const lat = first?.lat ? Number(first.lat) : null;
				const lon = first?.lon ? Number(first.lon) : null;
				if (!alive) return;
				if (cityName) {
					// First, quick local exact (normalized) match by name
					const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
					const target = norm(cityName);
					const localFound = cities.find(c => norm(c.name) === target);
					if (localFound) {
						store.set({ cityId: localFound.id });
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
								store.set({ cityId: existing.id });
								setCityDetectMsg(`Ciudad detectada: ${existing.name}`);
								// Cache locally for next time
								setCities(prev => [...prev, { id: existing.id, name: existing.name }]);
								return;
							}
						} catch {}

						// Not found: create with upsert
						try {
							const payload: any = { name: cityName, slug, country_code: cc };
							if (typeof lat === 'number' && !Number.isNaN(lat)) payload.lat = lat;
							if (typeof lon === 'number' && !Number.isNaN(lon)) payload.lon = lon;
							const { data: created, error: upErr } = await supabase
								.from('cities')
								.upsert(payload, { onConflict: 'slug,country_code' })
								.select('id,name')
								.single();
							if (!upErr && created?.id) {
								setCities(prev => [...prev, { id: created.id, name: created.name }]);
								store.set({ cityId: created.id });
								setCityDetectMsg(`Ciudad añadida automáticamente: ${created.name}`);
								return;
							}
							setCityDetectMsg(`Ciudad detectada: ${cityName}. (No pudimos registrarla ahora)`);
						} catch {
							setCityDetectMsg(`Ciudad detectada: ${cityName}. (No pudimos registrarla ahora)`);
						}
					} else {
						// No country code available; avoid creating to prevent duplicados ambiguos
						setCityDetectMsg(`Ciudad detectada: ${cityName}.`);
					}
				} else {
					setCityDetectMsg('No se pudo detectar una ciudad a partir de la dirección.');
				}
			} catch {
				if (alive) setCityDetectMsg('No se pudo detectar la ciudad (sin conexión o límite alcanzado).');
			} finally {
				if (alive) setCityDetecting(false);
			}
		}, 600);
		return () => { alive = false; clearTimeout(handle); };
	}, [store.locationText, cities.length]);

	  return (
		    <OwnerBackground>
		    	<Screen style={{ padding: 0, gap: 0 }} edges={['bottom']}>
					<ProgressHeader step={1} total={4} style={{ position: 'absolute' }} />
		    	<CenterScaffold transparentBg variant="minimal" paddedTop={insets.top + 52}>
						<KeyboardAvoidingView
							behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
							<TextInput value={store.locationText ?? ''} onChangeText={(t) => store.set({ locationText: t || null })} placeholder="Calle y número" />
							{cityDetectMsg ? (
								<P style={{ color: '#6B7280' }}>{cityDetectMsg}</P>
							) : null}
							<P style={{ color: '#6B7280', fontSize: 12 }}>
								Usando geocodificación gratuita (Nominatim). Recomendado cambiar a Google Places en producción.
							</P>

					<P style={styles.label}>Email (opcional)</P>
					<TextInput value={store.email ?? ''} onChangeText={(t) => store.set({ email: t || null })} placeholder="correo@dominio.com" autoCapitalize="none" keyboardType="email-address" />
					<Button title={sameEmailUsed && store.email ? `Usando: ${store.email}` : 'Usar el mismo que el del registro'} onPress={useSameEmail} variant="outline" style={{ alignSelf: 'flex-start' }} gradient={false} disabled={!user?.email} />

						<P style={styles.label}>Teléfono (opcional)</P>
					<TextInput value={store.phone ?? ''} onChangeText={(t) => store.set({ phone: t || null })} placeholder="+34 600 000 000" keyboardType="phone-pad" />

								<View style={{ height: 200 }} />
							</ScrollView>
						  </View>
						  <StickyFooterActions
								actions={[
									{ title: 'Continuar', onPress: () => router.push('/(owner-onboarding)/details' as any), disabled: !canNext, gradientColors: ['#60A5FA','#2563EB'] },
									{ title: 'Atrás', onPress: () => router.back(), variant: 'outline' }
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

