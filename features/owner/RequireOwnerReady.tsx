import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useOwner } from '../../lib/hooks/useOwner';
import { router } from 'expo-router';
import { theme } from '../../lib/theme';

export const RequireOwnerReady: React.FC<{ children: any }> = ({ children }) => {
  const { loading, isOwner, needsOnboarding } = useOwner();

  useEffect(() => {
    if (!loading && isOwner && needsOnboarding) {
      router.replace('/(owner-onboarding)' as any);
    }
  }, [loading, isOwner, needsOnboarding]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return children;
};
