import { Stack } from 'expo-router';
import { CompleteProfileProvider } from '../../../lib/completeProfileContext';

export default function CompleteFlowLayout() {
  return (
    <CompleteProfileProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
