import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ModalContainer } from './ModalContainer';
import { theme } from '../../../lib/theme';
import { CompletionResult } from '../logic/computeCompletion';
import { useTranslation } from 'react-i18next';

interface Props { visible: boolean; onClose: () => void; completion?: CompletionResult | null; }

const LABELS: Record<string, { es: string; en: string }> = {
  display_name: { es: 'Nombre', en: 'Name' },
  bio: { es: 'Bio', en: 'Bio' },
  birthdate: { es: 'Fecha de nacimiento', en: 'Birthdate' },
  gender: { es: 'Género', en: 'Gender' },
  prompts: { es: 'Prompts', en: 'Prompts' },
  photos: { es: 'Fotos', en: 'Photos' }
};

export const CompletionDetailsSheet: React.FC<Props> = ({ visible, onClose, completion }) => {
  const { i18n } = useTranslation();
  const langEs = i18n.language.startsWith('es');
  const pct = completion?.score ?? 0;
  const missing = completion?.missing || [];
  const missingTitle = langEs ? 'Pendiente para completar tu perfil' : 'Still missing to complete your profile';
  const doneTitle = langEs ? 'Perfil completo ✅' : 'Profile complete ✅';
  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title={langEs ? 'Estado del perfil' : 'Profile status'}
      footer={<TouchableOpacity onPress={onClose} style={{ backgroundColor: theme.colors.primary, padding:14, borderRadius:12, alignItems:'center' }}><Text style={{ color: theme.colors.primaryText, fontWeight:'600' }}>{langEs ? 'Cerrar' : 'Close'}</Text></TouchableOpacity>}
    >
      <View style={{ gap:16 }}>
        <Text style={{ color:'#fff', fontSize:18, fontWeight:'700' }}>{pct}%</Text>
        {missing.length ? (
          <View style={{ gap:12 }}>
            <Text style={{ color: theme.colors.subtext, fontSize:13 }}>{missingTitle}</Text>
            <View style={{ gap:8 }}>
              {missing.map(key => (
                <View key={key} style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  <View style={{ width:8, height:8, borderRadius:4, backgroundColor: theme.colors.primary }} />
                  <Text style={{ color:'#fff', fontSize:14 }}>{LABELS[key]?.[langEs ? 'es' : 'en'] || key}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: theme.colors.subtext, fontSize:13 }}>{doneTitle}</Text>
        )}
      </View>
    </ModalContainer>
  );
};

export default CompletionDetailsSheet;