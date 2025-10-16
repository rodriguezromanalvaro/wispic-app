import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../../../lib/theme';
import { SectionShell } from './SectionShell';

interface Props {
  city?: string | null;
  onEdit?: () => void;
  permissionGranted?: boolean;
}

export const LocationSection: React.FC<Props> = ({ city, onEdit, permissionGranted }) => {
  const { t } = useTranslation();
  const value = city && city.trim().length > 0
    ? city
    : (permissionGranted ? t('profile.location.unknown','Sin ubicación') : t('profile.location.noPermission','Sin ubicación'));
  return (
    <SectionShell
      title={t('profile.sections.location', 'Ubicación')}
      icon="📍"
      onEdit={onEdit}
    >
      {city ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        <TouchableOpacity disabled={!onEdit} onPress={onEdit}>
          <Text style={[styles.value, !permissionGranted && styles.dim]}>{value}</Text>
        </TouchableOpacity>
      )}
    </SectionShell>
  );
};

const styles = StyleSheet.create({
  value: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  dim: { color: theme.colors.subtext, fontWeight: '500' }
});

export default LocationSection;
