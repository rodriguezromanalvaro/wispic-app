import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Screen, H1, P, TextInput, SelectionTile, StickyFooterActions, UploadOverlayModal } from '../../components/ui';
import { OwnerBackground } from '../../components/OwnerBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../components/Scaffold';
import { ProgressHeader } from '../../features/owner/onboarding/ProgressHeader';
import { useOwnerOnboarding } from '../../features/owner/onboarding/state';
import { router } from 'expo-router';
import { upsertOwnerOnboarding } from '../../lib/supabase-owner';
import { uploadSinglePhoto } from '../../lib/storage';
import { supabase } from '../../lib/supabase';

export default function OwnerGoals() {
	const store = useOwnerOnboarding();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const someGoal = useMemo(() => store.goals.promote || store.goals.attract || (store.goals.other.trim().length > 0), [store.goals]);
	const insets = useSafeAreaInsets();

	const SUGGESTIONS = ['Llenar días flojos', 'Fidelizar clientes', 'Mejorar presencia online', 'Aumentar ventas de barra'];
	const otherList = useMemo(() => store.goals.other.split(',').map(s => s.trim()).filter(Boolean), [store.goals.other]);
	const hasSuggestion = (s: string) => otherList.includes(s);
	const toggleSuggestion = (s: string) => {
		let next: string[];
		if (hasSuggestion(s)) {
			next = otherList.filter(x => x !== s);
		} else {
			next = [...otherList, s];
		}
		store.set({ goals: { ...store.goals, other: next.join(', ') } });
	};

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
					case 'Bar': return 'bar';
					case 'Discoteca': return 'discoteca';
					case 'Sala de conciertos': return 'sala_conciertos';
					case 'Sala de eventos': return 'sala_eventos';
					case 'Pub': return 'pub';
					default: return 'otro';
				}
			};

					// If there's a local avatar uri, upload to storage to get a public URL
					let uploadedAvatarUrl: string | null = null;
					if (store.avatarUri && !/^https?:\/\//i.test(store.avatarUri)) {
						uploadedAvatarUrl = await uploadSinglePhoto({
							userId,
							uri: store.avatarUri,
							pathPrefix: `venues/${userId}`,
							resize: { maxWidth: 1024, maxHeight: 1024, quality: 0.85 },
						});
					} else if (store.avatarUri) {
						uploadedAvatarUrl = store.avatarUri;
					}

					const payload = {
				userId,
				name: store.name.trim(),
				email: store.email?.trim() || null,
				phone: store.phone?.trim() || null,
				category: mapCategory(store.category) as any,
				cityId: store.cityId ?? null,
				locationText: store.locationText?.trim() || null,
				description: store.description?.trim() || null,
						avatarUrl: uploadedAvatarUrl,
				promote: !!store.goals.promote,
				attract: !!store.goals.attract,
				other: (store.goals.other?.trim() || null),
			};

					const { venueId } = await upsertOwnerOnboarding(payload as any);
			store.set({ /* @ts-ignore */ venueId });
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
									<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0} style={{ flex: 1 }}>
									<View style={{ flex: 1 }}>
											<ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
					<H1 style={styles.title}>Por último… ¿Qué te gustaría conseguir en Wispic?</H1>
					<P style={{ color: '#94A3B8' }}>Marca todo lo que te resuene. Puedes elegir varias opciones.</P>

					<View style={{ gap: 8 }}>
						<SelectionTile label="Dar visibilidad a mis eventos" active={store.goals.promote} onPress={() => toggle('promote')} indicator="check" />
						<SelectionTile label="Atraer clientes nuevos" active={store.goals.attract} onPress={() => toggle('attract')} indicator="check" />
					</View>

					<P style={[styles.label, { marginTop: 14 }]}>O elige entre estas ideas</P>
					<View style={styles.suggestionsWrap}>
						{SUGGESTIONS.map(s => (
							<TouchableOpacity key={s} style={[styles.chip, hasSuggestion(s) && styles.chipActive]} onPress={() => toggleSuggestion(s)} activeOpacity={0.9}>
								<P style={[styles.chipText, hasSuggestion(s) && styles.chipTextActive]}>{s}</P>
							</TouchableOpacity>
						))}
					</View>

					<P style={styles.label}>Cuéntanos en tus palabras (opcional)</P>
					<TextInput value={store.goals.other} onChangeText={(t) => store.set({ goals: { ...store.goals, other: t } })} placeholder="Escribe un objetivo breve (ej. Llenar jueves, fidelizar clientes)" multiline />

								<View style={{ height: 12 }} />
								<View style={{ height: 80 }} />
											</ScrollView>
										</View>
												<StickyFooterActions
										note={error ? <P style={{ color: '#ef4444' }}>{error}</P> : null}
										actions={[
											{ title: loading ? 'Guardando…' : '¡Empezar!', onPress: finish, disabled: !someGoal || loading, gradientColors: ['#60A5FA','#2563EB'] },
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

