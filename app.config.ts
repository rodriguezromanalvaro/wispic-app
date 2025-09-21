import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Wispic',
  slug: 'wispic-app',
  scheme: 'wispic',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    package: 'com.wispic.app',
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-notifications',
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
