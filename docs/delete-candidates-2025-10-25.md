# Delete candidates (review) — 2025-10-25

Scope: non-routing files only (we exclude `app/**` because Expo Router consumes them dynamically).
Verification method: static graph (madge/unimported) + global grep ensuring zero importers from `app/**`, `components/**`, `features/**`, `lib/**`.

Legend
- Risk Low: leaf module, no importers, not referenced in tests, not required by config.
- Risk Med: utility/data used by tests only or tied to feature flags; may be revived.

## components (UI)

Safe to remove (Risk Low)

 components/ProfilePreviewPane.tsx — replaced by features/profile/ui/ProfilePreviewPane.tsx (removed).
- components/GlassCard.tsx — used by features/profile/view/ProfileScreen.tsx.
- components/OnboardingHeader.tsx — used by app/(auth)/complete/*.
- components/events/EventCard.tsx — replaced by features/events/ui/EventCard.tsx; no importers remain.
- components/events/LocalCard.tsx — replaced by features/events/ui/LocalCard.tsx; no importers remain.
- components/events/AttendeesSheet.tsx — replaced by features/events/ui/AttendeesSheet.tsx; no importers remain.
- components/events/EventDetailSheet.tsx — replaced by features/events/ui/EventDetailSheet.tsx; no importers remain.

Further safe removals (Applied — 2025-10-25)
- components/design/SegmentedControl.tsx and components/design/index.ts — not imported anywhere; BlendHeaderBackground remains and is imported directly.
- components/location/CityPickerSheet.tsx — no imports left (replaced flows); only referenced in a comment.
- components/Badge.tsx — no references found.
 - components/Paywall.tsx — duplicate of features/premium/ui/Paywall.tsx (removed).
 - components/PaywallModal.tsx — duplicate of features/premium/ui/PaywallModal.tsx (pending removal; no references remain).

## lib (logic/utils)

Safe to remove (Risk Low)
- lib/auth-helpers.ts — no references found.
- lib/hooks/useEventDetail.ts — no references found.
- lib/stores/eventSheet.ts — no references found.
- lib/userPrefs.ts — no references found.
- lib/match.ts — no references found.
- lib/paywallStore.ts — not imported anywhere (PaywallModal defines its own `openPaywall`).
~ lib/premium.ts — moved to features/premium/model/premiumStore.ts (removed).
- lib/profileMappings.ts — moved to features/profile/model/mappings.ts (removed).
- lib/prompts.ts — no external references found.
- lib/storage.ts — no external references found.
- lib/supabase-owner.ts — replaced by features/owner/api/supabase.ts (removed).
- lib/superlikes.ts — no references found.
~ lib/completeProfileContext.tsx — moved to features/profile/model/completeProfileContext.tsx (removed from lib).
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

Further safe removals (Applied — 2025-10-25)
- lib/utils.ts — no references across the codebase.

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

---

Applied — 2025-10-25

- Deleted components (Risk Low): Avatar.tsx, ProfileAchievements.tsx, ProfileCompletion.tsx, ProfileNotificationSettings.tsx, ProfileNotifications.tsx, ProfilePhotos.tsx, ProfilePrompts.tsx, ProfileStats.tsx, ProfileCompletionBadge.tsx.
- Deleted lib (Risk Low): auth-helpers.ts, hooks/useEventDetail.ts, stores/eventSheet.ts, userPrefs.ts, match.ts, paywallStore.ts, premium.ts, profileMappings.ts, prompts.ts, storage.ts, supabase-owner.ts, superlikes.ts, hooks/useOwner.ts.
- Deleted features/profile UI set (Risk Med): view/ProfileScreen.tsx, components/**, components/sections/**, sheets/**.

Validation after deletions: Typecheck PASS, Lint PASS, Tests PASS.
