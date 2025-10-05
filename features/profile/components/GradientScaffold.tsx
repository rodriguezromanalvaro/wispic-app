import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../../lib/theme';

interface GradientScaffoldProps {
  children: React.ReactNode;
}

export const GradientScaffold: React.FC<GradientScaffoldProps> = ({ children }) => {
  return (
    <LinearGradient
      colors={[theme.colors.gradientTop, theme.colors.gradientMid, theme.colors.gradientBottom]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.gradient}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex:1 }
});
