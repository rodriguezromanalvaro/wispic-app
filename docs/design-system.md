# Design System Overview

This document summarizes the cohesive visual system (Option C) now applied across auth and profile screens.

## Tokens
- Colors: `theme.colors` extended with surface roles and gradient stops.
- Gradients: `theme.gradients` (brand, dark, vibrant).
- Radii: `theme.radii` (xs, sm, md, lg, pill).
- Elevation: `theme.elevation[1|2]` unified for shadow usage.
- Layout widths: `theme.layout.maxWidth`, `theme.layout.authWidth`.
- Typography: in `typography.scale` (h1, h2, h3, body, bodyBold, caption).

## Components
- `CenterScaffold`: base gradient wrapper with max-width containment.
- `GlassCard`: glass/tinted card with variants (tint/elevation/interactive).
- `ui.tsx` atoms: Screen, Card, Button, TextInput, H1, P updated to use tokens.

## Auth Alignment
`sign-in.tsx` and `sign-up.tsx` migrated to `CenterScaffold variant='auth'` for consistent gradient and spacing. Hardcoded gradients removed.

## Profile Alignment
Profile already uses glass cards; future improvement can replace `GradientScaffold` fully with `CenterScaffold variant='profile'` if desired for exact parity.

## Next Steps (Optional)
1. Add Button variants: secondary, outline, subtle.
2. Promote Input to its own file with states (focus/error/disabled) driven by a state machine.
3. Introduce theme switch (dark/light) with color semantic mapping.
4. Extract animations (stagger/fade) to a dedicated `motion` helper.
5. Add accessibility color contrast auditing script.

## Conventions
- Spacing: always via `theme.spacing(n)` rather than raw numbers.
- No direct hex codes in new components; prefer semantic color tokens.
- Reanimated animations should live in small wrappers (e.g. `<Appear />`).

## Migration Checklist
When creating a new screen:
1. Wrap in `Screen` then `CenterScaffold` if gradient needed.
2. Use `GlassCard` for elevated/sectioned content.
3. Use `H1/H2/P` from typography tokens.
4. Use `Button` variants instead of custom pressables.
5. Avoid inline hex colors—extend `theme` if a color is missing.

---
Last updated: Option C rollout.