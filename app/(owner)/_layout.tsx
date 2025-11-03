import { useEffect } from 'react';

import { View, Text, Image, Pressable, StyleSheet } from 'react-native';

import { Tabs, usePathname, useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlendHeaderBackground } from 'components/design/BlendHeaderBackground';
import { applyPalette, theme } from 'lib/theme';
import { useThemeMode } from 'lib/theme-context';

function LogoTitle() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        source={require('../../assets/adaptive-icon-foreground.png')}
        style={{ width: 24, height: 24, marginRight: 8, resizeMode: 'contain' }}
      />
      <Text
        style={{ fontSize: 20, lineHeight: 24, fontWeight: '800', color: theme.colors.text, letterSpacing: 0.5 }}
      >
        WISPIC
      </Text>
    </View>
  );
}

export default function OwnerLayout() {
  const { theme: dynTheme } = useThemeMode();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    // Keep owner palette active while this layout is mounted; revert on unmount
    applyPalette('owner');
    return () => { applyPalette('magenta'); };
  }, []);
  // Match user app logic: root tabs => 'brand', subroutes => 'sub'
  const headerVariant: 'brand' | 'sub' = (() => {
    const path = pathname || '';
    const segments = path.split('/').filter(Boolean);
    const ROOT_TABS = ['home', 'events', 'venue', 'settings'];
    if (segments.length === 1 && ROOT_TABS.includes(segments[0])) return 'brand';
    return 'sub';
  })();
  const bottomInset = insets?.bottom || 0;
  const tabBarPaddingBottom = Math.max(14, bottomInset + 12);
  const tabBarHeight = 82 + bottomInset; // generous base height + safe area
  const headerShownTabs = headerVariant === 'brand';
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: dynTheme.colors.primary,
      tabBarInactiveTintColor: dynTheme.colors.subtext,
      headerShown: headerShownTabs,
  // Ensure the tab bar has enough height and padding to be fully visible on all devices (account for safe area)
  tabBarStyle: { backgroundColor: 'transparent', borderTopColor: 'transparent', paddingTop: 10, paddingBottom: tabBarPaddingBottom, height: tabBarHeight },
      tabBarBackground: () => (
        <View style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dynTheme.colors.cardAlt }]} />
          <LinearGradient
            colors={((theme.gradients?.appBg as any) || [dynTheme.colors.bg, dynTheme.colors.bgAlt, dynTheme.colors.bg]) as [string,string,string]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ position:'absolute', left:0, right:0, top:0, height: StyleSheet.hairlineWidth, backgroundColor: dynTheme.colors.border, opacity: 0.8 }} />
        </View>
      ),
  tabBarItemStyle: { borderRadius: 14, marginHorizontal: 8, marginVertical: 8, paddingVertical: 8, height: 56 },
      tabBarActiveBackgroundColor: 'rgba(37,99,235,0.06)',
      tabBarInactiveBackgroundColor: 'transparent',
  tabBarHideOnKeyboard: false,
      headerStyle: { backgroundColor: 'transparent' },
      headerBackground: () => (<BlendHeaderBackground variant={headerVariant} />),
  headerTitle: headerShownTabs ? () => <LogoTitle /> : undefined,
      headerLeft: headerVariant === 'sub' ? () => (
        <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
      ) : undefined,
      headerShadowVisible: false,
      headerTitleAlign: 'left',
      tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginBottom: 0 },
    }}>
      <Tabs.Screen name="home" options={{
        title: 'Inicio',
        tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="events" options={{
        title: 'Crear Eventos',
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="venue" options={{
        title: 'Mis Eventos',
        tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color} size={size} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Ajustes',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
      }} />
      {/* Hide series list from the tab bar; detail is handled inside its own Stack layout */}
      <Tabs.Screen name="series" options={{ href: null }} />
    </Tabs>
  );
}
