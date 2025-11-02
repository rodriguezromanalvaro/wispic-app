// app.config.ts
import fs from 'fs';

import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Wispic',
  slug: 'wispic-app',
  scheme: 'wispic',
  orientation: 'portrait',
  // ❌ quitamos icon
  userInterfaceStyle: 'automatic',
  // Enable React Native New Architecture at app-config level (preferred over plugin flag)
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    // ❌ sin icon iOS
    bundleIdentifier: 'com.wispic.app',
    // Apple Sign-In deshabilitado
    // usesAppleSignIn: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Necesitamos tu ubicación para mostrar eventos cercanos y mejorar la experiencia.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Permite el acceso en segundo plano para funciones como recordatorios basados en ubicación (opcional).',
      NSCameraUsageDescription:
        'Necesitamos la cámara para escanear códigos y capturar imágenes dentro de la app.',
      NSPhotoLibraryUsageDescription:
        'Necesitamos acceder a tus fotos para seleccionar y subir imágenes.',
      NSPhotoLibraryAddUsageDescription:
        'Necesitamos guardar imágenes en tu galería cuando exportes o descargues contenido.',
      NSFaceIDUsageDescription:
        'Usamos Face ID para iniciar sesión de forma rápida y segura.',
      UIBackgroundModes: ['location'],
      // Required by App Store Connect metadata
      ITSAppUsesNonExemptEncryption: false,
    },
    // Si añades GoogleService-Info.plist en la raíz del repo, descomenta/ajusta esta ruta
    // googleServicesFile: './GoogleService-Info.plist',
    config: {
      googleMapsApiKey: process.env.IOS_GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    // ❌ sin adaptiveIcon para evitar procesado de PNGs
    package: 'com.wispic.app',
  // Usamos resize para que el sistema reduzca la altura disponible y nosotros NO dupliquemos desplazamientos
  softwareKeyboardLayoutMode: 'resize',
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'CAMERA',
      'POST_NOTIFICATIONS',
      // Android 13+ granular media permission for images/photos
      'READ_MEDIA_IMAGES',
  ],
    // Provide google-services.json directly from the repo to avoid relying on EAS file secrets.
    // This file is a non-sensitive client config and safe to commit for development.
    // Expo prebuild will copy it into android/app/google-services.json automatically.
    googleServicesFile: './google-services.dev.json',
    adaptiveIcon: {
      // Foreground 1024x1024 con transparencia (negro o blanco en PNG)
      foregroundImage: './assets/adaptive-icon-foreground.png',
      // Fondo sólido con un tono suave usado en la paleta de usuario (magenta soft)
      backgroundColor: '#FFF5F7',
    },
    config: {
      googleMaps: {
        apiKey: process.env.ANDROID_GOOGLE_MAPS_API_KEY,
      },
    },
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-notifications',
    'expo-updates',
    'expo-location',
    'expo-camera',
    'sentry-expo',
    // 'expo-apple-authentication',
    [
      'expo-build-properties',
      {
        android: {
          kotlinVersion: '2.1.20',
          kotlinJvmTarget: '17',
          compileSdkVersion: 35,
          targetSdkVersion: 35
        }
      }
    ],
  ],
  experiments: {
    typedRoutes: true,
  },

  // EAS / Updates
  owner: 'arodrom',
  extra: {
    eas: {
      projectId: 'f6d316e7-9b6c-437e-b86b-0ce379b25a0d',
    },
    // Google Places API Key for city search (enable Places API in Google Cloud)
    placesApiKey: process.env.GOOGLE_PLACES_API_KEY,
  },
  updates: {
    enabled: true,
  },
  runtimeVersion: {
    policy: 'sdkVersion',
  },
};

export default config;
