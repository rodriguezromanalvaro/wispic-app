import React from 'react';
import { Text } from 'react-native';
import { SectionShell } from './SectionShell';
import { CompletionMeter } from '../CompletionMeter';
import { useTranslation } from 'react-i18next';

export const CompletionSection: React.FC<{ completion: any; onEdit?: () => void; }> = ({ completion, onEdit }) => {
  const { i18n } = useTranslation();
  const pct = completion?.score ?? 0;
  const title = i18n.language.startsWith('es') ? `${pct}% Perfil Completo` : `${pct}% Profile Complete`;
  return (
  <SectionShell title={title} icon="🏅" onEdit={onEdit}>
      <CompletionMeter completion={completion} hideTitle />
    </SectionShell>
  );
};
