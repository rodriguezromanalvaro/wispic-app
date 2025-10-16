import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen, H1, P, TextInput, SelectionTile, StickyFooterActions } from '../../components/ui';
import { OwnerBackground } from '../../components/OwnerBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../components/Scaffold';
import { ProgressHeader } from '../../features/owner/onboarding/ProgressHeader';
import { useOwnerOnboarding } from '../../features/owner/onboarding/state';
import { router } from 'expo-router';
// City and address are now collected in Basic step; no Supabase fetch needed here

const CATEGORIES = ['Bar', 'Discoteca', 'Sala de conciertos', 'Sala de eventos', 'Pub'];

export default function OwnerDetails() {
	const store = useOwnerOnboarding();
	const insets = useSafeAreaInsets();

	const canNext = useMemo(() => !!store.category && (store.description?.trim().length ?? 0) > 0, [store.category, store.description]);

		return (
				<OwnerBackground>
							<Screen style={{ padding: 0, gap: 0 }} edges={['bottom']}>
							<ProgressHeader step={2} total={4} style={{ position: 'absolute' }} />
							<CenterScaffold transparentBg variant="minimal" paddedTop={insets.top + 52}>
					<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0} style={{ flex: 1 }}>
					<View style={{ flex: 1 }}>
											<ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
					<H1 style={styles.title}>Detalles del local</H1>

					<P style={styles.label}>Categoría</P>
					<View style={{ gap: 8 }}>
						{CATEGORIES.map(cat => (
							<SelectionTile key={cat} label={cat} active={store.category === cat} onPress={() => store.set({ category: cat })} indicator="radio" />
						))}
					</View>


					<P style={styles.label}>Descripción (breve)</P>
					<TextInput value={store.description ?? ''} onChangeText={(t) => store.set({ description: t || null })} placeholder="Cuéntales a los usuarios de qué va tu local" multiline />

											<View style={{ height: 80 }} />
														</ScrollView>
													</View>
														<StickyFooterActions
											actions={[
												{ title: 'Continuar', onPress: () => router.push('/(owner-onboarding)/media' as any), disabled: !canNext, gradientColors: ['#60A5FA','#2563EB'] },
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

