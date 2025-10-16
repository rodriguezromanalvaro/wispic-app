import { Tabs } from 'expo-router';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { applyPalette, theme } from '../../lib/theme';
import { useEffect } from 'react';
import { useThemeMode } from '../../lib/theme-context';

function LogoTitle() {
  const { theme: dynTheme } = useThemeMode();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        source={require('../../assets/adaptive-icon-foreground.png')}
        style={{ width: 24, height: 24, marginRight: 8, resizeMode: 'contain' }}
      />
      <Text
        style={{ fontSize: 20, fontWeight: '800', color: dynTheme.colors.text, letterSpacing: 1 }}
      >
        WISPIC
      </Text>
    </View>
  );
}

export default function OwnerLayout() {
  useEffect(() => {
    applyPalette('owner');
    return () => { applyPalette('coral'); };
  }, []);
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: theme.colors.primary,
      headerShown: true,
      tabBarStyle: { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border },
      headerStyle: { backgroundColor: theme.colors.bgAlt },
      headerTitle: () => <LogoTitle />,
      headerShadowVisible: false,
      headerTitleAlign: 'left',
      tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
    }}>
      <Tabs.Screen name="home" options={{
        title: 'Inicio',
        tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="events" options={{
        title: 'Eventos',
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="venue" options={{
        title: 'Local',
        tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Ajustes',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
      }} />
    </Tabs>
  );
}
