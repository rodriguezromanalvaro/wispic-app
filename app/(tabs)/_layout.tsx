// app/(tabs)/_layout.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Image, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../../lib/theme';
import { useThemeMode } from '../../lib/theme-context';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';

function LogoTitle() {
  const { theme: dynTheme } = useThemeMode();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        source={require('../../assets/logotype.png')}
        style={{ width: 30, height: 30, marginRight: 8, resizeMode: 'contain' }}
      />
      <Text
        style={{
          fontSize: 20,
          fontWeight: '800',
          color: dynTheme.colors.text,
          letterSpacing: 1,
        }}
      >
        WISPIC
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const { theme: dynTheme } = useThemeMode();
  const pathname = usePathname();
  const router = useRouter();
  const [eventTitleCache, setEventTitleCache] = useState<Record<string,string>>({});
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  // Detect numeric event id in feed swipe route: /feed/{id}
  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 2 && parts[0] === 'feed') {
      const maybeId = parts[1];
      if (/^\d+$/.test(maybeId) && !eventTitleCache[maybeId]) {
        setPendingEventId(maybeId);
      }
    } else {
      setPendingEventId(null);
    }
  }, [pathname, eventTitleCache]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pendingEventId) return;
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id,title')
          .eq('id', Number(pendingEventId))
          .maybeSingle();
        if (!cancelled && data && !error) {
          setEventTitleCache(prev => ({ ...prev, [pendingEventId]: data.title || `Evento ${pendingEventId}` }));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [pendingEventId]);

  // Determine if current path is a root tab (single segment among allowed)
  const { headerVariant, isRootTab } = useMemo(() => {
    if (!pathname) return { headerVariant: 'brand', isRootTab: true } as const;
    const segments = pathname.split('/').filter(Boolean);
    const ROOT_TABS = ['events','feed','chat','profile'];
    const isRoot = segments.length === 1 && ROOT_TABS.includes(segments[0]);
    return { headerVariant: isRoot ? 'brand' : 'sub', isRootTab: isRoot } as const;
  }, [pathname]);

  const derivedTitle = useMemo(() => {
    if (headerVariant === 'brand') return <LogoTitle />;
    // For now basic mapping: show capitalized second segment
    const parts = pathname.split('/').filter(Boolean);
    const leaf = parts[parts.length - 1];
    // Simple heuristics
    if (/^\d+$/.test(leaf)) {
      if (parts.includes('events')) return 'Evento';
      if (parts.length === 2 && parts[0] === 'feed') {
        return eventTitleCache[leaf] || 'Evento';
      }
    }
    if (parts.includes('chat')) return 'Chat';
    return leaf.replace(/[-_]/g, ' ').replace(/^(\w)/, c => c.toUpperCase());
  }, [headerVariant, pathname, eventTitleCache]);

  const isSwipeEvent = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.length === 2 && parts[0] === 'feed' && /^\d+$/.test(parts[1]);
  }, [pathname]);

  const headerTitleComponent = headerVariant === 'brand' ? () => derivedTitle as any : () => {
    const inner = (
      <Text style={{ fontSize: 17, fontWeight: '700', color: dynTheme.colors.text }} numberOfLines={1}>
        {derivedTitle as any}
      </Text>
    );
    if (isSwipeEvent) {
      return (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={{ flexDirection:'row', alignItems:'center' }}
        >
          {inner}
        </Pressable>
      );
    }
    return inner;
  };

  // Back button sólo en rutas sub (no en brand)
  const headerLeftComponent = headerVariant === 'sub' ? () => (
    <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
      <Ionicons name="chevron-back" size={24} color={dynTheme.colors.text} />
    </Pressable>
  ) : undefined;

  // headerRight: sólo logout en profile root (sin placeholder, ya que pedimos títulos a la izquierda)
  const headerRightComponent = (() => {
    if (headerVariant !== 'brand') return undefined;
    const first = pathname.split('/').filter(Boolean)[0] || '';
    if (first === 'profile') {
      return () => (
        <Pressable
          accessibilityLabel="Cerrar sesión"
          onPress={async () => {
            try { await supabase.auth.signOut(); router.replace('/(auth)/sign-in'); } catch {}
          }}
          style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:18, flexDirection:'row', alignItems:'center', gap:6, backgroundColor: dynTheme.colors.card, borderWidth:1, borderColor: dynTheme.colors.border }}
        >
          <Ionicons name="log-out-outline" size={18} color={dynTheme.colors.text} />
          <Text style={{ color: dynTheme.colors.text, fontWeight:'700', fontSize:13 }}>Cerrar sesión</Text>
        </Pressable>
      );
    }
    return undefined;
  })();

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
        headerShown: true,
        headerTitle: headerTitleComponent,
        headerLeft: headerLeftComponent,
        headerRight: headerRightComponent,
        headerStyle: { backgroundColor: dynTheme.colors.bgAlt },
        headerShadowVisible: false,
  headerTitleAlign: 'left',
        tabBarActiveTintColor: dynTheme.colors.primary,
        tabBarStyle: {
          backgroundColor: dynTheme.colors.bg,
          borderTopColor: dynTheme.colors.border,
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
