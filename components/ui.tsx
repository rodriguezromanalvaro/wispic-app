import { Text, View, Pressable, TextInput as RNTextInput, Switch as RNSwitch, StyleSheet } from 'react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { focusRing } from '../lib/theme-context';
import { theme } from '../lib/theme';
import { typography } from '../lib/typography';

type Edge = 'top'|'bottom'|'left'|'right';
export const Screen: React.FC<{ children: any; style?: any; edges?: Edge[] }> = ({ children, style, edges = ['bottom'] }) => {
  const flat = StyleSheet.flatten(style) || {};
  const bg = (flat as any).backgroundColor ?? 'transparent';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={edges}>
      <View
        style={[
          {
            flex: 1,
            padding: theme.spacing(2),
            gap: theme.spacing(2),
          },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
};

export const Card: React.FC<{
  children: any;
  style?: any;
  onPress?: () => void;
}> = ({ children, style, onPress }) => {
  const baseStyle = {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
  } as const;

  if (onPress) {
    return (
      <Pressable style={[baseStyle, style]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
};

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  disabled?: boolean;
  style?: any;
  gradient?: boolean; // usar gradiente de marca
  size?: 'md' | 'lg';
  gradientColors?: [string, string]; // permite override del gradiente (ej: azul para owners)
}> = ({ title, onPress, variant = 'primary', disabled, style, gradient = true, size = 'md', gradientColors }) => {
  const isDark = theme.mode === 'dark';
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const baseBg = variant === 'primary'
    ? (gradient ? 'transparent' : theme.colors.primary)
    : variant === 'danger'
    ? theme.colors.danger
    : variant === 'outline'
    ? 'transparent'
    : 'transparent';
  const color = variant === 'primary' ? theme.colors.primaryText : (variant === 'danger' ? theme.colors.white : theme.colors.text);
  const borderColor = variant === 'ghost' ? 'transparent' : (variant === 'outline' ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.10)') : 'transparent');
  const ring = focused ? focusRing(theme.mode) : null;
  const scale = pressed ? 0.97 : 1;
  const padV = size === 'lg' ? 18 : 12;
  const padH = size === 'lg' ? 20 : 16;
  const radius = size === 'lg' ? Math.max(theme.radius, 28) : theme.radius;
  const textStyle = size === 'lg'
    ? { ...typography.scale.bodyBold, fontSize: 18, lineHeight: 22 }
    : { ...(typography.scale.bodyBold) };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderRadius: radius,
          backgroundColor: disabled ? (isDark ? '#3a3f47' : '#E5E9F0') : baseBg,
          borderWidth: 1,
          borderColor,
          opacity: disabled ? 0.65 : 1,
          overflow: 'hidden'
        },
        { transform: [{ scale }] },
        ring,
        style,
      ]}
    >
      {gradient && variant==='primary' && !disabled && (
        <LinearGradient
          colors={(gradientColors || (theme.gradients.brand as [string, string]))}
          start={{ x:0, y:0 }} end={{ x:1, y:0 }}
          style={stylesPrimary.gradientOverlay}
          pointerEvents="none"
        />
      )}
      <Text style={{ textAlign: 'center', color, ...textStyle }}>{title}</Text>
    </Pressable>
  );
};

export const TextInput: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: any;
}> = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  style,
}) => {
  const baseStyle = {
    color: theme.mode === 'dark' ? '#E6EAF2' : theme.colors.text,
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.14)' : theme.colors.border,
    borderRadius: theme.radius,
    padding: 14,
    minHeight: multiline ? 100 : undefined,
  } as const;
  return (
    <RNTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.mode === 'dark' ? '#A3AEC2' : '#8B92A3'}
      multiline={multiline}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={[baseStyle, style]}
      onFocus={(e) => {
        (e.target as any).setNativeProps?.({ style: { ...focusRing(theme.mode), borderColor: theme.colors.focus } });
      }}
      onBlur={(e) => {
        (e.target as any).setNativeProps?.({ style: { borderColor: baseStyle.borderColor, shadowOpacity: 0 } });
      }}
    />
  );
};

export const H1: React.FC<{ children: any; style?: any }> = ({ children, style }) => (
  <Text style={[{ color: theme.colors.text }, typography.scale.h1, style]}>{children}</Text>
);

export const P: React.FC<{ children: any; style?: any; bold?: boolean; dim?: boolean }> = ({ children, style, bold, dim }) => (
  <Text style={[
    dim ? { color: theme.colors.textDim } : { color: theme.colors.subtext },
    bold ? typography.scale.bodyBold : typography.scale.body,
    style
  ]}>{children}</Text>
);

export const Switch: React.FC<{ value: boolean; onValueChange: (v: boolean) => void; style?: any }> = ({ value, onValueChange, style }) => (
  <RNSwitch
    value={value}
    onValueChange={onValueChange}
    trackColor={{ false: '#475569', true: theme.colors.primary }}
    thumbColor={value ? '#fff' : '#cbd5e1'}
    style={style}
  />
);

const stylesPrimary = StyleSheet.create({
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    // Placeholder para gradiente futuro (se puede reemplazar por LinearGradient)
    // LinearGradient cubrirá esto; dejamos fallback transparente
    backgroundColor: 'transparent'
  }
});

export const Divider: React.FC<{ inset?: boolean; style?: any }> = ({ inset, style }) => (
  <View
    style={[
      {
        height: 1,
        backgroundColor: (theme.colors as any).divider || theme.colors.border,
        marginLeft: inset ? 16 : 0,
        opacity: 0.9
      },
      style
    ]}
  />
);

// Progress bar superior con gradiente brand
export const ProgressBar: React.FC<{ progress: number; style?: any }> = ({ progress, style }) => (
  <View style={[{ height: 4, backgroundColor: theme.colors.border, borderRadius: 999, overflow: 'hidden' }, style]}>
    <LinearGradient
      colors={theme.gradients.brand as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, height: '100%' }}
    />
  </View>
);

// Tile de selección accesible: activo con fondo surfaceMuted y borde 2px primary
export const SelectionTile: React.FC<{
  active?: boolean;
  label: string;
  onPress?: () => void;
  indicator?: 'radio' | 'check' | 'left-accent' | 'chevron' | 'none';
  activeBorderGradient?: boolean; // envuelve con gradiente cuando activo (para check)
  leftAccentOnActive?: boolean; // dibuja barra izquierda cuando activo
  iconLeft?: React.ReactNode; // icono opcional a la izquierda
  style?: any;
}> = ({ active, label, onPress, indicator = 'radio', activeBorderGradient, leftAccentOnActive, iconLeft, style }) => {
  const baseInner = (
    <Pressable
      onPress={onPress}
      style={[
        {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: theme.radius,
          borderWidth: active ? (activeBorderGradient ? 0 : 2) : 1,
          borderColor: active ? (activeBorderGradient ? 'transparent' : theme.colors.primary) : theme.colors.border,
          backgroundColor: active ? ((theme.colors as any).surfaceMuted || theme.colors.card) : theme.colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        leftAccentOnActive && active ? { borderLeftWidth: 3, borderLeftColor: theme.colors.primary } : null,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        {iconLeft ? <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>{iconLeft}</View> : null}
        <Text style={[typography.scale.body, { color: theme.colors.text, fontWeight: active ? '700' as any : undefined }]} numberOfLines={2}>{label}</Text>
      </View>
      {(() => {
        switch (indicator) {
          case 'radio':
            return (
              <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 20, height: 20, borderRadius: 999, borderWidth: 2, borderColor: active ? theme.colors.primary : theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  {active ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: theme.colors.primary }} /> : null}
                </View>
              </View>
            );
          case 'check':
            return (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#fff') : 'transparent' }}>
                <Text style={{ color: active ? theme.colors.primary : theme.colors.textDim, ...typography.scale.caption }}>{active ? '✓' : ' '}</Text>
              </View>
            );
          case 'chevron':
            return (<Text style={{ color: theme.colors.textDim, fontSize: 18, marginLeft: 8 }}>›</Text>);
          case 'left-accent':
          case 'none':
          default:
            return null;
        }
      })()}
    </Pressable>
  );

  if (active && activeBorderGradient) {
    return (
      <LinearGradient colors={theme.gradients.brand as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: theme.radius, padding: 1 }}>
        <View style={{ borderRadius: theme.radius, overflow: 'hidden' }}>{baseInner}</View>
      </LinearGradient>
    );
  }
  return baseInner;
};

// Footer fijo con CTA primario
export const StickyFooterCTA: React.FC<{
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
}> = ({ title, onPress, disabled, style }) => (
  <View style={[{ padding: theme.spacing(2), backgroundColor: theme.colors.bg }, style]}>
    <Button title={title} onPress={onPress} disabled={disabled} />
  </View>
);

// Footer fijo con dos o más acciones apiladas (full-width)
export const StickyFooterActions: React.FC<{
  actions: Array<{ title: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'outline'; disabled?: boolean; gradientColors?: [string, string] }>;
  stacked?: boolean; // futuro: permitir horizontal
  style?: any;
  note?: React.ReactNode; // opcional: texto/JSX para mostrar encima de los botones (errores, ayuda)
}> = ({ actions, stacked = true, style, note }) => {
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'transparent' }}>
      <View
        style={[
          {
            paddingHorizontal: theme.spacing(2),
            paddingTop: theme.spacing(1),
            paddingBottom: theme.spacing(1),
            // Sin borde superior ni color sólido para que se funda con el fondo
            backgroundColor: 'transparent',
          },
          style,
        ]}
      >
        {note ? <View style={{ marginBottom: 8 }}>{note}</View> : null}
        <View style={{ gap: 8 }}>
          {actions.map((a, i) => (
            <Button key={i} title={a.title} onPress={a.onPress} variant={a.variant} disabled={a.disabled} style={{ width: '100%' }} gradientColors={a.gradientColors} />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

// Chip compacto para estados (denegado/bloqueado)
export const Chip: React.FC<{ label: string; tone?: 'neutral' | 'danger'; style?: any }>= ({ label, tone = 'neutral', style }) => (
  <View
    style={[
      {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tone === 'danger' ? theme.colors.danger : theme.colors.border,
        backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFF',
      },
      style,
    ]}
  >
    <Text style={{ color: tone === 'danger' ? theme.colors.danger : theme.colors.textDim, ...typography.scale.caption }}>
      {label}
    </Text>
  </View>
);

// Full-screen uploading overlay modal
export const UploadOverlayModal: React.FC<{
  visible: boolean;
  title?: string;
  subtitle?: string | React.ReactNode;
}> = ({ visible, title = 'Subiendo fotos…', subtitle }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
    <View style={stylesUpload.overlay}>
      <View style={stylesUpload.card}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <H1 style={{ fontSize: 18, marginTop: 12 }}>{title}</H1>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <P style={{ color: theme.colors.textDim, marginTop: 4 }}>{subtitle}</P>
          ) : (
            subtitle
          )
        ) : null}
      </View>
    </View>
  </Modal>
);

const stylesUpload = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '80%', maxWidth: 360, borderRadius: 16, backgroundColor: theme.colors.bg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
});
