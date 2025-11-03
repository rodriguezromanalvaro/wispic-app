import { Text, Pressable } from 'react-native';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from 'lib/theme';


type Props = {
  title: string;
  onBack?: () => void;   // opcional: acción personalizada
  hideBack?: boolean;    // si true, no mostramos botón atrás
  mode?: 'solid' | 'overlay';
  avatarUrl?: string; // para colapso estilo apps top
  /** scrollY valor animado (Reanimated shared value) para sombreado gradual */
  scrollY?: { value: number }; // reanimated shared value shape (loosen type to avoid version mismatch)
  right?: React.ReactNode; // acción derecha
};

export default function TopBar({ title, onBack, hideBack = false, mode = 'solid', scrollY, avatarUrl, right }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const showBack = !hideBack; // 👈 por defecto mostramos atrás
  const handleBack = () => {
    if (onBack) return onBack();
    router.back();
  };

  // padding superior seguro (status bar / notch) + un pelín extra
  const topPad = Math.max(insets.top, 10);

  const animatedShadow = useAnimatedStyle(() => {
    const opacity = scrollY
      ? interpolate(scrollY.value, [0, 24, 60], [0, 0.5, 1], Extrapolate.CLAMP)
      : 0;
    return {
      shadowOpacity: mode === 'overlay' ? opacity * 0.25 : 0,
      elevation: mode === 'overlay' ? (opacity > 0.2 ? 3 : 0) : 0,
      borderBottomWidth: mode === 'overlay' ? 0 : 1,
    } as any;
  });

  const avatarStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0, width: 0 } as any;
    const show = interpolate(scrollY.value, [40, 110], [0, 1], Extrapolate.CLAMP);
    const scale = interpolate(scrollY.value, [40, 110], [0.6, 1], Extrapolate.CLAMP);
    return {
      opacity: show,
      transform: [{ scale }],
    } as any;
  });

  const isDark = theme.mode === 'dark';
  const baseBg = mode === 'overlay'
    ? 'rgba(11,15,23,0.55)'
    : theme.colors.bgAlt || theme.colors.bg;
  const borderColor = theme.colors.border;
  const iconColor = theme.colors.text;

  return (
    <Animated.View
      style={[{
        position: mode === 'overlay' ? 'absolute' : 'relative',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 30
      }, animatedShadow]}
    >
      {mode === 'overlay' && Platform.OS !== 'web' && (
        <BlurView intensity={45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      )}
      <View
        style={{
          paddingTop: topPad,
          paddingHorizontal: 12,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderColor,
          backgroundColor: baseBg,
          borderBottomWidth: mode === 'overlay' ? 0 : 1,
          ...(mode !== 'overlay' && isDark ? { shadowColor: '#4D7CFF', shadowOpacity:0.18, shadowRadius:14, shadowOffset:{width:0,height:2} } : {})
        }}
      >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor,
            backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={iconColor} />
        </Pressable>
      ) : (
        // reservamos hueco para centrar el título visualmente
        <View style={{ width: 36 }} />
      )}
      {avatarUrl && mode === 'overlay' && (
        <Animated.View style={[{ marginLeft: 4, marginRight: -4, width: 0 }, avatarStyle]}>
          <Image source={{ uri: avatarUrl }} style={{ width:32, height:32, borderRadius:16, borderWidth:1, borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.10)' }} />
        </Animated.View>
      )}
      <Text
        numberOfLines={1}
        style={{
          color: iconColor,
          fontWeight: '800',
          fontSize: 18,
          flex: 1,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {right ? (
        <View style={{ minWidth: 36, alignItems:'flex-end' }}>{right}</View>
      ) : (
        <View style={{ width: 36 }} />
      )}
      </View>
    </Animated.View>
  );
}
