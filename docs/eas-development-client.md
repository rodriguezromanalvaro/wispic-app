# EAS Development Client (Android) — Guía rápida

Esta guía te deja un Dev Client que incluye FCM (google-services.json) para poder obtener tokens push y probar notificaciones remotas.

Requisitos previos
- Tener `eas-cli` instalado y sesión iniciada en tu cuenta de Expo.
- Archivo `android/app/google-services.json` válido para tu paquete `com.wispic.app` (ya está en el repo). Alternativa: usar un secreto EAS `ANDROID_GOOGLE_SERVICES_JSON`.
- `extra.eas.projectId` configurado en `app.config.ts` (ya está).

## 1) Verifica google-services.json

- Comprueba que existe `android/app/google-services.json` y que contiene:
  - `client[0].client_info.android_client_info.package_name = "com.wispic.app"`
  - `project_info.project_number` y `mobilesdk_app_id` presentes

Si no lo tienes o no coincide, descarga el correcto desde Firebase Console → Project settings → General → Your apps → Android `com.wispic.app` → Download `google-services.json`.

## 2) Build del Dev Client

- Perfil ya definido en `eas.json`:
  - `build.development`: `developmentClient: true`, Android `apk`, canal `development`.

Para construir el Dev Client de Android:

```powershell
# Autentícate si hace falta
# eas login

# Construye el Dev Client para Android usando el perfil "development"
eas build -p android --profile development
```

Instala el APK en tu Pixel (desde el enlace/QR que genera EAS). Abre la app y conecta con `npm start` si quieres el bundler local.

Notas:
- Si prefieres no commitear `android/app/google-services.json`, puedes subirlo como secreto:
  - `eas secret:create --name ANDROID_GOOGLE_SERVICES_JSON --scope project --type file --value ./ruta/google-services.json`
- Este proyecto ejecuta `scripts/write-google-services.js` en pre-build: si detecta el fichero commiteado, lo usa; si no, intentará leer el secreto.

## 3) Probar push en la app

- Abre Perfil → Configurar → Notificaciones:
  - "Obtener token": debería mostrarte el `ExpoPushToken[...]` sin errores.
  - "Re-registrar token": guardará el token en `public.push_tokens`.
  - "Local test": dispara una notificación local.
- Prueba un push remoto desde el PC (opcional):

```powershell
npx ts-node .\scripts\send-push-test.ts <ExpoPushToken>
```

## 4) Problemas comunes

- "Default FirebaseApp is not initialized...": el binario instalado no incluía `google-services.json` → reinstala el Dev Client construido con EAS.
- "DeviceNotRegistered" al enviar push: el token está obsoleto → abre la app para refrescar token y vuelve a probar.
- En Expo Go no funcionan tokens push → usa siempre Dev Client o build standalone.
