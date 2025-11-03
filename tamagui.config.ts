import { config as base } from '@tamagui/config/v3'
import { createTamagui } from 'tamagui'

import { theme as appTheme } from './lib/theme'

// Extend the base v3 config with our app tokens and brand themes.
// Keep it incremental: we add only what we need now (space, radius, and semantic colors)
const space = {
  // 4px scale to align with our theme.spacing(1) = 8; we keep half-steps too
  0: 0,
  0.5: 4,
  1: 8,
  1.5: 12,
  2: 16,
  2.5: 20,
  3: 24,
  4: 32,
} as const

const radius = {
  0: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const

// Semantic color tokens used by our components
const color = {
  bg: appTheme.lightColors.bg,
  bgAlt: appTheme.lightColors.bgAlt,
  card: appTheme.lightColors.card,
  cardAlt: appTheme.lightColors.cardAlt,
  border: appTheme.lightColors.border,
  divider: (appTheme.lightColors as any).divider || appTheme.lightColors.border,
  surface: (appTheme.lightColors as any).surface || appTheme.lightColors.card,
  surfaceMuted: (appTheme.lightColors as any).surfaceMuted || appTheme.lightColors.cardAlt || appTheme.lightColors.card,
  text: appTheme.lightColors.text,
  subtext: appTheme.lightColors.subtext,
  textDim: appTheme.lightColors.textDim,
  primary: appTheme.lightColors.primary,
  primaryText: appTheme.lightColors.primaryText,
  focus: (appTheme.lightColors as any).focus || '#4C9AFF',
  danger: (appTheme.lightColors as any).danger || '#EF4444',
  white: '#FFFFFF',
} as const

const colorDark = {
  bg: appTheme.darkColors.bg,
  bgAlt: appTheme.darkColors.bgAlt,
  card: appTheme.darkColors.card,
  cardAlt: appTheme.darkColors.cardAlt,
  border: appTheme.darkColors.border,
  divider: (appTheme.darkColors as any).divider || appTheme.darkColors.border,
  surface: (appTheme.darkColors as any).surface || appTheme.darkColors.card,
  surfaceMuted: (appTheme.darkColors as any).surfaceMuted || appTheme.darkColors.cardAlt || appTheme.darkColors.card,
  text: appTheme.darkColors.text,
  subtext: appTheme.darkColors.subtext,
  textDim: appTheme.darkColors.textDim,
  primary: appTheme.darkColors.primary,
  primaryText: appTheme.darkColors.primaryText,
  focus: (appTheme.darkColors as any).focus || '#4C9AFF',
  danger: (appTheme.darkColors as any).danger || '#EF4444',
  white: '#FFFFFF',
} as const

export const tamaguiConfig = createTamagui({
  ...base,
  tokens: {
    ...base.tokens,
    space: { ...(base.tokens?.space as any), ...space },
    radius: { ...(base.tokens?.radius as any), ...radius },
    color: { ...(base.tokens?.color as any), ...color },
  },
  themes: {
    ...base.themes,
    light: {
      ...(base.themes as any)?.light,
      ...color,
    },
    dark: {
      ...(base.themes as any)?.dark,
      ...colorDark,
    },
  },
})

export default tamaguiConfig

// Inform TypeScript of our Tamagui config shape
declare module 'tamagui' {
  interface TamaguiCustomConfig extends ReturnType<typeof createTamagui> {}
}
