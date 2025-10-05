import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../lib/theme';

interface CenterScaffoldProps {
  children: React.ReactNode;
  /**
   * minimal -> fondo neutro oscuro casi plano (colores sólo en CTAs)
   * auth -> (ahora delega a minimal para no saturar) antes era brand
   * profile -> gradient oscuro base
   * brand / positive -> variantes puntuales con color
   */
  variant?: 'light' | 'minimal' | 'auth' | 'profile' | 'brand' | 'positive';
  paddedTop?: number;
  style?: ViewStyle;
  /** Dibuja una fina línea/acento superior usando el gradiente brand */
  topAccent?: boolean;
}

export const CenterScaffold: React.FC<CenterScaffoldProps> = ({ children, variant='profile', paddedTop=0, style, topAccent }) => {
  let base: string[];
  switch (variant) {
    case 'light':
      base = theme.gradients.dark; // forzamos dark baseline ahora; light queda opcional
      break;
    case 'minimal':
    case 'auth': // auth cae en minimal para no sobrecargar color
      // Fondo casi plano según modo (usamos tokens gradientTop/Mid/Bottom)
      if (theme.mode === 'dark') {
        base = [theme.darkColors.gradientMid, theme.darkColors.gradientMid, theme.darkColors.gradientBottom];
      } else {
        base = ['#FFFFFF', '#FFFFFF', '#F5F7FA'];
      }
      break;
    case 'brand':
      base = theme.gradients.brand;
      break;
    case 'positive':
      base = theme.gradients.positive;
      break;
    case 'profile':
    default:
      base = theme.gradients.dark;
      break;
  }
  const normalized = base.length >= 3 ? base.slice(0,3) : [base[0], base[1] ?? base[0], base[base.length-1] ?? base[0]];
  const gradient = normalized as [string,string,string];
  const maxWidth = (variant === 'auth') ? theme.layout.authWidth : theme.layout.maxWidth;
  return (
    <LinearGradient colors={gradient} style={styles.gradient}>
      {/* Glow superior decorativo opcional */}
      <LinearGradient
        colors={theme.gradients.glowTop as [string,string]}
        style={styles.glowTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={theme.gradients.glowBottom as [string,string]}
        style={styles.glowBottom}
        pointerEvents="none"
      />
      {topAccent && (
        <LinearGradient
          colors={theme.gradients.brand as [string,string]}
          start={{ x:0, y:0 }} end={{ x:1, y:0 }}
          style={styles.topAccent}
        />
      )}
      <View style={[styles.inner, { maxWidth, paddingTop: paddedTop }, style]}>
        {children}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex:1 },
  inner: { flex:1, width:'100%', alignSelf:'center', paddingHorizontal:20 },
  topAccent: { position:'absolute', left:0, right:0, top:0, height:2, opacity:0.9 },
  glowTop: { position:'absolute', left:0, right:0, top:0, height:180 },
  glowBottom: { position:'absolute', left:0, right:0, bottom:0, height:240 }
});
