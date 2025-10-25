import React from 'react'
import { StyleSheet, View } from 'react-native'
import { YStack } from '@tamagui/stacks'
import { useThemeMode } from '../../lib/theme-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'

type Props = { variant?: 'brand' | 'sub' }

// Header background that visually blends with the screen using Tamagui tokens
export function BlendHeaderBackground({ variant = 'brand' }: Props) {
  const { theme, mode } = useThemeMode() as any
  const bg = theme.colors.bg
  const tintTop = bg
  const tintBottom = variant === 'brand' ? theme.colors.bgAlt : bg

  return (
    <YStack style={StyleSheet.absoluteFill as any}>
      {/* In dark mode add blur for a glass effect; in light avoid whitewashing */}
      {mode === 'dark' ? (
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      {/* Base tint matching background */}
      <LinearGradient
        colors={[tintTop, tintBottom] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Light brand glaze only on light mode to avoid pure white look */}
      {mode !== 'dark' ? (
        <LinearGradient
          colors={[theme.gradients.brandSoft?.[0] || 'transparent', theme.gradients.brandSoft?.[1] || 'transparent'] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/* subtle divider */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border,
          opacity: 0.6,
        }}
      />
    </YStack>
  )
}

export default BlendHeaderBackground
