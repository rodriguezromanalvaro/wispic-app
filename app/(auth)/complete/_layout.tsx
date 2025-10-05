import { Stack } from 'expo-router';
import { CompleteProfileProvider } from '../../../lib/completeProfileContext';

export default function CompleteFlowLayout() {
  return (
    <CompleteProfileProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="name" />
        <Stack.Screen name="birth" />
        <Stack.Screen name="gender" />
    <Stack.Screen name="bio" />
    <Stack.Screen name="photos" />
        <Stack.Screen name="summary" />
      </Stack>
    </CompleteProfileProvider>
  );
}
