# Supabase: vincular proyecto y aplicar migraciones

Este doc explica, paso a paso y en simple, cómo dar permisos para operar contra Supabase y aplicar la migración actual.

## 1) ¿Dónde saco la contraseña de la base?

- Entra a Supabase Studio > Settings > Database > Connection string.
- Si ves una "URI" (postgres://usuario:contraseña@host:puerto/db):
  - Copia lo que esté entre `postgres://usuario:` y `@host` → eso es la contraseña.
- Si no aparece, pulsa "Reveal password".
- Consejo: genera un usuario con permisos limitados (staging o read-write acotado) para operar.

## 2) ¿Qué es staging vs prod? (explicado simple)

- Staging: una copia/entorno de pruebas. Si algo sale mal, no afecta a usuarios reales.
- Prod: tu base real en producción. Aquí viven los usuarios y datos reales.
- Recomendación: primero staging. Probamos cambios allí. Si todo bien, repetimos en prod.

## 2.1) ¿Qué URI uso? (Direct vs Poolers)

Supabase te ofrece 3 URIs. ¿Cuál elegir?

- Transaction Pooler (pgbouncer en modo transacción)
   - Para apps en producción: muchas conexiones concurrentes, bajo consumo.
   - Limitación: NO mantiene estado de sesión. Algunas migraciones/psql/ORMs fallan.
   - Úsalo para tráfico de API normal, no para tareas admin/migraciones.

- Session Pooler (pgbouncer en modo sesión)
   - Mantiene estado de sesión. Ideal para psql, migraciones y herramientas (CLI/ORMs) que necesitan varias sentencias en la misma sesión.
   - Recomendado para: ejecutar migraciones y consultas administrativas.

- Direct Connection (directo a Postgres)
   - Conexión “sin pooler”, con todas las capacidades de Postgres.
   - Útil cuando el pooler limita alguna operación. Menos conexiones disponibles; úsalo con cuidado para tareas puntuales.

Resumen: para migraciones/CLI, usa Session Pooler (preferido). Evita Transaction Pooler. Direct es alternativa si algo muy específico falla en el pooler.

## 3) ¿Aplicar la migración actual a remoto ya?

- "Aplicar ya" = ejecutar el SQL en `supabase/migrations/20251016_advisor_performance_batch9_targeted.sql` sobre la base remota.
- ¿Qué hace esa migración? Consolida políticas RLS permisivas en `public.cities` (SELECT) y `public.event_attendance` (INSERT/DELETE). Elimina políticas duplicadas y crea una por acción/grupo.
- Impacto: cambia políticas (DROP/CREATE). Hazlo primero en staging.

## 4) Pasos para vincular por CLI (una vez tienes Project Ref y contraseña)

1. Inicia sesión en CLI: obtén un Personal Access Token desde Supabase (Account > Access Tokens), y ejecuta:
   - `supabase login` (pega el token cuando lo pida).
2. Vincula el proyecto: 
   - `supabase link --project-ref rtiymjuzextgediacatg --password TU_CONTRASEÑA`
3. (Opcional) Validar conexión:
   - `supabase db pull` (descarga esquema para confirmar acceso).
4. Aplicar la migración actual (cuando des el OK):
   - `supabase db push` (empuja migraciones nuevas pendientes a la base remota).

## 5) Buenas prácticas

- No comitees contraseñas/keys. Usa variables de entorno en local.
- Usa staging para probar. En prod aplica en ventana controlada.
- Mantén el CLI actualizado regularmente.
