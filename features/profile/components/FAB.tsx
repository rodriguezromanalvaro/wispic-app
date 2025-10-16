import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../../lib/theme';

interface FABProps { label?: string; icon?: string; onPress: () => void; style?: ViewStyle; }

export const FAB: React.FC<FABProps> = ({ label, icon='＋', onPress, style }) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.fab, style]}>
      <Text style={styles.icon}>{icon}</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: { position:'absolute', right:20, bottom:30, backgroundColor: theme.colors.primary, flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:18, paddingVertical:14, borderRadius:28, shadowColor:'#000', shadowOpacity:0.3, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:6 },
  icon: { color:'#fff', fontSize:18, fontWeight:'700', marginTop:-2 },
  label: { color:'#fff', fontSize:14, fontWeight:'700' }
});

export default FAB;