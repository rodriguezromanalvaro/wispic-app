import { Stack } from 'expo-router';
export default function ChatStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[matchId]" />
    </Stack>
  );
}

