import { memo } from 'react';
import { View, Text } from 'react-native';
import { theme } from '../lib/theme';

type Props = {
  label: string;
  variant?: 'neutral' | 'warning' | 'success';
};

export const Badge = memo(function Badge({ label, variant = 'neutral' }: Props) {
  const palette =
    variant === 'success'
      ? { bg: '#10B98122', border: '#10B98155', text: '#065F46' }
      : variant === 'warning'
      ? { bg: '#F59E0B22', border: '#F59E0B55', text: '#7C2D12' }
      : { bg: theme.colors.card, border: theme.colors.border, text: theme.colors.subtext };

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: palette.text, fontWeight: '800', fontSize: 12 }}>{label}</Text>
    </View>
  );
});
