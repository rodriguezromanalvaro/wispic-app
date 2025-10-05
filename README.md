# Wispic — Starter (archivos para pegar en tu proyecto Expo)

## ¿Qué es esto?
Un conjunto de **archivos base** para que arranques tu MVP con **Expo Router + Supabase**.
La idea es que crees un proyecto con la plantilla de Expo Router y **copies** estos archivos encima.

---

## 0) Requisitos
- Node.js LTS instalado (https://nodejs.org)
- App Expo Go en tu móvil (iOS/Android) o emulador
- Una cuenta de **Supabase** (https://supabase.com)

---

## 1) Crea el proyecto Expo (plantilla Router + TypeScript)

```bash
npx create-expo-app wispic-app -t expo-router --typescript
cd wispic-app
```

## 2) Instala dependencias del MVP
```bash
npm i @supabase/supabase-js @tanstack/react-query zustand expo-secure-store react-native-gesture-handler
```

> Si el proyecto te sugiere instalar pods en iOS o configurar Android, sigue las instrucciones que te muestre Expo/Metro en consola.

## 3) Copia estos archivos encima de tu proyecto
Descarga el ZIP, descomprímelo y **copia todo** dentro de tu carpeta `wispic-app`. Acepta reemplazar si te lo pide.
- Si tu editor te pregunta, **confirma** la fusión de carpetas `app/`, `lib/`, `components/`.

## 4) Configura tus claves de Supabase
Edita `app.config.ts` en tu proyecto y pon tus valores reales:
- `supabaseUrl`: URL de tu proyecto (empieza por https://xxxxx.supabase.co)
- `supabaseAnonKey`: clave pública ANON

> En Supabase: Project Settings → API.

## 5) Crea el esquema de base de datos
Entra en **Supabase Studio → SQL Editor** y pega la migración que te dejé en la conversación (tablas + RLS + trigger de matches).
Si no la tienes a mano, vuelve a pedírmela.

## 6) Arranca la app
```bash
npm start
```

- Escanea el QR con **Expo Go** en tu móvil o abre el simulador.
- Crea una cuenta con email/contraseña y rellena tu perfil.
- Crea **eventos de prueba** en Supabase (tabla `events`) y prueba el flujo "Voy", los likes y el chat.

> Si algo falla, copia el **texto del error** y te digo qué tocar.

---

## Configuración de Storage (fotos de usuario)

Variables de entorno importantes (añádelas en `app.config.ts` -> `extra` para que Expo las exponga con prefijo `EXPO_PUBLIC_`):

- `EXPO_PUBLIC_STORAGE_BUCKET`: (por defecto `user-photos`) Nombre del bucket público donde se suben las fotos de perfil.
- `EXPO_PUBLIC_DEBUG_UPLOADS`: si = `true` habilita logs detallados de subida en consola (`[storage] ...`). En producción déjalo vacío.

Policies mínimas recomendadas para el bucket (en Supabase → SQL):
```sql
-- SELECT público (si quieres que cualquiera vea fotos de perfil)
create policy "Public user photos"
on storage.objects for select to public
using (bucket_id = 'user-photos');

-- INSERT solo para usuarios autenticados
create policy "Users upload their photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'user-photos');

-- UPDATE / DELETE opcional (si quieres permitir reemplazo/eliminación desde app)
create policy "Users update their photos"
on storage.objects for update to authenticated
using (bucket_id = 'user-photos');

create policy "Users delete their photos"
on storage.objects for delete to authenticated
using (bucket_id = 'user-photos');
```

### Flujo de subida actual
1. Selección multi-foto (galería o cámara) con límite 6.
2. Ordenación mediante drag & drop (la primera se guarda como `avatar_url`).
3. Pre-flight bucket.
4. Compresión / resize (hasta 1600px) si está disponible `expo-image-manipulator`.
5. Subidas concurrentes (por defecto configuradas a 3) con reintentos exponenciales.
6. Fallback a cola offline si hay fallo de red (se reintenta al abrir la pantalla de nuevo).
7. Nombres únicos UUID.
8. Inserción ordenada en `user_photos` + actualización de `profiles.avatar_url`.
9. Botón de diagnóstico ("Diag") para inspección rápida.

### Mejoras futuras sugeridas
- Compresión/resize antes de subir (ej. `expo-image-manipulator`).
- Ajustar nivel de concurrencia dinámicamente según red.
- Mini caché local de thumbnails procesados.
- Limpieza automática de uploads huérfanos (garbage collector de ficheros no referenciados).

---

---

## Semillas rápidas (opcional)
Inserta un evento de prueba desde el SQL Editor:

```sql
insert into public.events (title, description, start_at, venue, city, cover_url)
values ('Fiesta Techno', 'Viernes noche', now() + interval '2 days', 'Club Neon', 'Madrid', null);
```

---

## Baseline de restauración (2025-10-05)

Se restauró la pantalla avanzada de **Eventos** con las siguientes capacidades reintroducidas:

- Agrupación por series (locales) con próxima ocurrencia y lista de occurrences (hasta 8) + indicador de "más".
- Prioridad de patrocinio combinada (eventos + series) usando tablas `event_sponsorships` y `series_sponsorships`.
- Cálculo de asistencia: conteo y muestra de hasta 5 avatares (consulta `event_attendance` + `profiles`).
- Botón real de "Voy" (upsert/delete) con refetch y canal realtime para sincronizar cambios propios.
- Sección "Top de hoy" (priorizada por sponsoredPriority; placeholder para métrica futura de presencia real).
- Filtros persistentes: ciudad, rango (hoy/7/30/todos), scope (todo/eventos/locales) y búsqueda textual.
- Orden global: prioridad de patrocinio desc > hora de inicio.
- Header overlay con scroll y badges de tipo de venue en tarjetas.

Tag creado: `baseline-events-restore-2025-10-05` (usar como punto seguro para futuras iteraciones).

Próximas mejoras sugeridas (no incluidas aún):
1. Métrica real de presencia para "Top de hoy".
2. Infinite scroll/paginación.
3. Optimistic update en toggle "Voy" (sin refetch completo).
4. Cache de perfiles y memoización de avatares.
5. UI enriquecida para tarjetas de Top (imágenes / gradientes).

Si se rompe la pantalla en el futuro: hacer `git reset --hard baseline-events-restore-2025-10-05` en una rama nueva y re-aplicar cambios.
