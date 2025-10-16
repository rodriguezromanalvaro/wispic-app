import { Stack } from 'expo-router';
export default function EventsStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Registrar sólo rutas existentes para evitar warnings */}
      <Stack.Screen name="series/[seriesId]" />
    </Stack>
  );
}
