import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

// --- Helpers & i18n (simple local) ---
const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 40;
const HEADER_SPACER = 0; // no overlay header now

function detectLocale() {
  try {
    const loc = Intl?.DateTimeFormat?.().resolvedOptions().locale || 'en';
    return loc.startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

const STRINGS: Record<string, Record<string, string>> = {
  en: {
    you: 'You',
    send: 'Send',
    placeholder: 'Write a message',
    empty: 'No messages yet. Say hi to',
    chatWith: 'Chat with',
    loadingChat: 'Chat',
  },
  es: {
    you: 'Tú',
    send: 'Enviar',
    placeholder: 'Escribe un mensaje',
    empty: 'Aún no hay mensajes. ¡Saluda a',
    chatWith: 'Chat con',
    loadingChat: 'Chat',
  },
};

function formatTime(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleTimeString();
  }
}

export default function ChatThread() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const mid = Number(matchId);
  const { user } = useAuth();
  const qc = useQueryClient();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const locale = detectLocale();
  const T = STRINGS[locale];

  // Scroll tracking refs for auto-scroll logic
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const atBottomRef = useRef(true);

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

  // 3) Mensajes del hilo (paginados ascendente en memoria)
  const { data: initialPage, isLoading: loadingMsgs, refetch: refetchInitial } = useQuery<Message[]>({
    enabled: !!match,
    queryKey: ['messages-initial', mid, PAGE_SIZE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id,match_id,sender,content,created_at')
        .eq('match_id', mid)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const arr = (data || []) as Message[];
      return arr.reverse(); // ascendente para UI
    },
  });

  const [messages, setMessages] = useState<Message[]>([]);
  // Keep a ref in sync to avoid stale closures in background loops
  const messagesRef = useRef<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Sincronizar página inicial
  useEffect(() => {
    if (initialPage) {
      setMessages(initialPage);
      // Determinar si hay más: si page llena, asumimos potencial más
      setHasMore(initialPage.length === PAGE_SIZE);
    }
  }, [initialPage]);

  // Keep ref synced with current messages
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const loadOlder = useCallback(async () => {
    if (!match || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const earliest = messages[0].created_at;
      const { data, error } = await supabase
        .from('messages')
        .select('id,match_id,sender,content,created_at')
        .eq('match_id', mid)
        .lt('created_at', earliest)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const olderDesc = (data || []) as Message[];
      const olderAsc = olderDesc.reverse();
      if (olderAsc.length > 0) {
        setMessages(prev => [...olderAsc, ...prev]);
      }
      if (olderAsc.length < PAGE_SIZE) setHasMore(false);
    } catch (e:any) {
      console.warn('loadOlder error', e.message);
    } finally {
      setLoadingOlder(false);
    }
  }, [match?.id, loadingOlder, hasMore, messages]);

  // 3b) Read info of other user (when they last read this match) to show receipts
  const { data: otherRead } = useQuery<{ last_read_at: string } | null>({
    enabled: !!otherUserId && !!match,
    queryKey: ['match-read', mid, otherUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_reads')
        .select('last_read_at')
        .eq('match_id', mid)
        .eq('user_id', otherUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 5000, // poll suave para receipts
  });

  // Grouping: compute once per messages change (must stay before any conditional returns to keep hook order stable)
  const GROUP_WINDOW_MS = 5 * 60 * 1000;
  const enhancedMessages = useMemo(() => {
    if (!messages) return [] as (Message & { showHeader: boolean })[];
    return messages.map((m, idx) => {
      if (idx === 0) return { ...m, showHeader: true };
      const prev = messages[idx - 1];
      const sameSender = prev.sender === m.sender;
      const closeInTime = Math.abs(new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < GROUP_WINDOW_MS;
      return { ...m, showHeader: !(sameSender && closeInTime) };
    });
  }, [messages]);

  // Manage controlled auto-scroll logic
  const initialAutoScrollDone = useRef(false);
  const justSentRef = useRef(false);

  // Mark when we send to force scroll
  const markJustSent = () => { justSentRef.current = true; };

  // Helper debounced mark-as-read
  const lastReadWrite = useRef<number>(0);
  const markRead = useCallback(async () => {
    if (!match || !user) return;
    const now = Date.now();
    if (now - lastReadWrite.current < 1500) return; // debounce 1.5s
    lastReadWrite.current = now;
    try {
      await supabase.from('match_reads')
        .upsert({ match_id: mid, user_id: user.id, last_read_at: new Date().toISOString() })
        .select();
      qc.invalidateQueries({ queryKey: ['matches-enriched3', user.id] });
      qc.invalidateQueries({ queryKey: ['unread-count', user.id] });
    } catch (e:any) {
      console.warn('Error markRead', e);
    }
  }, [match?.id, user?.id]);

  // 4) Marcar leído al entrar + cuando se agregan mensajes y estás abajo
  useEffect(() => { markRead(); }, [match?.id, user?.id]);
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (atBottomRef.current) markRead();
  }, [messages?.length]);

  // 5) Realtime: si llega mensaje nuevo en este match
  useEffect(() => {
    if (!mid) return;
    const ch = supabase
      .channel(`messages-${mid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${mid}` }, async (payload: any) => {
        const newMsg = payload.new as Message;
        // Append directly if not present
        setMessages(old => {
          if (!old) return [newMsg];
          if (old.some(m => m.id === newMsg.id)) return old;
          const arr = [...old, newMsg];
          arr.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return arr;
        });
        if (match && user && atBottomRef.current) {
          markRead();
        }
        // Auto-scroll if user was near bottom
        if (atBottomRef.current) {
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mid, match?.user_a, match?.user_b, user?.id]);

  // Fallback: focused polling for new messages in case Realtime is not delivering (e.g., table not enabled for Realtime)
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    let timer: any;
    async function tick() {
      try {
        if (!mid) return;
        const current = messagesRef.current;
        const last = current.length ? current[current.length - 1].created_at : null;
        let q = supabase
          .from('messages')
          .select('id,match_id,sender,content,created_at')
          .eq('match_id', mid)
          .order('created_at', { ascending: true })
          .limit(50);
        if (last) q = q.gt('created_at', last);
        const { data, error } = await q;
        if (cancelled || error) return;
        const incoming = (data || []) as Message[];
        if (incoming.length) {
          setMessages(old => {
            const merged = [...(old || [])];
            for (const m of incoming) if (!merged.some(x => x.id === m.id)) merged.push(m);
            merged.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return merged;
          });
          if (match && user && atBottomRef.current) markRead();
          if (atBottomRef.current) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        }
      } finally {
        if (!cancelled) timer = setTimeout(tick, 3000);
      }
    }
    timer = setTimeout(tick, 2500);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [mid, match?.id, user?.id]));

  // 6) Enviar mensaje (optimista) + actualizar last_message_at
  const send = useCallback(async () => {
    if (sending) return;
    let content = text.trim();
    if (!content || !user || !match) return;
    if (content.length > MAX_MESSAGE_LENGTH) {
      content = content.slice(0, MAX_MESSAGE_LENGTH);
    }
    setSending(true);

    const optimistic: Message = {
      id: -Date.now(),
      match_id: mid,
      sender: user.id,
      content,
      created_at: new Date().toISOString(),
    };
  setMessages(old => ([...(old || []), optimistic]));
  markJustSent();
    setText('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ match_id: mid, sender: user.id, content: optimistic.content })
        .select('*')
        .single();
      if (error) throw error;

      // DB trigger now updates matches.last_message_at automatically

      setMessages(old => old.map(m => m.id === optimistic.id ? (data as Message) : m));
      markRead();
    } catch (e: any) {
      setMessages(old => old.filter(m => m.id !== optimistic.id));
      Alert.alert('Error', e.message || 'Error');
    } finally {
      setSending(false);
    }
  }, [sending, text, user?.id, match?.id, mid]);

  const onScroll = useAnimatedScrollHandler({ onScroll: () => {} });

  if (loadingMatch || loadingMsgs) {
    return (
      <Screen style={{ padding:0 }}>
        <GradientScaffold>
          <View style={{ flex:1, paddingTop:16, alignItems:'center' }}>
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
          <View style={{ flex:1, paddingTop:16 }}>
            <Card style={{ margin:16 }}><Text style={{ color: theme.colors.text }}>Chat no encontrado.</Text></Card>
          </View>
        </GradientScaffold>
      </Screen>
    );
  }

  const otherName = (otherProfile?.display_name || 'Match').trim();
  const title = `${T.chatWith} ${otherName}`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 }) as number}
    >
      <Screen style={{ padding:0 }}>
        <GradientScaffold>
          <Animated.FlatList
            ref={listRef as any}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              const distanceFromBottom = contentHeightRef.current - ((scrollOffsetRef.current || 0) + layoutHeightRef.current);
              atBottomRef.current = distanceFromBottom < 120; // threshold px
            }}
            onLayout={(e) => { layoutHeightRef.current = e.nativeEvent.layout.height; }}
            onContentSizeChange={(w, h) => {
              contentHeightRef.current = h;
              const needsScroll = (
                (!initialAutoScrollDone.current && h > layoutHeightRef.current + 20) ||
                (atBottomRef.current && h > layoutHeightRef.current + 20) ||
                justSentRef.current
              );
              if (needsScroll) {
                requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
                initialAutoScrollDone.current = true;
                justSentRef.current = false;
              }
            }}
            scrollEventThrottle={16}
            data={enhancedMessages}
            keyExtractor={(m:any) => String(m.id)}
            refreshing={loadingOlder}
            onRefresh={() => loadOlder()}
            contentContainerStyle={{ paddingTop:8, paddingBottom: 80, paddingHorizontal:12 }}
            renderItem={({ item }: any) => {
              const mine = item.sender === user?.id;
              const isLastMine = mine && messages && messages[messages.length - 1]?.id === item.id;
              const otherLastReadAt = otherRead?.last_read_at ? new Date(otherRead.last_read_at).getTime() : 0;
              const thisCreated = new Date(item.created_at).getTime();
              const readByOther = isLastMine && otherLastReadAt >= thisCreated;
              return (
                <View style={{ paddingVertical: item.showHeader ? 8 : 2, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <View
                    style={{
                      maxWidth: '80%',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: mine ? theme.colors.primary : theme.colors.card,
                      borderWidth: 1,
                      borderColor: mine ? theme.colors.primary : theme.colors.border,
                    }}
                  >
                    {item.showHeader && (
                      <Text
                        style={{
                          color: mine ? theme.colors.primaryText : theme.colors.text,
                          fontWeight: '700',
                          marginBottom: 4,
                        }}
                      >
                        {mine ? T.you : otherName}
                      </Text>
                    )}
                    <Text style={{ color: mine ? theme.colors.primaryText : theme.colors.text }}>
                      {item.content}
                    </Text>
                    <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:4, gap:6 }}>
                      <Text
                        style={{
                          color: mine ? theme.colors.primaryText : theme.colors.subtext,
                          fontSize: 11,
                        }}
                      >
                        {formatTime(item.created_at, locale)}
                      </Text>
                      {mine && (
                        <Text style={{ fontSize:11, color: readByOther ? theme.colors.primaryText : theme.colors.subtext }}>
                          {readByOther ? '✓✓' : '✓'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Card>
                <Text style={{ color: theme.colors.text }}>
                  {T.empty} {otherName}!
                </Text>
              </Card>
            }
            ListHeaderComponent={
              <View>
                <View style={{ height: HEADER_SPACER }} />
                {hasMore && (
                  <Text
                    onPress={() => loadOlder()}
                    style={{ textAlign:'center', color: theme.colors.primary, fontWeight:'600', marginBottom:8 }}>
                    {loadingOlder ? (locale==='es' ? 'Cargando...' : 'Loading...') : (locale==='es' ? 'Cargar mensajes anteriores' : 'Load older messages')}
                  </Text>
                )}
              </View>
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
            onChangeText={(v) => setText(v.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder={T.placeholder}
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
            editable={!sending}
            returnKeyType="send"
          />
          <Button title={sending ? '...' : T.send} onPress={send} disabled={sending || !text.trim()} />
          </View>
        </GradientScaffold>
      </Screen>
    </KeyboardAvoidingView>
  );
}
