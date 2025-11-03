// no default React import needed with modern JSX
import { StyleSheet, View } from 'react-native'

import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

import { YStack } from 'components/tg'
import { useThemeMode } from 'lib/theme-context'
import { theme as baseTheme } from 'lib/theme'

type Props = { variant?: 'brand' | 'sub' }

// Header background that visually blends with the screen using Tamagui tokens
export function BlendHeaderBackground({ variant = 'brand' }: Props) {
  // Use mode from context (for blur decisions) but read tokens directly from base theme,
  // which is updated by applyPalette, to avoid stale pink glows.
  const { mode } = useThemeMode() as any
  const t = baseTheme as any
  const bg = t.colors.bg
  const palette = t.currentPalette || 'magenta'
  const appBg: string[] | undefined = t.gradients?.appBg
  const tintTop = bg
  const tintBottom = variant === 'brand' ? t.colors.bgAlt : bg

  return (
    <YStack style={StyleSheet.absoluteFill as any}>
      {/* In dark mode add blur for a glass effect; in light avoid whitewashing */}
      {mode === 'dark' ? (
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      {/* Base tint matching background; for owner use appBg to keep subtle continuity */}
      {palette === 'owner' && appBg ? (
        <LinearGradient
          colors={(appBg.length >= 3 ? appBg.slice(0,3) : [appBg[0], appBg[1] || appBg[0], appBg[appBg.length-1] || appBg[0]]) as any}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={[tintTop, tintBottom] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Light brand glaze only on light mode to avoid pure white look */}
      {mode !== 'dark' ? (
        <>
          {/* soft glaze; slightly lighter for owner to avoid heavy hue shift */}
          <LinearGradient
            colors={[t.gradients.brandSoft?.[0] || 'transparent', t.gradients.brandSoft?.[1] || 'transparent'] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { opacity: palette === 'owner' ? 0.5 : 0.85 }]}
          />
          {/* subtle brand band only on brand variant, softer on owner */}
          {variant === 'brand' ? (
            <LinearGradient
              colors={[...(t.gradients.brand as [string, string])]} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { opacity: palette === 'owner' ? 0.04 : 0.14 }]}
            />
          ) : null}
        </>
      ) : null}
      {/* subtle divider */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: t.colors.border,
          opacity: 0.6,
        }}
      />
    </YStack>
  )
}

export default BlendHeaderBackground
