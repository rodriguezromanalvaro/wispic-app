// app.config.ts
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Wispic',
  slug: 'wispic-app',
  scheme: 'wispic',
  orientation: 'portrait',
  // ❌ quitamos icon
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    // ❌ sin icon iOS
    bundleIdentifier: 'com.wispic.app',
    usesAppleSignIn: true,
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
    // Evita que el teclado tape el contenido en Android
    softwareKeyboardLayoutMode: 'pan',
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'CAMERA',
      'POST_NOTIFICATIONS',
      'com.android.vending.BILLING',
    ],
     googleServicesFile: './google-services.json',
    adaptiveIcon: {
      // Foreground 1024x1024 con transparencia
      foregroundImage: './assets/adaptive-icon-foreground.png',
      // Background 1080x1080 sin transparencia
      backgroundImage: './assets/adaptive-icon-background.png',
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
    'expo-barcode-scanner',
    'sentry-expo',
    'expo-apple-authentication',
    [
      'expo-build-properties',
      {
        android: {
          newArchEnabled: false,
          kotlinVersion: '2.0.21',
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
  },
  updates: {
    enabled: true,
  },
  runtimeVersion: {
    policy: 'sdkVersion',
  },
};

export default config;
