import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../../../lib/theme';

interface ChipsRowProps {
  items: string[] | undefined | null;
  emptyLabel?: string;
  limit?: number;
}

export const ChipsRow: React.FC<ChipsRowProps> = ({ items, emptyLabel, limit }) => {
  if (!items || items.length === 0) {
    return emptyLabel ? <Text style={{ color: theme.colors.subtext, fontSize: 12 }}>{emptyLabel}</Text> : null;
  }
  const list = typeof limit === 'number' ? items.slice(0, limit) : items;
  return (
    <View style={{ flexDirection:'row', flexWrap:'wrap', gap: 6 }}>
      {list.map((it, i) => (
        <View key={i} style={{ backgroundColor: theme.colors.card, paddingHorizontal:10, paddingVertical:6, borderRadius:20 }}>
          <Text style={{ color: theme.colors.text, fontSize: 12 }}>{it}</Text>
        </View>
      ))}
      {limit && items.length > limit && (
        <View style={{ backgroundColor: theme.colors.card, paddingHorizontal:10, paddingVertical:6, borderRadius:20 }}>
          <Text style={{ color: theme.colors.subtext, fontSize: 12 }}>+{items.length - limit}</Text>
        </View>
      )}
    </View>
  );
};
