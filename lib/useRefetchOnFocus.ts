import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
export function useRefetchOnFocus(refetch: () => void) {
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
}
