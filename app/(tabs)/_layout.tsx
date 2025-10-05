// app/(tabs)/_layout.tsx
import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../../lib/theme';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';

export default function TabLayout() {
  const { user } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    enabled: !!user,
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: matches, error } = await supabase
        .from('matches')
        .select('id, user_a, user_b, last_message_at, last_read_a, last_read_b')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      if (error || !matches) return 0;

      let total = 0;
      for (const m of matches) {
        const myRead = m.user_a === user.id ? m.last_read_a : m.last_read_b;
        if (m.last_message_at && (!myRead || m.last_message_at > myRead)) total += 1;
      }
      return total;
    },
  });

  // 1) Refresca cuando la pestaña recupera el foco
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  // 2) Realtime: si cambia matches (nuevo mensaje o leído), refrescar
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refetch]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: 'Eventos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles" size={size} color={color} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: -4,
                    backgroundColor: 'red',
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                    {unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
