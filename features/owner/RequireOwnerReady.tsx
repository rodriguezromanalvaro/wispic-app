import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { View, ActivityIndicator } from 'react-native';

import { router } from 'expo-router';

import { useOwner } from 'lib/hooks/useOwner';
import { theme } from 'lib/theme';

type Props = { children: ReactNode };
export const RequireOwnerReady = ({ children }: Props) => {
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
