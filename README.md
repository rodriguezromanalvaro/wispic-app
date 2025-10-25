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

---

## Prueba rápida de notificaciones push

1. Abre la ruta `/push-test` en el Dev Client (ej.: npx expo start y abre wispic://push-test) para obtener tu Expo Push Token y lanzar una notificación local.
2. Envía un push remoto desde tu PC usando el token copiado:

	Opcional:
	```powershell
	npx ts-node .\scripts\send-push-test.ts <ExpoPushToken>
	```

Requisitos:
- `google-services.json` presente y correcto.
- `app.config.ts` tiene `extra.eas.projectId`.
- Permiso de notificaciones concedido en el dispositivo (Android 13+ pide POST_NOTIFICATIONS).

---

## Ubicación: Google Places (tipo “Maps”) con fallback sin coste

El selector de ciudad usa Google Places Autocomplete para una experiencia "tipo Maps". Si no configuras la clave, la app sigue funcionando con el geocodificador del sistema (menos preciso, sin coste de Google).

### 1) Habilita APIs en Google Cloud
- En tu proyecto de Google Cloud, ve a “APIs & Services → Library” y habilita:
	- Places API (o “Places API (New)” si aparece) — para Autocomplete y Place Details
	- Opcional, si renderizas mapas nativos: Maps SDK for Android y Maps SDK for iOS

### 2) Crea/restringe tu API Key (recomendado)
- “APIs & Services → Credentials → Create credentials → API key”.
- Application restrictions:
	- Para Places Web Service (llamado desde la app): normalmente “None” o restricciones por API; evita exponer la key fuera de builds de confianza.
	- Para SDKs nativos (si usas mapas): restringe por app (Android package + SHA-1; iOS bundle ID/team).
- API restrictions: limita al menos a “Places API” y, si aplica, a “Maps SDK for Android/iOS”.

### 3) Añade la clave al proyecto (desarrollo local en Windows PowerShell)

En esta sesión de PowerShell (solo temporal):

```powershell
$env:GOOGLE_PLACES_API_KEY = "<TU_CLAVE_DE_PLACES>"
# Opcional, si usas mapas nativos en iOS/Android
$env:ANDROID_GOOGLE_MAPS_API_KEY = "<TU_CLAVE_MAPS_ANDROID>"
$env:IOS_GOOGLE_MAPS_API_KEY = "<TU_CLAVE_MAPS_IOS>"

# Reinicia el bundler después de establecer las variables
npm start
```

Notas:
- `app.config.ts` ya lee estas variables (`process.env.GOOGLE_PLACES_API_KEY`, `ANDROID_GOOGLE_MAPS_API_KEY`, `IOS_GOOGLE_MAPS_API_KEY`).
- No guardes claves reales en el repo. Si quieres persistirlas entre sesiones, crea variables de entorno de usuario en Windows o usa un gestor de secretos.

### 4) Builds en EAS (CI/CD)
- Sube las claves como secretos en EAS en vez de hardcodearlas. Por ejemplo:

```powershell
eas secret:create --name GOOGLE_PLACES_API_KEY --value <TU_CLAVE>
eas secret:create --name ANDROID_GOOGLE_MAPS_API_KEY --value <TU_CLAVE_ANDROID>
eas secret:create --name IOS_GOOGLE_MAPS_API_KEY --value <TU_CLAVE_IOS>
```

### 5) Costes y buenas prácticas
- Usa session tokens para Autocomplete (ya implementado) y pide Place Details solo al seleccionar; reduce facturación.
- Configura alertas de presupuesto en Google Cloud (Billing → Budgets & alerts).
- Si no hay clave, el selector usa el geocoder del sistema como fallback.

