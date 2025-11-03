import { useEffect, useRef, useState } from 'react';

import { View, Text, Animated, StyleSheet } from 'react-native';

import { router } from 'expo-router';

import { Button } from 'components/ui';
import { useOwnerOnboarding } from 'features/owner/onboarding/state';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import { theme } from 'lib/theme';

const BLUE = '#3B82F6'; // blue-500
const BLUE_LIGHT = '#BFDBFE'; // blue-200

const slides = [
	{
		title: 'Atrae nuevos clientes',
		body: 'Publica tus eventos o planes y deja que los usuarios te descubran.',
	},
	{
		title: 'Fácil y rápido',
		body: 'Configura tu local en menos de 5 minutos y empieza a disfrutar de los beneficios de Wispic.',
	},
	{
		title: 'Crece con datos reales',
		body: 'Entiende el impacto de tus eventos y toma mejores decisiones.',
	},
];

export default function OwnerOnboardingWelcome() {
	// Select only what we need from the store to prevent effect loops on state changes
	const reset = useOwnerOnboarding((s) => s.reset);
	const [index, setIndex] = useState(0);
	const opacity = useRef(new Animated.Value(1)).current;
	const translateY = useRef(new Animated.Value(0)).current;

	// Skip this screen if coming from owner sign-up welcome; go straight to basic
	useEffect(() => {
		// Siempre arrancamos el onboarding con estado limpio (solo una vez por montaje)
		reset();
		const id = setTimeout(() => {
			router.replace('/(owner-onboarding)/basic' as any);
		}, 200);
		return () => clearTimeout(id);
	}, []);

	useEffect(() => {
		const id = setInterval(() => {
			Animated.parallel([
				Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
				Animated.timing(translateY, { toValue: -8, duration: 220, useNativeDriver: true }),
			]).start(() => {
				setIndex((i) => (i + 1) % slides.length);
				translateY.setValue(8);
				Animated.parallel([
					Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
					Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
				]).start();
			});
		}, 3000);
		return () => clearInterval(id);
	}, [opacity, translateY]);

		return (
			<OwnerBackground>
				<View style={styles.container}>
			<View style={styles.card}>
				<Text style={styles.kicker}>Bienvenido a Wispic for Locals</Text>

				<Animated.View style={{ opacity, transform: [{ translateY }] }}>
					<Text style={styles.title}>{slides[index].title}</Text>
					<Text style={styles.body}>{slides[index].body}</Text>
				</Animated.View>

				<View style={styles.dotsRow}>
					{slides.map((_, i) => (
						<View
							key={i}
							style={[styles.dot, { backgroundColor: i === index ? BLUE : BLUE_LIGHT }]}
						/>
					))}
				</View>

						<Button
					title="Empezar"
					onPress={() => router.replace('/(owner-onboarding)/basic' as any)}
					style={{ backgroundColor: BLUE }}
				/>
					</View>
					</View>
				</OwnerBackground>
	);
}

const styles = StyleSheet.create({
		container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
	card: {
		width: '100%',
		maxWidth: 480,
		borderRadius: 20,
		padding: 20,
		backgroundColor: theme.colors.card,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	kicker: {
		color: BLUE,
		fontWeight: '800',
		letterSpacing: 0.3,
		textTransform: 'uppercase',
		fontSize: 12,
		marginBottom: 8,
	},
	title: {
		color: theme.colors.text,
		fontSize: 24,
		fontWeight: '800',
		marginBottom: 6,
	},
	body: {
		color: theme.colors.subtext,
		fontSize: 14,
	},
	dotsRow: {
		flexDirection: 'row',
		gap: 6,
		marginVertical: 16,
		alignSelf: 'center',
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 999,
	},
});

