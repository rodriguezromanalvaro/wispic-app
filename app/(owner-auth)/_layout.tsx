import { Stack } from 'expo-router';
import { applyPalette, theme } from '../../lib/theme';
import { useEffect } from 'react';

export default function OwnerAuthLayout() {
  useEffect(() => {
    applyPalette('owner');
    return () => { applyPalette('coral'); };
  }, []);
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: theme.colors.bg } }} />;
}
