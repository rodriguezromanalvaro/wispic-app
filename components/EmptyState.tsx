import React from 'react';

import { View, Text, Image } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';

import { Button } from 'components/ui';
import { theme } from 'lib/theme';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  illustrationSource?: any; // ImageSourcePropType
  style?: any;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  subtitle,
  ctaLabel,
  onPressCta,
  iconName = 'chatbubbles-outline',
  illustrationSource,
  style,
}) => {
  const showCTA = !!ctaLabel && !!onPressCta;
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 16 }, style]}> 
      {/* Visual hero: illustration or gradient icon */}
      <View style={{ width: 140, height: 140, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
        {illustrationSource ? (
          <Image source={illustrationSource} style={{ width: '100%', height: '100%', opacity: 0.9, tintColor: undefined }} resizeMode="contain" />
        ) : (
          <LinearGradient
            colors={(theme.gradients?.brandSoft as [string,string]) || (theme.gradients.brand as [string,string])}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', opacity: 0.95 }}
          >
            <View style={{ width: 94, height: 94, borderRadius: 48, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={iconName} size={36} color={theme.colors.primary} />
            </View>
          </LinearGradient>
        )}
      </View>

      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: theme.colors.subtext, textAlign: 'center', marginTop: 6, maxWidth: 380 }}>{subtitle}</Text>
      ) : null}

      {showCTA ? (
        <View style={{ marginTop: 16, width: '100%', maxWidth: 320 }}>
          <Button title={ctaLabel!} onPress={onPressCta!} />
        </View>
      ) : null}
    </View>
  );
};

export default EmptyState;
