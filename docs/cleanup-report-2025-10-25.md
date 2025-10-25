# Repo cleanup report — 2025-10-25

Snapshot created before cleanup:

- Branch: `backup/pre-cleanup-2025-10-25`
- Tag: `pre-cleanup-2025-10-25`

Both are pushed to GitHub.

## Summary

- Knip: flagged unused and unlisted dependencies; see details below.
- Unimported: reported 29 unused dependencies and 170 unimported files (many are Expo Router screens; treat with caution).
- ts-prune: produced many candidates including default exports — likely noisy with Expo Router; treat as advisory only.
- depcheck: flagged a subset of unused dependencies consistent with Knip.
- madge orphans: lists many `app/**` screens as orphans due to file-based routing — these are false positives and should be ignored or whitelisted.

## Knip

Unused dependencies (9):
- @tamagui/config
- @tamagui/text
- expo-apple-authentication
- expo-background-fetch
- expo-local-authentication
- expo-task-manager
- react-native-avoid-softinput
- react-native-maps
- tamagui

Unused devDependencies (5):
- @eslint/js
- @tamagui/babel-plugin
- eslint-config-prettier
- globals
- supabase

Unlisted dependencies (22) — add to package.json if truly used:
- expo-system-ui (app.config.ts)
- @expo/vector-icons (multiple files)
- @react-navigation/native (app/(tabs)/_layout.tsx, chat/index.tsx)

Duplicate exports (14): multiple default exports with the same name across files; review if intentional.

Config hints:
- Refine knip.json patterns or drop redundant entries; Expo Router and generated entry points can confuse static analysis.

## Unimported

- Unused dependencies (29):
  - @react-native-async-storage/async-storage, @react-native-community/datetimepicker, @tamagui/button, @tamagui/stacks, @tamagui/text, base64-arraybuffer, expo-apple-authentication, expo-auth-session, expo-background-fetch, expo-blur, expo-build-properties, expo-camera, expo-dev-client, expo-file-system, expo-haptics, expo-image-manipulator, expo-image-picker, expo-local-authentication, expo-location, expo-task-manager, expo-updates, expo-web-browser, react-native-avoid-softinput, react-native-confetti-cannon, react-native-draggable-flatlist, react-native-maps, react-native-svg, tamagui, uuid
- Unimported files (170): includes many `app/**` screens and layouts used by Expo Router — likely false positives; whitelist `app/**`.

## ts-prune

- Reported many default exports and symbols as unused. Due to dynamic routing and JSX runtime, treat this as advisory and cross-check before action.

## depcheck

Unused dependencies:
- @tamagui/text
- expo-apple-authentication
- expo-background-fetch
- expo-build-properties
- expo-dev-client
- expo-local-authentication
- expo-task-manager
- expo-updates
- react-native-avoid-softinput
- react-native-maps
- tamagui

Unused devDependencies:
- @eslint/js
- eslint-config-prettier
- globals
- supabase

## madge — orphans

Madge lists many files in `app/**` and some in `components/**`, `features/**` as orphans. For Expo Router, screens and layouts are not imported but still used at runtime. Proposed approach:
- Ignore `app/**` in orphan checks.
- Investigate orphans outside `app/**`: components and libs.

## Proposed next steps

1) Configure ignores so reports reflect our routing setup:
   - Knip: ignore `app/**`, `supabase/**`, `scripts/**`, and generated files.
   - Unimported: add `app/**` to ignorePatterns.
   - Madge: exclude `app/**` from orphans.
2) Run `npm run clean:imports` to auto-remove unused imports/vars.
3) Re-run `typecheck` and tests to validate.
4) Review dependency lists above; remove the obviously unused ones in a separate PR.
5) Optional: gradually enable `noUnusedLocals` and `noUnusedParameters` in tsconfig for stricter hygiene.

> Note: Do not delete `app/**` files purely based on orphan reports; Expo Router discovers them at runtime.
