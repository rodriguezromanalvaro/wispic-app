import { useEffect, useCallback } from 'react';

import { Stack } from 'expo-router';

import { CompleteProfileProvider } from 'features/profile/model';
import { applyPalette } from 'lib/theme';

import { useFocusEffect } from '@react-navigation/native';

export default function CompleteFlowLayout() {
  // Completar perfil corresponde a usuario final: MAGENTA
  useEffect(() => { applyPalette('magenta'); }, []);
  useFocusEffect(useCallback(() => { applyPalette('magenta'); }, []));
  return (
    <CompleteProfileProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
  {/* 1-10: pasos obligatorios */}
  <Stack.Screen name="welcome" />
  <Stack.Screen name="name" />
  <Stack.Screen name="birth" />
  <Stack.Screen name="gender" />
  <Stack.Screen name="seeking" />
  <Stack.Screen name="orientation" />
  <Stack.Screen name="relationship" />
  <Stack.Screen name="permissions" />
  <Stack.Screen name="photos" />
  <Stack.Screen name="summary" />
        {/* 11-13: pasos extra */}
        <Stack.Screen name="post-save" />
        <Stack.Screen name="bio" />
        <Stack.Screen name="prompts" />
      </Stack>
    </CompleteProfileProvider>
  );
}
