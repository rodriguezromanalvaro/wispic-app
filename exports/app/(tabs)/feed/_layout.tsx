import { Stack } from 'expo-router';
export default function FeedStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[eventId]" />
    </Stack>
  );
}
