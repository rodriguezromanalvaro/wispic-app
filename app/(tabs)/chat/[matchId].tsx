import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card, Button } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { GradientScaffold } from '../../../features/profile/components/GradientScaffold';

type MatchRow = {
  id: number;
  user_a: string;
  user_b: string;
  superlike: boolean;
  last_message_at: string | null;
};

import { Profile } from '../../../lib/types';

type Message = {
  id: number;
  match_id: number;
  sender: string;
  content: string;
  created_at: string;
};

export default function ChatThread() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const mid = Number(matchId);
  const { user } = useAuth();
  const qc = useQueryClient();

  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // 1) Carga del match
  const { data: match, isLoading: loadingMatch } = useQuery<MatchRow | null>({
    enabled: !!user && Number.isFinite(mid),
    queryKey: ['match', mid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
  .select('id,user_a,user_b,superlike,last_message_at')
        .eq('id', mid)
        .maybeSingle();
      if (error) throw error;
      return (data as MatchRow) ?? null;
    },
  });

  const otherUserId = useMemo(() => {
    if (!match || !user) return null;
    return match.user_a === user.id ? match.user_b : match.user_a;
  }, [match, user?.id]);

  // 2) Perfil del otro usuario
  const { data: otherProfile } = useQuery<Profile | null>({
    enabled: !!otherUserId,
    queryKey: ['profile', otherUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,display_name')
        .eq('id', otherUserId!)
        .maybeSingle();
      return (data as Profile) ?? null;
    },
  });

  // 3) Mensajes del hilo
  const { data: messages, isLoading: loadingMsgs, refetch: refetchMsgs, isRefetching } = useQuery<Message[]>({
    enabled: !!match,
    queryKey: ['messages', mid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id,match_id,sender,content,created_at')
        .eq('match_id', mid)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Message[];
    },
  });

  // 4) Marcar leído al entrar
  useEffect(() => {
    if (!match || !user) return;
    (async () => {
      try {
        await supabase.from('match_reads')
          .upsert({ match_id: mid, user_id: user.id, last_read_at: new Date().toISOString() })
          .select();
        qc.invalidateQueries({ queryKey: ['matches-enriched3', user.id] });
        qc.invalidateQueries({ queryKey: ['unread-count', user.id] });
      } catch (e: any) {
        console.warn('Error marcando leído', e);
      }
    })();
  }, [match?.id, user?.id]);

  // 5) Realtime: si llega mensaje nuevo en este match
  useEffect(() => {
    if (!mid) return;
    const ch = supabase
      .channel(`messages-${mid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${mid}` }, async () => {
        await refetchMsgs();
        if (match && user) {
          await supabase.from('match_reads')
            .upsert({ match_id: mid, user_id: user.id, last_read_at: new Date().toISOString() })
            .select();
          qc.invalidateQueries({ queryKey: ['unread-count', user.id] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mid, match?.user_a, match?.user_b, user?.id]);

  // 6) Enviar mensaje (optimista) + actualizar last_message_at
  const send = async () => {
    const content = text.trim();
    if (!content || !user || !match) return;

    const optimistic: Message = {
      id: -Date.now(),
      match_id: mid,
      sender: user.id,
      content,
      created_at: new Date().toISOString(),
    };
    qc.setQueryData(['messages', mid], (old: any) => ([...(old || []), optimistic]));
    setText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ match_id: mid, sender: user.id, content: optimistic.content })
      .select('*')
      .single();

    if (error) {
      qc.setQueryData(['messages', mid], (old: Message[] | undefined) =>
        (old || []).filter((m) => m.id !== optimistic.id)
      );
      return Alert.alert('Error', error.message);
    }

    await supabase.from('matches').update({ last_message_at: new Date().toISOString() }).eq('id', mid);

    qc.setQueryData(['messages', mid], (old: Message[] | undefined) =>
      (old || []).map((m) => (m.id === optimistic.id ? (data as Message) : m))
    );

    // 👇 me marco leído tras enviar y refresco badge
    await supabase.from('match_reads')
      .upsert({ match_id: mid, user_id: user.id, last_read_at: new Date().toISOString() })
      .select();

    qc.invalidateQueries({ queryKey: ['matches-enriched3', user.id] });
    qc.invalidateQueries({ queryKey: ['unread-count', user.id] }); // 👈 refresca badge
  };

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });

  if (loadingMatch || loadingMsgs) {
    return (
      <Screen style={{ padding:0 }}>
        <GradientScaffold>
          <TopBar title="Chat" mode="overlay" scrollY={scrollY} onBack={() => router.replace('/(tabs)/chat')} />
          <View style={{ flex:1, paddingTop:120, alignItems:'center' }}>
            <ActivityIndicator style={{ marginTop:40 }} color={theme.colors.primary} />
          </View>
        </GradientScaffold>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen style={{ padding:0 }}>
        <GradientScaffold>
          <TopBar title="Chat" mode="overlay" scrollY={scrollY} onBack={() => router.replace('/(tabs)/chat')} />
          <View style={{ flex:1, paddingTop:120 }}>
            <Card style={{ margin:16 }}><Text style={{ color: theme.colors.text }}>Chat no encontrado.</Text></Card>
          </View>
        </GradientScaffold>
      </Screen>
    );
  }

  const otherName = (otherProfile?.display_name || 'Match').trim();
  const title = `Chat con ${otherName}`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 }) as number}
    >
      <Screen style={{ padding:0 }}>
        <GradientScaffold>
          <TopBar title={title} onBack={() => router.replace('/(tabs)/chat')} mode="overlay" scrollY={scrollY} />
          <Animated.FlatList
            onScroll={onScroll}
            scrollEventThrottle={16}
            data={messages || []}
            keyExtractor={(m:any) => String(m.id)}
            refreshing={isRefetching}
            onRefresh={refetchMsgs}
            contentContainerStyle={{ paddingTop:120, paddingBottom: 80, paddingHorizontal:12 }}
            renderItem={({ item }: any) => {
            const mine = item.sender === user?.id;
            return (
              <View style={{ paddingVertical: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '80%',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: mine ? theme.colors.primary : theme.colors.card,
                    borderWidth: 1,
                    borderColor: mine ? theme.colors.primary : theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: mine ? theme.colors.primaryText : theme.colors.text,
                      fontWeight: '700',
                      marginBottom: 4,
                    }}
                  >
                    {mine ? 'Tú' : otherName}
                  </Text>
                  <Text style={{ color: mine ? theme.colors.primaryText : theme.colors.text }}>
                    {item.content}
                  </Text>
                  <Text
                    style={{
                      color: mine ? theme.colors.primaryText : theme.colors.subtext,
                      fontSize: 11,
                      marginTop: 6,
                      textAlign: 'right',
                    }}
                  >
                    {new Date(item.created_at).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            );
          }}
            ListEmptyComponent={
              <Card>
                <Text style={{ color: theme.colors.text }}>
                  Aún no hay mensajes. ¡Saluda a {otherName}!
                </Text>
              </Card>
            }
          />

          <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.bgAlt,
            position:'absolute',
            left:0,
            right:0,
            bottom:0,
          }}
        >
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje"
            placeholderTextColor={theme.colors.subtext}
            style={{
              flex: 1,
              color: theme.colors.text,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius,
              paddingHorizontal: 12,
              paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            }}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Button title="Enviar" onPress={send} />
          </View>
        </GradientScaffold>
      </Screen>
    </KeyboardAvoidingView>
  );
}
