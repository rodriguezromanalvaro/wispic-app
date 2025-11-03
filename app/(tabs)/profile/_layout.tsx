import { Stack } from 'expo-router';

export default function ProfileStackLayout() {
  // Nested stack under the Profile tab so that /profile/configure, /profile/location, /profile/photos
  // render as stack screens instead of individual tabs.
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
