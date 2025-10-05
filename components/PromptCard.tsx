import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { P, Button } from './ui';

export type PromptCardProps = {
  title: string;
  icon?: string;
  choices: string[];
  selected: string[];
  maxChoices: number;
  translateChoice: (key: string) => string;
  onToggle: (choice: string) => void;
  colorAccent?: string;
};

function PromptCardCmp({ title, icon, choices, selected, maxChoices, translateChoice, onToggle, colorAccent }: PromptCardProps) {
  return (
    <View style={[styles.card, colorAccent ? { borderLeftColor: colorAccent } : null]}>
      <View style={styles.headerRow}>
        <P style={styles.title}>{icon ? icon + ' ' : ''}{title}</P>
        {maxChoices > 1 && (
          <P style={styles.multiBadge}>{selected.length}/{maxChoices}</P>
        )}
      </View>
      <View style={styles.choicesWrap}>
        {choices.map(key => {
          const active = selected.includes(key);
          const disable = !active && selected.length >= maxChoices;
          return (
            <Button
              key={key}
              title={translateChoice(key)}
              variant={active ? 'primary' : 'ghost'}
              disabled={disable && !active}
              style={[styles.choiceBtn, disable && !active ? { opacity: 0.45 } : null]}
              onPress={() => onToggle(key)}
            />
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderLeftWidth: 4,
    borderLeftColor: 'transparent'
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { color: '#E6EAF2', fontWeight: '600', flexShrink: 1 },
  multiBadge: { marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, color: '#E6EAF2', fontSize: 12 },
  choicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  choiceBtn: { marginBottom: 6 },
});
