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

## Semillas rápidas (opcional)
Inserta un evento de prueba desde el SQL Editor:

```sql
insert into public.events (title, description, start_at, venue, city, cover_url)
values ('Fiesta Techno', 'Viernes noche', now() + interval '2 days', 'Club Neon', 'Madrid', null);
```
