import React from 'react';
import { Stack } from 'expo-router';

export default function SeriesLayout() {
  // Use a Stack inside the owner tabs for series screens so they don't become tabs.
  return (
    <Stack screenOptions={{ headerShown: true }} />
  );
}
