import { useCallback } from 'react';

import { useFocusEffect } from 'expo-router';
export function useRefetchOnFocus(refetch: () => void) {
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
}
