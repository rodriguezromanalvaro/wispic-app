import { useEffect } from 'react';

import { Stack } from 'expo-router';

import { applyPalette } from 'lib/theme';

export default function OwnerOnboardingStack() {
  useEffect(() => {
    applyPalette('owner');
    return () => { applyPalette('magenta'); };
  }, []);
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="basic" />
      <Stack.Screen name="details" />
      <Stack.Screen name="media" />
      <Stack.Screen name="goals" />
    </Stack>
  );
}
