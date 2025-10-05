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
  },
  android: {
    // ❌ sin adaptiveIcon para evitar procesado de PNGs
    package: 'com.wispic.app',
    // Evita que el teclado tape el contenido en Android
    softwareKeyboardLayoutMode: 'pan',
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-notifications',
    'expo-updates',
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
