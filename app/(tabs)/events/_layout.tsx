import { Stack } from 'expo-router';
export default function EventsStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="people" />
    </Stack>
  );
}
