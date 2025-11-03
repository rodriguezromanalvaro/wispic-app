import { memo } from 'react';

import { View, StyleSheet, Pressable, Text } from 'react-native';

import { theme } from 'lib/theme';
import { typography } from 'lib/typography';

import { P } from './ui';

export type PromptCardProps = {
  title: string;
  icon?: string;
  choices: string[];
  selected: string[];
  maxChoices: number;
  translateChoice: (key: string) => string;
  onToggle: (choice: string) => void;
  disableNewSelection?: boolean; // bloquea nuevas selecciones cuando se alcance el máximo global
};

function PromptCardCmp({ title, icon, choices, selected, maxChoices, translateChoice, onToggle, disableNewSelection }: PromptCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <P style={styles.title}>{icon ? icon + ' ' : ''}{title}</P>
        {maxChoices > 1 && (
          <P style={styles.multiBadge}>{selected.length}/{maxChoices}</P>
        )}
      </View>
      <View style={styles.choicesWrap}>
        {choices.map(key => {
          const active = selected.includes(key);
          const reachedLocal = selected.length >= maxChoices;
          const blockNew = !active && (reachedLocal || disableNewSelection);
          return (
            <Pressable
              key={key}
              onPress={() => !blockNew || active ? onToggle(key) : null}
              disabled={blockNew && !active}
              style={[
                styles.chip,
                active ? styles.chipActive : styles.chipInactive,
                blockNew && !active ? { opacity: 0.45 } : null,
              ]}
            >
              <Text style={[typography.scale.body, { color: active ? theme.colors.text : theme.colors.text, fontWeight: active ? '700' as any : undefined }]}> 
                {translateChoice(key)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const PromptCard = memo(PromptCardCmp);

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#E6EAF2'
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { color: theme.colors.text, fontWeight: '700', flexShrink: 1 },
  multiBadge: { marginLeft: 8, backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, color: theme.colors.text, fontSize: 12 },
  choicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.18)' : '#CBD5E1',
  },
  chipActive: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#FFFFFF',
    borderColor: theme.colors.primary,
  },
});
