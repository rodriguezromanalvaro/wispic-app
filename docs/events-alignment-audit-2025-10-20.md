# Eventos: alineación Owner ↔ Usuario (2025-10-20)

Este documento mapea de extremo a extremo los datos y pantallas de eventos para detectar desalineaciones entre lo que:
- se pide al Owner al crear/publicar
- se muestra al Usuario final
- aportan los Usuarios (asistencia/likes) y lo que ve el Owner

Incluye recomendaciones concretas de ajuste.

## 1) Modelo de datos relevante (DB)

Tabla `events` (campos principales usados):
- id, title (req), description (opt), start_at (req)
- venue_id (FK), city_id (FK)
- cover_url (opt)
- status ('draft'|'published'), published_at
- is_free (opt), price_cents (opt), currency (def 'EUR')
- is_sponsored, sponsored_until, sponsored_priority (no UI de owner ahora)
- series_id (opt)

Relacionadas:
- `event_attendance` (event_id, user_id, status: 'going'|'interested', created_at)
- `event_series` (id, venue_id, title, ...)
- `venues` (id, name, venue_type, city_id, ...)

Notas:
- Existen `event_occurrences`/`event_rsvps` pero la app principal usa `events` + `event_attendance` (única fecha `start_at`).

## 2) Owner: formulario de creación (app/(owner)/events.tsx)
Campos solicitados/derivados hoy:
- Título (obligatorio)
- Fecha y hora (obligatorio) → `start_at`
- Descripción (opcional) → `description`
- Portada (opcional) → `cover_url`
- Entrada: Gratis / Precio (€) → `is_free`, `price_cents`, `currency='EUR'`
- Local (venue) → derivado del `venue_staff` del owner; rellena `venue_id` y `city_id`
- Estado: Borrador/Publicar → `status`, `published_at`

No se piden hoy (existen en modelo o útiles de UX):
- Detalle de precios (moneda configurable), aforo/capacidad, política de edad, géneros musicales/tags, dress code, URL de tickets, hora de cierre (`end_at`), series/recurrencia, patrocinio.

## 3) Usuario final: lo que se muestra hoy
Listados y tarjetas (app/(tabs)/events/index.tsx, components/events/*):
- Título, fecha/hora (`start_at`), local (nombre), ciudad, tipo de local (badge), destacado (sponsor badge)
- Botón Voy/Dejar de ir (toggle `event_attendance`)
- Contador de asistentes + muestra de avatares (hasta 5) y sheet de asistentes (nombre/avatares)

No se muestra hoy (aunque el Owner lo puede rellenar):
- Descripción del evento
- Portada/imagen
- Precio/si es gratis

No hay pantalla de detalle de evento para Usuario (onOpen está desactivado).

## 4) Datos que aportan Usuarios y visibilidad para Owner
Usuarios aportan:
- Asistencia (`event_attendance` = going/interested)
- Perfil (avatar, display_name, edad calculada, género, interested_in, seeking)
- Decisiones sociales (likes/superlikes/passes) por persona (no por evento a efectos del feed)

Owner ve hoy (app/(owner)/home.tsx):
- Confirmados (conteo going), delta 24h
- Recaudación estimada (price_cents × going)
- Cuenta atrás al inicio
- Avatares recientes (muestra pequeña)
- Serie de RSVPs 7 días

No ve hoy (pero podría ser valioso en agregado):
- Distribución de género/edad/intereses de asistentes
- Lista completa de asistentes (sólo muestra 8 recientes)
- Interesados (status='interested')

## 5) Desalineaciones detectadas
1) Owner introduce descripción y portada, pero el Usuario no las ve en ninguna parte.
2) Owner define gratis/precio, pero el Usuario no ve ni el precio ni la etiqueta "Gratis".
3) No hay detalle de evento para Usuario; la tarjeta limita el contenido y no hay CTA adicional (tickets, etc.).
4) Existen campos de patrocinio/serie en modelo que no se gestionan desde UI de Owner.
5) Usuarios ven la lista de asistentes (sheet) pero Owner no tiene una vista equivalente completa (sólo sample), ni agregados demográficos.
6) Inconsistencia conceptual: existen `event_occurrences`/`event_rsvps`, pero el flujo actual opera con `events` + `event_attendance`. Esto puede confundir a futuro.

## 6) Recomendaciones (priorizadas)

Prioridad Alta (impacto directo en UX):
- A1. Mostrar precio/"Gratis" en `EventCard` y `LocalCard` (píldora junto a fecha o bajo título). No requiere nueva ruta.
- A2. Añadir una hoja/modal de "Detalle del evento" al pulsar tarjeta (onOpen): título, fecha/hora, local/ciudad, descripción, portada (si existe), precio/Gratis, botón Voy/Dejar de ir y botón "Ver asistentes".
- A3. En Owner Home, añadir toggle/selector para ver también `interested` además de `going` y reflejarlo en KPIs.

Prioridad Media (mejora producto/operativa):
- B1. Permitir URL de tickets opcional en creación de evento y mostrar botón "Conseguir entradas" en detalle de usuario.
- B2. Añadir métricas agregadas para Owner: distribución por edad (rangos), género, top intereses (top-5), sólo en agregado para privacidad.
- B3. Habilitar selección de Serie (opcional) al crear evento si el venue tiene `event_series` activas (o dejarlo para pantalla específica de series).

Prioridad Baja / Futuras extensiones:
- C1. `end_at` opcional para mejorar labels y ventanas de realtime.
- C2. Campos de curación: géneros musicales/tags (para filtros), dress code, política de edad. Sólo si aportan valor al descubrimiento.
- C3. Gestión de patrocinio desde Owner (si aplica negocio): is_sponsored/priority/ventana.

## 7) Cambios propuestos (concretos y acotados)

UI Usuario (rápidos):
- EventCard.tsx y LocalCard.tsx: añadir prop `priceLabel` calculada ("Gratis" | `12,00 €`), y renderizarla en una pill.
- app/(tabs)/events/index.tsx: al mapear items, incluir `is_free`/`price_cents` en la select o derivarlo vía `events` ya cargados si vienen; hoy no se seleccionan esos campos.
- Crear `EventDetailSheet.tsx` (modal sencillo) y usarlo en `onOpen` de EventCard/LocalCard.

UI Owner:
- home.tsx: KPI extra "Interesados" y filtro going/interested.

DB/API (sin migraciones, salvo ticket_url/end_at):
- Añadir columnas opcionales: `ticket_url text`, `end_at timestamptz NULL` (si se prioriza B1/C1). Si no, posponer.

## 8) Contratos rápidos (para implementación A1/A2)
- Input: evento con `{ id, title, start_at, venue {name, venue_type}, city, is_free, price_cents, cover_url, description }`.
- Output UI: tarjeta con badge de precio; sheet de detalle con portada+texto; toggle de asistencia.
- Errores: falta de permisos RLS en `event_attendance` (ya cubierto con RPC fallback), falta de `cover_url` → ocultar imagen.

## 9) Riesgos/Privacidad
- Lista de asistentes visible a usuarios finales: validar que es deseado; alternativa: limitar a sample/consent.
- Agregados demográficos para Owner sin exponer datos identificables.

## 10) Siguientes pasos sugeridos
1) Implementar A1 (precio/Gratis en tarjetas) y A2 (detalle modal) – quick wins sin migraciones.
2) Añadir `ticket_url` (B1) si es requisito de negocio.
3) Añadir agregados demográficos (B2) con consultas agregadas a `profiles` de asistentes.
4) Evaluar series/patrocinio en roadmap (B3/C3).

