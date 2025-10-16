import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../../../lib/theme';

interface PromptListProps {
  prompts: { id: number|string; question?: string; response: string }[];
  limit?: number;
  emptyLabel?: string;
}

export const PromptList: React.FC<PromptListProps> = ({ prompts, limit = 3, emptyLabel }) => {
  if (!prompts || prompts.length === 0) {
    return emptyLabel ? <Text style={{ color: theme.colors.subtext }}>{emptyLabel}</Text> : null;
  }
  const list = prompts.slice(0, limit);
  return (
    <View style={{ gap: 12 }}>
      {list.map((p) => (
        <View key={p.id} style={{ backgroundColor: theme.colors.card, padding:12, borderRadius: 14 }}>
          <Text style={{ color: theme.colors.subtext, fontWeight: '600', marginBottom: 4, fontSize: 12 }}>{p.question || 'Question'}</Text>
          <Text style={{ color: theme.colors.text }}>{p.response}</Text>
        </View>
      ))}
    </View>
  );
};
