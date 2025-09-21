import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

type Props = {
  title: string;
  onBack?: () => void;   // opcional: acción personalizada
  hideBack?: boolean;    // si true, no mostramos botón atrás
};

export default function TopBar({ title, onBack, hideBack = false }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const showBack = !hideBack; // 👈 por defecto mostramos atrás
  const handleBack = () => {
    if (onBack) return onBack();
    router.back();
  };

  // padding superior seguro (status bar / notch) + un pelín extra
  const topPad = Math.max(insets.top, 10);

  return (
    <View
      style={{
        paddingTop: topPad,
        paddingHorizontal: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.bg,
      }}
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
      ) : (
        // reservamos hueco para centrar el título visualmente
        <View style={{ width: 36 }} />
      )}

      <Text
        numberOfLines={1}
        style={{
          color: theme.colors.text,
          fontWeight: '800',
          fontSize: 18,
          flex: 1,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>

      {/* spacer derecha para centrar el título respecto al botón atrás */}
      <View style={{ width: 36 }} />
    </View>
  );
}
