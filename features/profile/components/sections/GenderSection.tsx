import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../../../lib/theme';
import { SectionShell } from './SectionShell';

interface Props {
  gender?: string | null;
  hidden?: boolean;
  onEdit?: () => void;
}

export const GenderSection: React.FC<Props> = ({ gender, hidden, onEdit }) => {
  const { t } = useTranslation();
  const mapKey = (val?: string|null) => {
    if (!val) return '';
    const normalized = val.toLowerCase();
    const key = normalized === 'male' ? 'complete.male' : normalized === 'female' ? 'complete.female' : normalized === 'other' ? 'complete.other' : undefined;
    if (key) {
      const translated = t(key as any);
      if (translated && translated !== key) return translated;
    }
    // fallback direct translation by generic key if present
    const direct = t(`gender.${normalized}`, val);
    return direct || val;
  };
  return (
    <SectionShell
      title={t('profile.sections.gender', 'Género')}
      icon="⚧️"
      hidden={hidden}
      onEdit={onEdit}
    >
      {gender ? (
        <Text style={styles.value}>{mapKey(gender)}</Text>
      ) : (
        <TouchableOpacity disabled={!onEdit} onPress={onEdit}>
          <Text style={styles.add}>{t('common.add', 'Añadir')}</Text>
        </TouchableOpacity>
      )}
    </SectionShell>
  );
};

const styles = StyleSheet.create({
  value: { color: theme.colors.text, fontSize:14, fontWeight:'600' },
  add: { color: theme.colors.primary, fontSize:14, fontWeight:'600' },
  // removed hidden explanatory note per new requirement
});

export default GenderSection;