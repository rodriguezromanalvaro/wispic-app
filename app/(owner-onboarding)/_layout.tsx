import { Stack } from 'expo-router';
import { applyPalette, theme } from '../../lib/theme';
import { useEffect } from 'react';

export default function OwnerOnboardingStack() {
  useEffect(() => {
    applyPalette('owner');
    return () => { applyPalette('coral'); };
  }, []);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="basic" />
      <Stack.Screen name="details" />
      <Stack.Screen name="media" />
      <Stack.Screen name="goals" />
    </Stack>
  );
}
