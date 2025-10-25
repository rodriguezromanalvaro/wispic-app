import { createTamagui } from '@tamagui/core'
import { config } from '@tamagui/config/v3'

// Minimal Tamagui setup using the official v3 preset config.
// You can customize tokens/themes later to reflect the app brand.
export const tamaguiConfig = createTamagui(config)

export default tamaguiConfig

// Inform TypeScript of our Tamagui config shape
declare module '@tamagui/core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TamaguiCustomConfig extends ReturnType<typeof createTamagui> {}
}
