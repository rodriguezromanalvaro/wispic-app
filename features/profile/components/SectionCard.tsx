import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { theme } from '../../../lib/theme';

interface SectionCardProps {
  title?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: ViewStyle;
  footer?: React.ReactNode;
  dense?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, right, children, style, footer, dense }) => {
  return (
    <View style={[{ backgroundColor: theme.colors.card, padding: dense ? 12 : 16, borderRadius: 16, gap: 8 }, style]}>
      {(title || right) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {title ? <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
      {footer}
    </View>
  );
};
