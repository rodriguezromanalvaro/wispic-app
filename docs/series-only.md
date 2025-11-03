# Series-only mode

Este proyecto usa un modelo "series -> events" donde:
- `event_series` define patrón semanal (días 0=Lun..6=Dom), horario local (start_time/end_time) y tzid.
- Se generan eventos futuros en `events` (no se usan `event_occurrences` en runtime).
- El feed agrupa por serie y muestra la siguiente occurrence (nextEv) y hasta 8 próximas.

## RPCs clave

- `create_or_update_series(p_series_id, p_venue_id, p_title, p_days, p_start_date, p_end_date, p_start_time, p_end_time, p_tzid, p_horizon_weeks, p_defaults)`
  - Crea/actualiza una serie y genera eventos para el horizonte indicado (semanas). Devuelve `series_id`.
  - Seguridad: SECURITY DEFINER; requiere que el caller sea owner/manager activo del `venue_id`.
  - `p_defaults` soporta: `status`, `cover_url`, `is_free`, `price_cents`, `currency`, `ticket_url`, `description`.

- `roll_series_forward(p_series_id, p_horizon_weeks, p_defaults)`
  - Genera eventos para los días configurados de la serie en el rango `hoy..hoy+N semanas`.
  - Evita duplicados por `(series_id, start_at)`.

## Conversión horaria

Los tiempos se interpretan como locales del `tzid` de la serie y se convierten a UTC en `events.start_at/ends_at`. Si `end_time <= start_time` se asume overnight (fin al día siguiente).

## Feed y UI

- `features/events/ui/EventsScreen.tsx` queda en modo series-only: se eliminó la rama de "eventos sueltos" y el selector de contenido.
- "Top de hoy" usa la siguiente occurrence (`nextEv`) de cada serie.

## Próximas limpiezas sugeridas

- Eliminar `features/events/ui/EventCard.tsx` y cualquier exportación si no quedan importadores.
- Marcar `event_occurrences` y vistas asociadas como deprecated si no se consumen.
- Mantener `events` con `series_id` como tabla runtime principal.
