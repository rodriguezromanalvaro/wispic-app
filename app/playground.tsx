import { useThemeMode } from '../lib/theme-context'
import { Theme } from '@tamagui/core'
import { Button } from '@tamagui/button'
import { useState } from 'react'
import { Text as RNText, View } from 'react-native'

export default function Playground() {
  const { mode, setMode } = useThemeMode()
  const [count, setCount] = useState(0)

  const isDark = mode === 'dark'

  return (
    <Theme name={isDark ? 'dark' : 'light'}>
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <RNText style={{ fontSize: 22, fontWeight: '700' }}>UI Playground</RNText>
          <Button onPress={() => setMode(isDark ? 'light' : 'dark')}>
            {isDark ? 'Light' : 'Dark'}
          </Button>
        </View>

        <View style={{ marginBottom: 16 }}>
          <RNText style={{ opacity: 0.7, marginBottom: 8 }}>Buttons</RNText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button onPress={() => setCount((c) => c + 1)}>Primary ({count})</Button>
            <Button>Default</Button>
          </View>
        </View>

        <View>
          <RNText style={{ opacity: 0.7, marginBottom: 8 }}>Layout</RNText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#8ab4f8' }} />
            <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#bb86fc' }} />
            <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#34d399' }} />
          </View>
        </View>
      </View>
    </Theme>
  )
}
