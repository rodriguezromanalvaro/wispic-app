import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { registerForPushNotificationsAsync, scheduleLocalTestNotification } from '../lib/notifications';

export default function PushTestScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      setError('Falta extra.eas.projectId en app.config.ts');
      return;
    }
    registerForPushNotificationsAsync(projectId)
      .then(setToken)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prueba de Push</Text>
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}
      <Text style={styles.label}>Expo Push Token:</Text>
      <Text selectable style={styles.token}>{token ?? 'Obteniendo token…'}</Text>
      <View style={styles.buttons}>
        <Button title="Notificación local" onPress={() => scheduleLocalTestNotification()} />
      </View>
      <Text style={styles.help}>Copia el token y envíalo con el script de Node para probar un push remoto.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
  label: { fontWeight: '600' },
  token: { fontFamily: 'monospace' },
  buttons: { marginTop: 12 },
  help: { marginTop: 12, color: '#666' },
  error: { color: '#b00020' },
});
