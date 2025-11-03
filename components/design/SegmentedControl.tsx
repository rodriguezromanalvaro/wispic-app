// no default React import needed with modern JSX
import { View, Pressable, Text, StyleSheet } from 'react-native'

import { theme } from 'lib/theme'
import { typography } from 'lib/typography'

export type Segment<T extends string> = { id: T; label: string }

export function SegmentedControl<T extends string>({
  segments,
  selectedId,
  onChange,
  style,
}: {
  segments: Array<Segment<T>>
  selectedId: T
  onChange: (id: T) => void
  style?: any
}) {
  const radius = theme.radii.pill
  return (
    <View style={[styles.root, { borderRadius: radius, backgroundColor: theme.colors.card, borderColor: theme.colors.border }, style]}>
      {segments.map((s, idx) => {
        const active = s.id === selectedId
        return (
          <Pressable
            key={s.id}
            onPress={() => onChange(s.id)}
            style={({ pressed }) => [
              styles.item,
              idx === 0 && { borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
              idx === segments.length - 1 && { borderTopRightRadius: radius, borderBottomRightRadius: radius },
              active
                ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                : { backgroundColor: 'transparent', borderColor: 'transparent' },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={[{ ...typography.scale.caption, fontWeight: '700' as const }, { color: active ? theme.colors.white : theme.colors.text }]}>
              {s.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 2,
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginHorizontal: 2,
  },
})
