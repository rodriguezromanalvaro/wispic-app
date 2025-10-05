import { Text, View, Pressable, TextInput as RNTextInput, Switch as RNSwitch, StyleSheet } from 'react-native';
import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { focusRing } from '../lib/theme-context';
import { theme } from '../lib/theme';
import { typography } from '../lib/typography';

export const Screen: React.FC<{ children: any; style?: any }> = ({ children, style }) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['bottom']}>
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
}> = ({ title, onPress, variant = 'primary', disabled, style, gradient = true }) => {
  const isDark = theme.mode === 'dark';
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const baseBg = variant === 'primary'
    ? (gradient ? 'transparent' : theme.colors.primary)
    : variant === 'danger'
    ? theme.colors.danger
    : variant === 'outline'
    ? (isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF')
    : 'transparent';
  const color = variant === 'primary' ? theme.colors.primaryText : (variant === 'danger' ? theme.colors.white : theme.colors.text);
  const borderColor = variant === 'ghost' ? 'transparent' : (variant === 'outline' ? theme.colors.border : 'transparent');
  const ring = focused ? focusRing(theme.mode) : null;
  const scale = pressed ? 0.97 : 1;
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
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: theme.radius,
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
          colors={theme.gradients.brand as [string,string]}
          start={{ x:0, y:0 }} end={{ x:1, y:0 }}
          style={stylesPrimary.gradientOverlay}
          pointerEvents="none"
        />
      )}
      <Text style={{ textAlign: 'center', color, ...(typography.scale.bodyBold) }}>{title}</Text>
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
