import { useMemo } from 'react';

import { Stack } from 'expo-router';

import { useThemeMode } from 'lib/theme-context';

export default function OwnerAuthLayout() {
  // Do NOT switch to owner palette for owner-auth; keep whatever palette is active (auth = magenta)
  const { theme } = useThemeMode();
  const contentStyle = useMemo(() => ({ backgroundColor: theme.colors.bg }), [theme]);
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle }} />;
}
