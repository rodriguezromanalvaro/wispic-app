import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Screen, H1, P, Button, StickyFooterActions } from '../../components/ui';
import { OwnerBackground } from '../../components/OwnerBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../components/Scaffold';
import * as ImagePicker from 'expo-image-picker';
import { ProgressHeader } from '../../features/owner/onboarding/ProgressHeader';
import { useOwnerOnboarding } from '../../features/owner/onboarding/state';
import { router } from 'expo-router';

export default function OwnerMedia() {
	const store = useOwnerOnboarding();
	const canNext = useMemo(() => !!store.avatarUri, [store.avatarUri]);
	const insets = useSafeAreaInsets();
  const [pickError, setPickError] = useState<string | null>(null);

	const pickImage = async () => {
		try {
			setPickError(null);
			const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (perm.status !== 'granted') {
				setPickError('Necesitamos permiso para acceder a tus fotos.');
				return;
			}
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.85,
				exif: false,
			});
			if (result.canceled) return;
			const asset = result.assets && result.assets[0];
			if (asset?.uri) {
				store.set({ avatarUri: asset.uri });
			}
		} catch (e) {
			setPickError('No se pudo seleccionar la imagen.');
		}
	};

		return (
				<OwnerBackground>
							<Screen style={{ padding: 0, gap: 0 }} edges={['bottom']}>
											<ProgressHeader step={3} total={4} style={{ position: 'absolute' }} />
											<CenterScaffold transparentBg variant="minimal" paddedTop={insets.top + 52}>
									<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0} style={{ flex: 1 }}>
									<View style={{ flex: 1 }}>
											<ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
					<H1 style={styles.title}>Sube el avatar del local</H1>
					<P>Esta imagen representará tu local y será visible para los usuarios.</P>
            {pickError ? <P style={{ color: '#ef4444' }}>{pickError}</P> : null}

						<View style={styles.avatarBox}>
							{store.avatarUri ? (
								<>
									<Image source={{ uri: store.avatarUri }} style={{ width: 160, height: 160, borderRadius: 12 }} />
									<View style={{ height: 10 }} />
									<Button title="Cambiar imagen" onPress={pickImage} variant="outline" gradient={false} />
								</>
							) : (
								<TouchableOpacity onPress={pickImage} style={styles.avatarPlaceholder}>
									<P bold>Seleccionar imagen</P>
								</TouchableOpacity>
							)}
						</View>

								<View style={{ height: 80 }} />
											</ScrollView>
										</View>
											<StickyFooterActions
								actions={[
									{ title: 'Continuar', onPress: () => router.push('/(owner-onboarding)/goals' as any), disabled: !canNext, gradientColors: ['#60A5FA','#2563EB'] },
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
	avatarBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
	avatarPlaceholder: { width: 160, height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#64748b', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
});

