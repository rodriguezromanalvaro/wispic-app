import { useMemo, useRef, useState } from 'react';
import React from 'react';

import { View, Pressable, TextInput as RNTextInput, Switch as RNSwitch, StyleSheet } from 'react-native';
import { ActivityIndicator, Modal } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { SafeAreaView } from 'react-native-safe-area-context';

import { Button as TgButton, Text as TgText, YStack as TgYStack, XStack as TgXStack } from 'components/tg';
import { useThemeMode, focusRing } from 'lib/theme-context';
import { typography } from 'lib/typography';
// Tamagui bridge primitives (auto-fallback to RN until configured)

type Edge = 'top'|'bottom'|'left'|'right';
export const Screen: React.FC<{ children: any; style?: any; edges?: Edge[] }> = ({ children, style, edges = ['bottom'] }) => {
  const flat = StyleSheet.flatten(style) || {};
  const bg = (flat as any).backgroundColor ?? 'transparent';
  // Eliminados logs de mount/unmount Screen
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={edges}>
      <TgYStack p="$2" gap="$2"
        style={[
          {
            flex: 1,
          },
          style,
        ]}
      >
        {children}
      </TgYStack>
    </SafeAreaView>
  );
};

export const Card: React.FC<{
  children: any;
  style?: any;
  onPress?: () => void;
  variant?: 'soft' | 'solid' | 'elevated' | 'glass';
  gradientBorder?: boolean; // borde 1px con gradiente brandSoft
}> = ({ children, style, onPress, variant = 'soft', gradientBorder }) => {
  const { theme } = useThemeMode();
  const radius = theme.radii.lg;
  const baseStyle = {
    borderRadius: radius,
    backgroundColor: theme.colors.card,
    // En modo claro eliminamos el borde para evitar el look "cuadrado";
    // en modo oscuro mantenemos 1px para contraste sutil.
    borderWidth: gradientBorder ? 0 : (theme.mode === 'dark' ? 1 : 0),
    borderColor: gradientBorder ? 'transparent' : theme.colors.border,
  } as const;

  const variantStyle = (() => {
    switch (variant) {
      case 'soft':
        return theme.elevation?.[1] || {};
      case 'elevated':
        return theme.elevation?.[2] || {};
      case 'glass':
        return {
          backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
          borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
          borderWidth: gradientBorder ? 0 : 1,
        } as any;
      case 'solid':
      default:
        return {};
    }
  })();

  const renderInner = (pressable: boolean) => {
    if (pressable) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => ([
            baseStyle,
            { paddingHorizontal: theme.spacing(2), paddingVertical: theme.spacing(2)+2, overflow: 'hidden' },
            variantStyle,
            { transform: [{ scale: pressed ? 0.99 : 1 }] },
            style,
          ])}
        >
          {children}
        </Pressable>
      );
    }
    return (
      <TgYStack p="$2" br="$lg" bg="$card" borderColor={gradientBorder ? 'transparent' : '$border'} style={[baseStyle as any, variantStyle, { paddingHorizontal: theme.spacing(2), paddingVertical: theme.spacing(2)+2 }, style]}>
        {children}
      </TgYStack>
    );
  };

  if (gradientBorder) {
    return (
      <LinearGradient
        colors={(theme.gradients?.brandSoft as [string, string]) || (theme.gradients?.brand as [string, string])}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: radius + 1, padding: 1 }}
      >
        <View style={{ borderRadius: radius, overflow: 'hidden' }}>
          {renderInner(!!onPress)}
        </View>
      </LinearGradient>
    );
  }
  return renderInner(!!onPress);
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
  const { theme } = useThemeMode();
  const isDark = theme.mode === 'dark';
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const flatPressBg = pressed ? (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6') : 'transparent';
  const baseBg = variant === 'primary'
    ? (gradient ? 'transparent' : theme.colors.primary)
    : variant === 'danger'
    ? theme.colors.danger
    : (variant === 'outline' || variant === 'ghost')
    ? flatPressBg
    : 'transparent';
  const color = disabled
    ? (variant === 'primary' ? theme.colors.text : (variant === 'danger' ? theme.colors.white : theme.colors.textDim))
    : (variant === 'primary' ? theme.colors.primaryText : (variant === 'danger' ? theme.colors.white : theme.colors.text));
  const borderColor = variant === 'ghost' ? 'transparent' : (variant === 'outline' ? theme.colors.border : 'transparent');
  const ring = focused ? focusRing(theme.mode) : null;
  const scale = pressed ? 0.97 : 1;
  const padV = size === 'lg' ? 18 : 12;
  const padH = size === 'lg' ? 20 : 16;
  const radius = size === 'lg' ? Math.max(theme.radius, 28) : theme.radius;
  const textStyle = size === 'lg'
    ? { ...typography.scale.bodyBold, fontSize: 18, lineHeight: 22 }
    : { ...(typography.scale.bodyBold) };
  // Use TgButton (Tamagui) which will auto-fallback to RN.Pressable via bridge until configured
  return (
    <TgButton
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
          backgroundColor: disabled ? (isDark ? '#3a3f47' : '#E5E7EB') : baseBg,
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
      <TgText style={{ textAlign: 'center', color, ...textStyle }}>{title}</TgText>
    </TgButton>
  );
};

// Stable, memoized RN TextInput to avoid re-mounts on parent re-renders
const BaseTextInput = React.memo(
  React.forwardRef<RNTextInput, any>(function BaseTextInput(props, ref) {
    return <RNTextInput ref={ref} {...props} />;
  }),
  (prev, next) => {
    // Re-render only on actual relevant prop changes
    return (
      prev.value === next.value &&
      prev.placeholder === next.placeholder &&
      prev.secureTextEntry === next.secureTextEntry &&
      prev.keyboardType === next.keyboardType &&
      prev.autoCapitalize === next.autoCapitalize &&
      prev.multiline === next.multiline &&
      prev.editable === next.editable &&
      prev.style === next.style
    );
  }
);

export const TextInput: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: any;
  debugId?: string;
}> = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  style,
  debugId,
}) => {
  const { theme } = useThemeMode();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<RNTextInput>(null);
  const lastTypeAtRef = useRef<number>(0);
  // Eliminados todos los logs de '[TI ...]' y '[UI ...]'
  const id = useMemo(() => debugId || `ti-${Math.random().toString(36).slice(2,8)}`,[debugId]);

  const baseStyle = {
    color: theme.mode === 'dark' ? '#E6EAF2' : theme.colors.text,
    backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.14)' : theme.colors.border,
    borderRadius: theme.radius,
    padding: 14,
    minHeight: multiline ? 100 : undefined,
  } as const;
  const inputStyle = useMemo(() => [
    baseStyle,
    focused ? { borderColor: theme.colors.focus } : null,
    style,
  ], [baseStyle, focused, style]);

  return (
    <BaseTextInput
      ref={inputRef}
      value={value}
  onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.mode === 'dark' ? '#A3AEC2' : '#8B92A3'}
      multiline={multiline}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      blurOnSubmit={multiline ? false : undefined}
      underlineColorAndroid="transparent"
      style={inputStyle}
      onFocus={() => { setFocused(true); }}
      onBlur={() => {
        setFocused(false);
        const delta = Date.now() - (lastTypeAtRef.current || 0);
        if (delta < 800) {
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }}
    />
  );
};

export const H1: React.FC<{ children: any; style?: any }> = ({ children, style }) => (
  ((): React.ReactElement => { const { theme } = useThemeMode(); return <TgText style={[{ color: theme.colors.text, includeFontPadding: true, paddingVertical: 1 }, typography.scale.h1, style]}>{children}</TgText>; })()
);

export const P: React.FC<{ children: any; style?: any; bold?: boolean; dim?: boolean }> = ({ children, style, bold, dim }) => (
  ((): React.ReactElement => { const { theme } = useThemeMode(); return <TgText style={[
    dim ? { color: theme.colors.textDim } : { color: theme.colors.subtext },
    { includeFontPadding: true, paddingVertical: 1 },
    bold ? typography.scale.bodyBold : typography.scale.body,
    style
  ]}>{children}</TgText>; })()
);

export const Switch: React.FC<{ value: boolean; onValueChange: (v: boolean) => void; style?: any; disabled?: boolean }> = ({ value, onValueChange, style, disabled }) => (
  ((): React.ReactElement => { const { theme } = useThemeMode(); return <RNSwitch
    value={value}
    onValueChange={onValueChange}
    trackColor={{ false: '#475569', true: theme.colors.primary }}
    thumbColor={value ? '#fff' : '#cbd5e1'}
    disabled={disabled}
    style={style}
  />; })()
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

// Progress bar superior con gradiente brand
export const ProgressBar: React.FC<{ progress: number; style?: any }> = ({ progress, style }) => (
  ((): React.ReactElement => { const { theme } = useThemeMode(); return (
    <TgYStack br="$pill" bg="$border" style={[{ height: 4, overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={theme.gradients.brand as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, height: '100%' }}
      />
    </TgYStack>
  ); })()
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
  const { theme } = useThemeMode();
  const baseInner = (
    <Pressable
      onPress={onPress}
      style={[
        {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: theme.radii.lg,
          borderWidth: active ? (activeBorderGradient ? 0 : 2) : 1,
          borderColor: active ? (activeBorderGradient ? 'transparent' : theme.colors.primary) : theme.colors.border,
          backgroundColor: active ? ((theme.colors as any).surfaceMuted || theme.colors.card) : theme.colors.card,
        },
        leftAccentOnActive && active ? { borderLeftWidth: 3, borderLeftColor: theme.colors.primary } : null,
        style,
      ]}
    >
      <TgXStack style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <TgXStack gap="$1.5" style={{ alignItems: 'center', flexShrink: 1 }}>
          {iconLeft ? <TgYStack style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>{iconLeft}</TgYStack> : null}
          <TgText style={[
            typography.scale.body,
            { color: theme.colors.text, fontWeight: active ? '700' as any : undefined }
          ]} numberOfLines={2}>{label}</TgText>
        </TgXStack>
        {(() => {
          switch (indicator) {
            case 'radio':
              return (
                <TgYStack style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <TgYStack borderColor={active ? '$primary' : '$border'} style={{ width: 20, height: 20, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <TgYStack bg="$primary" style={{ width: 10, height: 10, borderRadius: 999 }} /> : null}
                  </TgYStack>
                </TgYStack>
              );
            case 'check':
              return (
                <TgYStack borderColor={active ? '$primary' : '$border'} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, backgroundColor: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#fff') : 'transparent' }}>
                  <TgText style={{ color: active ? theme.colors.primary : theme.colors.textDim, ...typography.scale.caption }}>{active ? '✓' : ' '}</TgText>
                </TgYStack>
              );
            case 'chevron':
              return (<TgText style={{ color: theme.colors.textDim, fontSize: 18, marginLeft: 8 }}>›</TgText>);
            case 'left-accent':
            case 'none':
            default:
              return null;
          }
        })()}
      </TgXStack>
    </Pressable>
  );

  if (active && activeBorderGradient) {
    return (
      <LinearGradient colors={theme.gradients.brand as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: theme.radii.lg, padding: 1 }}>
        <View style={{ borderRadius: theme.radii.lg, overflow: 'hidden' }}>{baseInner}</View>
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
  size?: 'md'|'lg';
}> = ({ title, onPress, disabled, style, size = 'lg' }) => {
  const { theme } = useThemeMode();
  return (
    <TgYStack p="$2" style={[{ backgroundColor: theme.colors.bg }, style]}>
      <Button title={title} onPress={onPress} disabled={disabled} size={size} style={{ width: '100%' }} />
    </TgYStack>
  );
};

// Footer fijo con dos o más acciones apiladas (full-width)
export const StickyFooterActions: React.FC<{
  actions: Array<{ title: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'outline'; disabled?: boolean; gradientColors?: [string, string] }>;
  style?: any;
  note?: React.ReactNode;
}> = ({ actions, style, note }) => {
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'transparent' }}>
      <TgYStack px="$2" pt="$1" pb="$1" style={[{ backgroundColor: 'transparent' }, style]}>
        {note ? <View style={{ marginBottom: 8 }}>{note}</View> : null}
        <TgYStack gap="$1">
          {actions.map((a, i) => (
            <Button key={i} title={a.title} onPress={a.onPress} variant={a.variant} disabled={a.disabled} style={{ width: '100%' }} size="lg" gradientColors={a.gradientColors} />
          ))}
        </TgYStack>
      </TgYStack>
    </SafeAreaView>
  );
};

// Chip compacto para estados (denegado/bloqueado)
export const Chip: React.FC<{ label: string; tone?: 'neutral' | 'danger'; style?: any }>= ({ label, tone = 'neutral', style }) => (
  ((): React.ReactElement => { const { theme } = useThemeMode(); return (
    <TgYStack p="$0.5" px="$1" br="$pill" borderColor={tone === 'danger' ? '$primary' : '$border'} style={[{ borderWidth: 1, backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFF' }, style]}>
      <TgText style={{ color: tone === 'danger' ? theme.colors.primary : theme.colors.textDim, ...typography.scale.caption }}>
        {label}
      </TgText>
    </TgYStack>
  ); })()
);

// Simple divider line
export const Divider: React.FC<{ style?: any }> = ({ style }) => (
  ((): React.ReactElement => { const { theme } = useThemeMode(); return <View style={[{ height: 1, backgroundColor: theme.colors.border }, style]} />; })()
);

// Full-screen uploading overlay modal
export const UploadOverlayModal: React.FC<{
  visible: boolean;
  title?: string;
  subtitle?: string | React.ReactNode;
}> = ({ visible, title = 'Subiendo fotos…', subtitle }) => (
  ((): React.ReactElement => { const { theme } = useThemeMode(); return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <TgYStack ai="center" jc="center" style={stylesUpload.overlay}>
        <TgYStack p="$2" br="$lg" bg="$bg" borderColor="$border" style={[stylesUpload.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.bg }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <H1 style={{ fontSize: 18, marginTop: 12 }}>{title}</H1>
          {subtitle ? (
            typeof subtitle === 'string' ? (
              <P style={{ color: theme.colors.textDim, marginTop: 4 }}>{subtitle}</P>
            ) : (
              subtitle
            )
          ) : null}
        </TgYStack>
      </TgYStack>
    </Modal>
  ); })()
);

const stylesUpload = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '80%', maxWidth: 360, borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1 },
});
