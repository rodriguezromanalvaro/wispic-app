import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { theme } from '../../../lib/theme';

interface GradientScaffoldProps {
  children: React.ReactNode;
}

export const GradientScaffold: React.FC<GradientScaffoldProps> = ({ children }) => {
  const colors = theme.mode === 'dark'
    ? (theme.gradients.dark as [string, string])
    : (theme.gradients.appBg as [string, string, string]);
  return (
    <LinearGradient
      colors={colors as any}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
});
