# Guía de arquitectura y organización

Esta guía explica cómo organizar el código para que cada pieza esté en "su sitio", evitando pantallas con lógica dispersa y componentes duplicados. Está pensada para Expo Router + React Native.

## Objetivos

- Co-locar lo que pertenece a una misma pantalla o feature.
- Separar UI genérica de UI específica de un feature.
- Evitar dependencias cruzadas y ciclos entre módulos.
- Facilitar refactors y reusabilidad.

## Estructura propuesta (alto nivel)

- `app/` (Expo Router)
  - Solo rutas, layouts y componentes específicos de cada pantalla.
  - Hooks/loader locales y pequeños helpers de pantalla.
  - Importa de `features/*`, `components/*` (UI compartida) y `lib/*` (servicios utilitarios).
- `features/<feature>/`
  - `ui/`: componentes de UI del feature.
  - `model/`: tipos, stores (zustand), lógica de dominio.
  - `api/`: clientes/llamadas a APIs (por ejemplo, Supabase) del feature.
  - `hooks/`: hooks del feature.
  - `lib/`: utilidades específicas del feature.
  - Índices tipo `index.ts` para export público del feature.
- `components/`
  - UI compartida, genérica, sin lógica de dominio.
  - No importa de `features/*`.
- `lib/`
  - Utilidades transversales: auth, storage, notificaciones, i18n bootstrap, tema, tipos globales finos.
  - No importa de `features/*` ni de `app/*`.
- `i18n/`
  - Fuentes de traducción (`*.json`). El setup vive en `lib/i18n.ts`.
- `types/`
  - Tipos globales muy compartidos (si no pertenecen a un feature concreto).
- `supabase/`
  - SQL, scripts, reports. Separado del código de app.

## Reglas de dependencias

- `app` → puede depender de `features`, `components`, `lib`.
- `features` → puede depender de `components` y `lib`, pero NO de `app` ni de otros `features` (salvo módulos públicos muy estables, p.ej. `entities`).
- `components` → NO puede depender de `features` ni de `app`.
- `lib` → NO puede depender de `features`, `components` ni `app`.

Sugerencia: exportar un API claro por feature (barrels `index.ts`) y consumir siempre a través de ahí.

## Co-locación práctica

- Si un componente solo lo usa una pantalla, colócalo junto a la pantalla (`app/<segment>/MiPantalla/LocalThing.tsx`).
- Si es reutilizable dentro del mismo feature → `features/<feature>/ui/`.
- Si es realmente genérico (sin dominio) → `components/`.
- Lógica de datos/estado nunca en `components/`: va a `features/*` o `lib/*`.

## Convenciones de nombres

- Carpetas: kebab-case o lowerCamelCase consistente (p. ej., `completeProfile` → `complete-profile` o `completeProfile`).
- Archivos UI: `PascalCase.tsx`. Lógica/servicios: `camelCase.ts`.
- Evita sufijos ruidosos (`SomethingComponent.tsx` → `Something.tsx`).

## Aliases y rutas de importación

- Ya existen aliases en `tsconfig.json`:
  - `app/*`, `features/*`, `components/*`, `lib/*`.
- Úsalos para evitar imports relativos largos.

## Herramientas de higiene

- Scripts ya disponibles:
  - `npm run analyze:knip` (símbolos no usados)
  - `npm run analyze:unimported` (archivos no importados)
  - `npm run analyze:madge:orphans` (huérfanos)
  - `npm run analyze:madge:circular` (ciclos entre módulos)
- Recomendado ejecutar antes/después de mover cosas.

## Sugerencias de reorganización (concretas a este repo)

- `components/`
  - Mover UI específica de negocio a su feature:
    - `OnboardingHeader`, `Paywall`, `PaywallModal` → `features/owner/ui/` o `features/premium/ui/` según encaje.
    - `SaveCongratsOverlay`, `ProfilePreviewPane`, `swipe/*` → `features/profile/ui/`.
    - `events/*` si es de feed/perfil → `features/profile/ui/` o `features/feed/ui/`.
  - Mantener aquí solo piezas genéricas como `GlassCard`, `AvatarStack`, `TopBar`, `ui.tsx` (si son agnósticas de dominio).

- `lib/`
  - Separar por responsabilidad si crece:
    - `supabase.ts`, `supabase-owner.ts` → `features/owner/api/` (o `lib/api/` si son cross-feature).
    - `useAuth.tsx` → `features/auth/hooks/` (si creamos feature de auth) o `lib/auth/useAuth.tsx`.
    - `completeProfileContext.tsx` → `features/profile/model/`.
    - `notifications.ts`, `push.ts` → `lib/notifications/`.
    - `theme.ts`, `typography.ts`, `toast.tsx` → `lib/ui/` o `components/` si es estrictamente UI.

- `app/`
  - Mantener pantallas limpias: vista + composición de features.
  - Los helpers que solo usa una pantalla, co-locados con la pantalla.

## Ejemplo de feature

```
features/
  profile/
    api/
      supabase.ts
    model/
      types.ts
      store.ts
    ui/
      ProfileCard.tsx
      SaveCongratsOverlay.tsx
      swipe/
        SwipeDeck.tsx
    hooks/
      useEditProfile.ts
    index.ts
```

`index.ts` re-exporta lo que el feature ofrece públicamente:

```ts
// features/profile/index.ts
export * from './ui/ProfileCard';
export * from './hooks/useEditProfile';
```

## Enforcing

Ya está configurado en ESLint:

- `eslint-plugin-import`
  - `import/order` (warn): orden, grupos y newline entre imports.
  - `import/no-cycle` (warn): ciclos import → detecta pronto acoplamientos.
- `eslint-plugin-boundaries`
  - `boundaries/no-unknown` (error): los paths deben encajar con `app/**`, `features/**`, `components/**`, `lib/**`.
  - `boundaries/element-types` (warn):
    - app → no puede importar de app.
    - feature → no puede importar de app ni de otros feature.
    - component → no puede importar de app ni de feature.
    - lib → no puede importar de app, feature ni component.

Los avisos se pueden subir a `error` cuando estabilicemos la migración.

Además, mantén `analyze:*` (madge/knip/unimported) para auditar huérfanos y ciclos fuera del linter.

## Plan de migración sugerido

1) Ejecuta `analyze:knip` y `analyze:unimported` para limpiar inertes.
2) Mueve UI de `components/` a `features/*/ui` cuando sea específica.
3) Mueve lógica de datos desde `app/*` a `features/*` o `lib/*`.
4) Re-exporta desde `features/*/index.ts` y actualiza imports.
5) Corre `analyze:madge:circular` y arregla ciclos si aparecen.
6) Documenta decisiones particulares en `docs/` si hay excepciones.

## FAQ rápido

- ¿Dónde va un hook que usa Supabase y estado de perfil? → `features/profile/hooks/` si es del dominio de perfil.
- ¿Y un botón "bonito" reutilizable? → `components/`.
- ¿Y un layout/stack/tab? → `app/`.
- ¿Y traducciones? → `i18n/*.json` y setup en `lib/i18n.ts`.

---

Si tienes dudas al mover algo, crea un `README.md` local en la carpeta del feature explicando el propósito y su API pública. Mejor dejar una nota que dejar una duda.
