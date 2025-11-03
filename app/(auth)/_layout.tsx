import { useEffect, useCallback } from 'react';

import { Stack } from 'expo-router';
import { applyPalette } from 'lib/theme';
import { useFocusEffect } from '@react-navigation/native';

export default function AuthLayout() {
  // Todo lo híbrido (auth) debe ser MAGENTA siempre
  useEffect(() => { applyPalette('magenta'); }, []);
  // Reaplicar cuando el stack recupere foco (volver desde owner, etc.)
  useFocusEffect(useCallback(() => {
    applyPalette('magenta');
  }, []));
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
