import { Stack, router } from 'expo-router';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlendHeaderBackground } from 'components/design/BlendHeaderBackground';
import { theme } from 'lib/theme';

export default function SeriesLayout() {
  // Use a Stack inside the owner tabs for series screens so they don't become tabs.
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackground: () => <BlendHeaderBackground variant="sub" />,
        headerTintColor: theme.colors.text,
        headerBackVisible: false,
        headerTitleAlign: 'left',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
        ),
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={require('../../../assets/adaptive-icon-foreground.png')}
              style={{ width: 24, height: 24, marginRight: 8, resizeMode: 'contain' }}
            />
            <Text style={{ fontSize: 20, lineHeight: 24, fontWeight: '800', color: theme.colors.text, letterSpacing: 0.5 }}>WISPIC</Text>
          </View>
        ),
        headerTitleStyle: { color: theme.colors.text, fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
      }}
    />
  );
}
