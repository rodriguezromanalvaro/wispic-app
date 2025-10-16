import React from 'react';
import { View, Image, Text } from 'react-native';
import { theme } from '../lib/theme';

export type AvatarMini = { id: string; avatar_url: string | null };

interface AvatarStackProps {
  avatars: AvatarMini[];
  total: number; // total attendees count
  size?: number; // diameter of each avatar circle
  maxVisible?: number; // safety; usually avatars.length already trimmed
}

// Pequeño stack de avatares superpuestos + contador restante.
export const AvatarStack: React.FC<AvatarStackProps> = ({ avatars, total, size = 24, maxVisible = 5 }) => {
  if (!total) return null;
  const shown = avatars.slice(0, maxVisible);
  const remaining = Math.max(0, total - shown.length);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((a, idx) => (
        <View
          key={a.id}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: 'hidden',
              marginLeft: idx === 0 ? 0 : -Math.round(size * 0.35),
              borderWidth: 1,
              borderColor: theme.colors.bg,
              backgroundColor: theme.colors.card,
              justifyContent: 'center',
              alignItems: 'center'
            }}
        >
          {a.avatar_url ? (
            <Image source={{ uri: a.avatar_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ fontSize: size * 0.45, color: theme.colors.textDim }}>•</Text>
          )}
        </View>
      ))}
      {remaining > 0 && (
        <View style={{ marginLeft: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: theme.colors.card }}>
          <Text style={{ fontSize: 11, color: theme.colors.text }}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
};
