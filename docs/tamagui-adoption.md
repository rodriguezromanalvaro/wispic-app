# Tamagui adoption (phase 1)

We already ship Tamagui and its config (see `tamagui.config.ts`). This doc outlines a safe, incremental plan to use Tamagui more broadly while keeping the app stable.

## Why Tamagui
- Consistent spacing/typography/layout primitives across native and web
- Token-driven theming and dark mode for free
- Performance-focused RN style system

## What’s available today
- Provider is wired in `app/_layout.tsx` via `TamaguiProvider` with our config in `lib/tamagui`.
- `@tamagui/stacks` is installed. Use Stacks for layout:
  - `YStack` (vertical), `XStack` (horizontal) with props like `space`, `ai` (alignItems), `jc` (justifyContent).
- Convenience re-exports live at `components/tg.tsx`:
  ```ts
  import { YStack, XStack } from 'components/tg'
  ```

## Phase 1 (this PR)
- Introduce `components/tg.tsx` to import Tamagui Stacks from one place.
- Keep existing UI components as-is. Prefer Stacks for new or touched layouts.

## Phase 2 (proposed, low-risk)
- Adopt Stacks in a few spots to simplify layout-only wrappers:
  - Profile: header row and benefits list
  - Events: card lists and section group spacing
  - Feed: day group containers
- No visual change expected, just cleaner layout code (`space`, `ai`, `jc` instead of nested `View` + custom styles).

## Phase 3 (optional)
- Add more Tamagui packages:
  - `@tamagui/button`, `@tamagui/card`, `@tamagui/separator`
  - Wrap them behind `components/tg.tsx` and gradually swap our custom Button/Card/Divider where it makes sense.

## Theme & tokens (later)
- Extend `tamagui.config.ts` tokens to mirror our `lib/theme` (spacing, radii, colors) for perfect alignment.
- Once tokens match, we can lean more on Tamagui variants (e.g., Button variants) without visual drift.

## Coding tips
- Prefer `space="$2"` over hardcoded gaps; it maps to theme tokens and scales better.
- Use `ai` and `jc` shorthands for alignment.
- Keep business logic and imperative code unchanged; Stacks are drop-in for `<View>` containers.
