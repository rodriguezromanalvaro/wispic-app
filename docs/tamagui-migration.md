# Tamagui full migration (native + tokens + shorthands)

This guide upgrades our current minimal Tamagui setup to the full `tamagui` package so we can use tokens, shorthands (ai, jc, gap, space, etc.), and higher-level primitives (Button, Text, Card, etc.).

## 1) Install packages

Run these in PowerShell from the repo root:

```powershell
# Core meta + common primitives
npm i tamagui @tamagui/button @tamagui/text @tamagui/avatar @tamagui/shapes @tamagui/helpers

# (optional) extra components you may want later
# npm i @tamagui/switch @tamagui/slider @tamagui/tooltip @tamagui/separator
```

Notes:
- We already have `@tamagui/core`, `@tamagui/stacks` and the Babel plugin configured. Adding `tamagui` lets us import from a single entrypoint with fully typed shorthands.
- If EAS build caches dependencies, run a clean build.

## 2) Babel plugin (already prepped)

`babel.config.js` now includes `components: ['tamagui', ...]`, so you don’t need to change it again when we move imports.

## 3) Provider

You can keep the provider import as-is, or switch to `tamagui` for consistency:

```tsx
// app/_layout.tsx
-import { TamaguiProvider } from '@tamagui/core'
+import { TamaguiProvider } from 'tamagui'
```

This is optional; functionally equivalent.

## 4) Bridge module and imports

We import stacks via our bridge:

```tsx
import { YStack, XStack } from 'components/tg'
```

The bridge now auto-detects the meta package:

```ts
// components/tg.tsx (current)
// 1) Try to require('tamagui')
// 2) Fallback to require('@tamagui/stacks') if not installed yet
// Exports are typed as `any` during migration to avoid TS friction.
```

Action when you finish installing step (1): nothing else required. The bridge will start using `tamagui` automatically, enabling fully typed shorthands and tokens. If you want, you can later make the exports explicit:

```ts
// components/tg.tsx (optional follow-up)
export { YStack, XStack, Stack, Text, Button } from 'tamagui'
```

Keep the bridge import stable to avoid mass refactors. We can gradually adopt `Text`, `Button`, etc. as needed.

## 5) Tokens and shorthands

- Prefer shorthands:
  - `ai` (alignItems), `jc` (justifyContent), `fd` (flexDirection), `fg` (flexGrow), `px/py/p` (padding), `mx/my/m` (margin)
  - `gap` or `space` for spacing between children (use tokens)
- Prefer tokens over raw numbers: `gap="$2"`, `p="$3"`, colors like `$color1`, etc.
- Start by swapping small blocks (headers, rows) to shorthands and tokens. Keep styles otherwise the same.

Examples:

```tsx
// Before
<XStack style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  ...
</XStack>

// After (typed shorthands + tokens)
<XStack fd="row" ai="center" gap="$2">
  ...
</XStack>
```

```tsx
// Before
<YStack style={{ gap: 12, paddingHorizontal: 16 }}>
  ...
</YStack>

// After
<YStack gap="$3" px="$4">
  ...
</YStack>
```

## 6) Config and themes

We currently use `@tamagui/config/v3` as a base in `tamagui.config.ts`. Next steps:
- Define brand tokens (colors, space, radii) mirroring `lib/theme`.
- Add light/dark themes with your brand palette.
- Map semantic tokens (primary, bg, surface) to those values.

Keep this incremental—introduce tokens first where they clearly reduce style noise.

## 7) Rollout strategy

1. Install packages (step 1) and re-run the app.
2. Switch `components/tg.tsx` to re-export from `tamagui` (step 4).
3. Convert a few screens (Profile, Events, Feed) to use shorthands + tokens—small PRs, verify visuals.
4. Expand to shared components; consider replacing custom buttons/labels with Tamagui `Button`/`Text`.
5. Move common layout idioms to reusable Tamagui components (chips, badges, skeleton blocks).

## 8) Troubleshooting

- TS complains about shorthand props: ensure imports come from `tamagui` (not `@tamagui/stacks`).
- Platform issues: keep `react-native-reanimated/plugin` last in Babel config.
- If extraction causes issues on native, keep `disableExtraction: true` (current setting).

## 9) Suggested PR plan

- PR1: deps install + switch bridge to `tamagui` + Provider import (optional)
- PR2: Replace layout shorthands in Profile + Events (header rows + small blocks)
- PR3: Replace shorthands in Feed (skeletons, headers)
- PR4: Introduce tokens for spacing/colors; wire brand palette
- PR5: Replace common UI primitives with Tamagui Button/Text where safe
