// components/paywall.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Button, Card } from './ui';
import { theme } from '../lib/theme';

type Props = {
  onClose?: () => void;
  onBuy?: () => Promise<void> | void;
  context?: string; // p.ej. 'undo', 'boost', etc.
};

export default function Paywall({ onClose, onBuy, context = 'undo' }: Props) {
  return (
    <View style={{ gap: theme.spacing(1) }}>
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '900' }}>
        Wispic Premium
      </Text>
      <Text style={{ color: theme.colors.subtext }}>
        Desbloquea funciones pro:
      </Text>

      <Card>
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.text }}>• Deshacer decisiones</Text>
          <Text style={{ color: theme.colors.text }}>• Superlikes extra (próximamente)</Text>
          <Text style={{ color: theme.colors.text }}>• Boost de visibilidad (próximamente)</Text>
        </View>
      </Card>

      {!!context && (
        <Text style={{ color: theme.colors.subtext }}>
          Estás intentando usar: {context === 'undo' ? 'Deshacer decisión' : context}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Button title="Activar Premium" onPress={async () => { await onBuy?.(); onClose?.(); }} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Ahora no" variant="ghost" onPress={onClose ?? (() => {})} />
        </View>
      </View>
    </View>
  );
}
