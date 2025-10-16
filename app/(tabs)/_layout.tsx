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
        source={require('../../assets/adaptive-icon-foreground.png')}
        style={{ width: 24, height: 24, marginRight: 8, resizeMode: 'contain' }}
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
    // Si no hay segmentos ("/"), tratar como raíz de tabs (brand)
    if (segments.length === 0) return { headerVariant: 'brand', isRootTab: true } as const;
    const isRoot = segments.length === 1 && ROOT_TABS.includes(segments[0]);
    return { headerVariant: isRoot ? 'brand' : 'sub', isRootTab: isRoot } as const;
  }, [pathname]);

  // Ocultar header de Tabs dentro de /chat/[matchId] para que el hilo dibuje su propio header estable
  const hideHeaderForChatThread = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    // pattern: chat / {matchId}
    return parts.length === 2 && parts[0] === 'chat';
  }, [pathname]);

  const derivedTitle = useMemo(() => {
    if (headerVariant === 'brand') return <LogoTitle />;
    // For now basic mapping: show capitalized second segment
    const parts = (pathname || '').split('/').filter(Boolean);
    const leaf = parts[parts.length - 1] || '';
    // Simple heuristics
    if (/^\d+$/.test(leaf)) {
      if (parts.includes('events')) return 'Evento';
      if (parts.length === 2 && parts[0] === 'feed') {
        return eventTitleCache[leaf] || 'Evento';
      }
    }
    if (parts.includes('chat')) return 'Chat';
    if (!leaf) return 'Inicio';
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

  // headerRight: reservado (por ahora nada) en profile root
  const headerRightComponent = (() => {
    if (headerVariant !== 'brand') return undefined;
    const first = pathname.split('/').filter(Boolean)[0] || '';
    if (first === 'profile') {
      return undefined;
    }
    return undefined;
  })();

  const { data: unreadCount = 0, refetch } = useQuery({
    enabled: !!user,
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      // 1) Fetch matches for this user
      const { data: matches, error } = await supabase
        .from('matches')
        .select('id, user_a, user_b, last_message_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      if (error || !matches || matches.length === 0) return 0;

      const matchIds = (matches as any[]).map((m:any) => m.id);
      // 2) Fetch my read rows for these matches
      const { data: reads } = await supabase
        .from('match_reads')
        .select('match_id,last_read_at')
        .eq('user_id', user.id)
        .in('match_id', matchIds);
      const mapReads = new Map<number, string>((reads || []).map((r:any) => [r.match_id, r.last_read_at]));

      // 3) Fetch recent messages across these matches and count those from others after my last_read
      const { data: msgs } = await supabase
        .from('messages')
        .select('id,match_id,sender,created_at')
        .in('match_id', matchIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(matchIds.length * 50, 1000));
      if (!msgs || msgs.length === 0) return 0;

      let total = 0;
      for (const m of msgs as any[]) {
        const myRead = mapReads.get(m.match_id) || null;
        if (m.sender !== user.id && (!myRead || m.created_at > myRead)) {
          total += 1;
        }
      }
      return total;
    },
  });

  // 1) Refresca cuando la pestaña recupera el foco
  useFocusEffect(React.useCallback(() => { refetch(); }, [refetch]));

  // 2) Realtime: refrescar ante cambios relevantes
  useEffect(() => {
    if (!user) return;
    const onChange = () => refetch();
    const ch1 = supabase
      .channel('unread-badge-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
      .subscribe();
    const ch2 = supabase
      .channel('unread-badge-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
      .subscribe();
    const ch3 = supabase
      .channel('unread-badge-reads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_reads', filter: `user_id=eq.${user.id}` }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, [user?.id, refetch]);

  return (
    <Tabs
      screenOptions={{
        headerShown: !hideHeaderForChatThread,
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
