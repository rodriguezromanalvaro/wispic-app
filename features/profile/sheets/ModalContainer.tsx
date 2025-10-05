import React from 'react';
import { Modal, View, TouchableOpacity, Text } from 'react-native';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';

interface ModalContainerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({ visible, onClose, title, children, footer }) => {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor: theme.colors.bg }}>
        <View style={{ paddingHorizontal:16, paddingTop:20, paddingBottom:12, borderBottomWidth:1, borderBottomColor: theme.colors.border, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: theme.colors.text, fontWeight:'700', fontSize:16 }}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: theme.colors.primary }}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex:1, padding:16 }}>
          {children}
        </View>
        {footer && (
          <View style={{ padding:16, borderTopWidth:1, borderTopColor: theme.colors.border }}>
            {footer}
          </View>
        )}
      </View>
    </Modal>
  );
};
