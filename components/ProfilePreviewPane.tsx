import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { P, H1, Button } from './ui';
import { getGenderLabel, toOrientationLabels } from '../lib/profileMappings';
import { ProfileDraft } from '../lib/completeProfileContext';
import { useTranslation } from 'react-i18next';

export function ProfilePreviewPane({ draft, showOrientation = true }: { draft: ProfileDraft; showOrientation?: boolean }) {
  const { t } = useTranslation();
  const interested = draft.interested_in || [];
  const tf = (k: string, def?: string) => t(k as any, def as any);
  const genderLabel = getGenderLabel(draft.gender as any, tf) || (draft.gender || '—');
  const orientLabels = toOrientationLabels(interested as any, tf);
  return (
    <View style={styles.container}>
      <H1 style={styles.title}>{t('profile.previewTitle','Vista previa')}</H1>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <P style={styles.label}>{t('complete.fieldName')}: <P style={styles.value}>{draft.name || '—'}</P></P>
        <P style={styles.label}>{t('complete.fieldBirth')}: <P style={styles.value}>{draft.birthdate || '—'}</P></P>
        <P style={styles.label}>{t('complete.fieldGender')}: <P style={styles.value}>{genderLabel}</P></P>
        {showOrientation && (
          <P style={styles.label}>{t('complete.fieldInterestedIn','Me interesa')}: <P style={styles.value}>{orientLabels.length ? orientLabels.join(' • ') : '—'}</P></P>
        )}
        <P style={[styles.label,{marginTop:12}]}>{t('complete.fieldBio')}</P>
        <P style={styles.value}>{draft.bio || '—'}</P>
        {draft.prompts?.length ? (
          <View style={{ marginTop: 16 }}>
            {draft.prompts.map(p => (
              <P key={p.key} style={styles.promptLine}>{t(`complete.prompt.${p.key}.title`, p.key)}: {(p.answers||[]).map(ans => t(`complete.prompt.${p.key}.answers.${ans}`, ans)).join(' • ')}</P>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 360, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 },
  title: { fontSize: 20, color: '#FFFFFF', marginBottom: 12 },
  label: { color: '#CBD5E1', marginTop: 4 },
  value: { color: '#FFFFFF', fontWeight: '500' },
  promptLine: { color: '#E2E8F0', marginTop: 6 }
});
