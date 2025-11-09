# Avatar & photo refresh behavior

This app stores profile avatars in `profiles.avatar_url` and the gallery in `user_photos (url, sort_order)`.

# Avatar y refresco de fotos (Invariante sort_order = 0)

Desde 2025-11-08 aplicamos una invariante en backend: el `avatar_url` del perfil siempre es la URL de la foto con `sort_order = 0` en `user_photos` (o `NULL` si no hay fotos).

## Cambios en Base de Datos

- Se añadió la función `public.maintain_profile_avatar_from_photos()` y los triggers `AFTER INSERT/UPDATE/DELETE` sobre `public.user_photos` que:
  - Tras cada alta/edición/borrado de foto, buscan la foto con menor `sort_order` y actualizan `profiles.avatar_url`.
  - En UPDATE, cubre cambios de `url`, de `sort_order` y de `user_id`.
- Se eliminó el trigger antiguo `trg_set_avatar_on_first_photo` (solo INSERT) para evitar reglas en conflicto.
- Se ejecutó un backfill para alinear datos existentes: 
  - Perfiles con fotos: se estableció `avatar_url` a la foto con menor `sort_order` si difería.
  - Perfiles sin fotos: se dejó `avatar_url = NULL`.

## Cambios en Frontend (optimismo de caché)

- Al eliminar una foto (`removePhoto`), la caché de React Query recalcula `avatar_url` localmente a partir de la foto con menor `sort_order` restante.
- Al reordenar (`reorderPhotos`), la caché actualiza `avatar_url` para que coincida con la nueva foto de `sort_order = 0`.
- En añadir y reemplazar fotos, el cliente NO escribe `profiles.avatar_url` directamente. Los triggers del servidor mantienen el valor correcto cuando corresponda (especialmente si la foto afectada es la top).
- El servidor es la fuente de verdad; las mutaciones optimistas son solo para evitar parpadeos de UI hasta que lleguen los refetch.

## Flujos y resultados esperados

1) Añadir primera foto:
	- BD: la nueva foto tendrá `sort_order` (normalmente 0 si estaba vacío). El trigger fija `avatar_url` a esa URL.
	- UI: muestra el avatar nuevo inmediatamente.

2) Añadir más fotos (no primera):
	- BD: el trigger mantiene el avatar (sigue siendo la de `sort_order = 0`).
	- UI: sin cambios en avatar salvo que la nueva tome `sort_order = 0` explícitamente (no habitual en alta).

3) Reemplazar la foto avatar (cambia `url`):
	- BD: el trigger detecta UPDATE y, al seguir siendo la foto top, actualiza `avatar_url` a la nueva URL.
	- UI: el avatar cambia a la nueva URL (optimista + refetch).

4) Reordenar fotos (drag & drop):
	- BD: tras los UPDATE de `sort_order`, el trigger deja `avatar_url` = URL de la foto ahora en `sort_order = 0`.
	- UI: se actualiza la caché optimista y, tras el refetch, queda consistente con servidor.

5) Eliminar la foto avatar:
	- BD: el trigger elige la siguiente foto con menor `sort_order` y actualiza `avatar_url` (o `NULL` si no quedan fotos).
	- UI: la caché optimista ya aplica la misma regla, evitando ver el avatar antiguo.

## Notas

- Las RPC enriquecidas (`classic_candidates_cards_with_photos`, `event_candidates_cards_with_photos`) entregan directamente las fotos ordenadas (array jsonb con `id`, `url`, `sort_order`) además del avatar calculado, eliminando la necesidad de la llamada `profile_photos_bulk`. El cliente ya no hace fallback: asumimos su disponibilidad en todos los entornos desplegados. Si una RPC fallara se retorna página vacía y se registra el error.
- El sistema de subida genera claves únicas (URLs nuevas), así que no dependemos de invalidación CDN para ver el cambio.
- Si en el futuro se quisiera un botón "Establecer como avatar" independiente del orden, habría que desactivar la invariante o resolver conflictos (preferimos mantener una única fuente de verdad: el orden).

## Utilidad de cliente: `computeNextAvatar(photos)`

Para mantener la UI en sincronía con la invariante durante cambios optimistas, usamos `computeNextAvatar(photos)` (determinista):

- Selecciona la foto con menor `sort_order`.
- Desempata por `id` para evitar flicker.
- Devuelve su `url` o `null` si no hay fotos.

Se usa en `removePhoto` y `reorderPhotos` para calcular el `avatar_url` de la caché mientras el servidor aplica los triggers.

Última actualización: 2025-11-08
- When replacing a specific photo, if that photo was the current avatar, `profiles.avatar_url` is now updated to the new URL immediately. The local React Query cache is also updated so the small avatar changes instantly on the owner profile.
- The Classic swipe deck now subscribes to realtime updates on `user_photos` and `profiles` and will refetch when a photo or the avatar changes. That means others see updated photos/avatars promptly while they have the screen open.

Notes and tips:
- Uploaded objects use unique timestamp-based paths, so CDN caches don’t hold onto old content. No manual cache busting query params are needed.
- Owner views already invalidate and reconcile `['profile:full', id]` queries on photo mutations, so the UI updates without a full reload.
- Realtime subscriptions are broad (UPDATE events) and lightweight; if needed they can be narrowed later to only the current deck’s user IDs.
