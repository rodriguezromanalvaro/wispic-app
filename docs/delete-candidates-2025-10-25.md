# Delete candidates (review) — 2025-10-25

Scope: non-routing files only (we exclude `app/**` because Expo Router consumes them dynamically).
Verification method: static graph (madge/unimported) + global grep ensuring zero importers from `app/**`, `components/**`, `features/**`, `lib/**`.

Legend
- Risk Low: leaf module, no importers, not referenced in tests, not required by config.
- Risk Med: utility/data used by tests only or tied to feature flags; may be revived.

## components (UI)

Safe to remove (Risk Low)
- components/Avatar.tsx — no references found.
- components/ProfileAchievements.tsx — no references found.
- components/ProfileCompletion.tsx — no references found.
- components/ProfileNotificationSettings.tsx — no references found.
- components/ProfileNotifications.tsx — no references found.
- components/ProfilePhotos.tsx — no references found.
- components/ProfilePrompts.tsx — no references found.
- components/ProfileStats.tsx — no references found.
- components/ProfileCompletionBadge.tsx — only imported by ProfileNotifications (unused), so effectively unused.

Keep (in use)
- components/events/EventCard.tsx — used by app/(tabs)/events/index.tsx.
- components/events/LocalCard.tsx — used by app/(tabs)/events/index.tsx.
- components/GlassCard.tsx — used by features/profile/view/ProfileScreen.tsx.
- components/OnboardingHeader.tsx — used by app/(auth)/complete/*.
- components/OwnerBackground.tsx — used by owner auth/onboarding.
- components/PromptCard.tsx — used by app/(auth)/complete/prompts.tsx.
- components/SaveCongratsOverlay.tsx — used by app/(auth)/complete/bio|summary.
- components/Scaffold.tsx — used widely in auth and tabs screens.
- components/TopBar.tsx — used by events series page and legacy prev_events_index.tsx.
- components/AvatarStack.tsx — used by EventCard/LocalCard.

## lib (logic/utils)

Safe to remove (Risk Low)
- lib/auth-helpers.ts — no references found.
- lib/hooks/useEventDetail.ts — no references found.
- lib/stores/eventSheet.ts — no references found.
- lib/userPrefs.ts — no references found.
- lib/match.ts — no references found.
- lib/paywallStore.ts — not imported anywhere (PaywallModal defines its own `openPaywall`).
- lib/premium.ts — no references found.
- lib/profileMappings.ts — no external references found.
- lib/prompts.ts — no external references found.
- lib/storage.ts — no external references found.
- lib/supabase-owner.ts — no references found.
- lib/superlikes.ts — no references found.
- lib/completeProfileContext.tsx — no references found.
- lib/hooks/useOwner.ts — no references found.

Keep (in use)
- lib/feed/computeFeed.ts — used by __tests__/computeFeed.test.ts.
- lib/useRefetchOnFocus.ts — used by events screens and prev_events_index.tsx.
- lib/i18n.ts — imported in app/_layout.tsx (side-effect init).
- lib/notifications.ts — used by app/push-test.tsx.
- lib/push.ts — used by app/_layout.tsx (push registration).
- lib/theme.ts & lib/theme-context.tsx — used in app/_layout.tsx.
- lib/stores/eventsFilters.ts — used by events.
- lib/toast.tsx — used by app/_layout.tsx.

## features/profile — UI set not wired to routes (likely dead)

Observed: hooks in `features/profile/hooks/*` are used by profile screens (`app/profile/*`), but the view and UI components under `features/profile/components/**`, `features/profile/sheets/**`, and `features/profile/view/ProfileScreen.tsx` are not imported anywhere in `app/**`.

Safe to remove (Risk Med):
- features/profile/view/ProfileScreen.tsx
- features/profile/components/**/*
- features/profile/sheets/**/*
- features/profile/components/sections/**/*
- features/profile/prompts/promptTranslations.ts (only used inside the unused features components)

Keep:
- features/profile/hooks/useProfile.ts — used.
- features/profile/hooks/useProfileMutations.ts — used.
- features/profile/logic/privacy.ts — used by hooks.

## Recommendation

- Proceed to delete the files in the "Safe to remove" lists in a dedicated commit.
- After deletion: run `npm run typecheck`, `npm run lint`, and `npm run test` (already wired as tasks) and quick manual sanity (Events, Auth, Profile tabs).
- Optionally, move them first to `backups/attic-2025-10-25/` if you prefer a softer rollback than Git history.

If you approve, I can execute the deletions and push as part of this same branch.
