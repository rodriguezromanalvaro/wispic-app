// components/PaywallModal.tsx
import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { theme } from '../lib/theme';
import { useAuth } from '../lib/useAuth';
import { usePremiumStore } from '../lib/premium';
import Paywall from './Paywall'; // Asegúrate: archivo se llama "Paywall.tsx" (P mayúscula)
import { Card } from './ui';

// --- Event bus mínimo para abrir/cerrar desde cualquier sitio ---
type Listener = (reason?: string) => void;
let openListeners = new Set<Listener>();
export function openPaywall(reason?: string) {
  openListeners.forEach((fn) => fn(reason));
}
// ---------------------------------------------------------------

export default function PaywallModal() {
  const { user } = useAuth();
  const { isPremium, refresh, setPremium } = usePremiumStore();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  // Si cambia de usuario, refrescamos su premium
  useEffect(() => {
    if (user?.id) refresh(user.id);
  }, [user?.id]);

  // Suscripción al "openPaywall"
  useEffect(() => {
    const handler: Listener = async (r) => {
      if (!user?.id) return;
      // 👇 no abras si ya es premium
      await refresh(user.id);
      if (usePremiumStore.getState().isPremium) return;
      setReason(r);
      setVisible(true);
    };
    openListeners.add(handler);
    return () => {
      openListeners.delete(handler);
    };
  }, [user?.id]);

  const activate = async () => {
    if (!user?.id) return;
    try {
      await setPremium(user.id, true);
      setVisible(false); // cerrar al activar
    } catch (e: any) {
      // podrías mostrar Alert si quieres
    }
  };

  const close = () => setVisible(false);

  // Si ya es premium, no renderizamos nada
  if (isPremium) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <Card style={{ width: '100%', maxWidth: 420, gap: 12 }}>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
            Wispic Premium
          </Text>
          {!!reason && (
            <Text style={{ color: theme.colors.subtext }}>
              Esta función requiere premium: <Text style={{ fontWeight: '700', color: theme.colors.text }}>{reason}</Text>
            </Text>
          )}
          <Paywall />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Pressable onPress={close} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Ahora no</Text>
            </Pressable>
            <Pressable
              onPress={activate}
              style={{
                paddingVertical: 10, paddingHorizontal: 14,
                backgroundColor: theme.colors.primary, borderRadius: theme.radius,
              }}
            >
              <Text style={{ color: theme.colors.primaryText, fontWeight: '800' }}>Activar Premium</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
