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
  Image,
  Pressable,
  LayoutChangeEvent,
  BackHandler,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';

import EmptyState from 'components/EmptyState';
import { Screen, Card } from 'components/ui';
import { pickEmptyPrompt } from 'features/chat/emptyPrompts';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { Profile } from 'lib/types';
import { useAuth } from 'lib/useAuth';

// Types

type MatchRow = {
  id: number;
  user_a: string;
  user_b: string;
  superlike: boolean;
  last_message_at: string | null;
  created_by_like_id?: number | null;
};

type Message = {
  id: number;
  match_id: number;
  sender: string;
  content: string;
  created_at: string;
  client_msg_id?: string | null;
};

// --- Helpers & i18n (simple local) ---
const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 40;

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
    placeholder: 'Message',
    empty: 'No messages yet. Say hi to',
    chatWith: 'Chat with',
    loadingChat: 'Chat',
  },
  es: {
    you: 'Tú',
    send: 'Enviar',
    placeholder: 'Mensaje',
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [, setComposerHeight] = useState(60);
  const [headerHeight, setHeaderHeight] = useState(56);
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const locale = detectLocale();
  const T = STRINGS[locale];

  // Scroll tracking refs
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const atBottomRef = useRef(true);

  // 1) Load match
  const { data: match, isLoading: loadingMatch } = useQuery<MatchRow | null>({
    enabled: !!user && Number.isFinite(mid),
    queryKey: ['match', mid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id,user_a,user_b,superlike,last_message_at,created_by_like_id')
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

  // 2) Other profile
  const { data: otherProfile } = useQuery<Profile | null>({
    enabled: !!otherUserId,
    queryKey: ['profile', otherUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url')
        .eq('id', otherUserId!)
        .maybeSingle();
      return (data as Profile) ?? null;
    },
  });

  // 2b) Superlike direction
  const { data: superlikeDirection } = useQuery<{ fromMe: boolean; fromOther: boolean } | null>({
    enabled: !!otherUserId && !!match?.superlike,
    queryKey: ['superlike-direction', otherUserId, match?.id, match?.created_by_like_id],
    queryFn: async () => {
      if (!otherUserId || !user?.id) return null;
      try {
        const orExpr = `and(liker.eq.${user.id},liked.eq.${otherUserId}),and(liker.eq.${otherUserId},liked.eq.${user.id})`;
        const { data: rows } = await supabase
          .from('likes')
          .select('liker,liked,type')
          .or(orExpr)
          .eq('type', 'superlike');
        let fromMe = false, fromOther = false;
        for (const r of (rows || []) as any[]) {
          if (r.liker === user.id && r.liked === otherUserId) fromMe = true;
          if (r.liker === otherUserId && r.liked === user.id) fromOther = true;
        }
        // Fallback via created_by_like_id
        if (!fromMe && !fromOther && match?.created_by_like_id) {
          const { data: like } = await supabase
            .from('likes')
            .select('liker')
            .eq('id', match.created_by_like_id as number)
            .maybeSingle();
          const liker = (like as any)?.liker as string | undefined;
          if (liker) {
            if (liker === user.id) fromMe = true; else if (liker === otherUserId) fromOther = true;
          }
        }
        return { fromMe, fromOther };
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60,
  });

  // 3) Messages (paged)
  const { data: initialPage, isLoading: loadingMsgs } = useQuery<Message[]>({
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
      return arr.reverse();
    },
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    if (initialPage) {
      setMessages(initialPage);
      setHasMore(initialPage.length === PAGE_SIZE);
    }
  }, [initialPage]);

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
    refetchInterval: 1200,
  });

  useEffect(() => {
    if (!mid || !otherUserId) return;
    const channel = supabase
      .channel(`match-read-${mid}-${otherUserId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_reads', filter: `match_id=eq.${mid}` }, (payload: any) => {
        if (payload.new?.user_id && payload.new.user_id !== user?.id) {
          qc.invalidateQueries({ queryKey: ['match-read', mid, payload.new.user_id] });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_reads', filter: `match_id=eq.${mid}` }, (payload: any) => {
        if (payload.new?.user_id && payload.new.user_id !== user?.id) {
          qc.invalidateQueries({ queryKey: ['match-read', mid, payload.new.user_id] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mid, otherUserId]);

  const GROUP_WINDOW_MS = 5 * 60 * 1000;
  const enhancedMessages = useMemo(() => {
    if (!messages) return [] as (Message & { showHeader: boolean })[];
    const seen = new Set<number>();
    const base: Message[] = [];
    for (const m of messages) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      base.push(m);
    }
    return base.map((m, idx) => {
      if (idx === 0) return { ...m, showHeader: true };
      const prev = base[idx - 1];
      const sameSender = prev.sender === m.sender;
      const closeInTime = Math.abs(new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < GROUP_WINDOW_MS;
      return { ...m, showHeader: !(sameSender && closeInTime) };
    });
  }, [messages]);

  const initialAutoScrollDone = useRef(false);
  const justSentRef = useRef(false);
  const initialBottomingRef = useRef<{ done: boolean; attempts: number }>({ done: false, attempts: 0 });
  const MAX_INITIAL_BOTTOM_ATTEMPTS = 6;

  const ensureInitialBottom = useCallback(() => {
    if (initialBottomingRef.current.done) return;
    const contentH = contentHeightRef.current;
    const layoutH = layoutHeightRef.current;
    if (!contentH || !layoutH) return;
    const distance = contentH - ((scrollOffsetRef.current || 0) + layoutH);
    const overflow = contentH - layoutH;
    if (overflow <= 4 || distance <= 4) {
      initialBottomingRef.current.done = true;
      return;
    }
    try { listRef.current?.scrollToEnd({ animated: false }); } catch {}
    initialBottomingRef.current.attempts += 1;
    if (initialBottomingRef.current.attempts >= MAX_INITIAL_BOTTOM_ATTEMPTS) {
      const dist2 = contentHeightRef.current - ((scrollOffsetRef.current || 0) + layoutHeightRef.current);
      if (dist2 > 12) {
        try { listRef.current?.scrollToEnd({ animated: true }); } catch {}
      }
      initialBottomingRef.current.done = true;
    } else {
      requestAnimationFrame(() => ensureInitialBottom());
    }
  }, []);

  const markJustSent = () => { justSentRef.current = true; };

  const lastReadWrite = useRef<number>(0);
  const markRead = useCallback(async () => {
    if (!match || !user) return;
    const now = Date.now();
    if (now - lastReadWrite.current < 1500) return;
    lastReadWrite.current = now;
    try {
      await supabase.from('match_reads')
        .upsert({ match_id: mid, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'match_id,user_id' })
        .select();
      qc.invalidateQueries({ queryKey: ['matches-enriched-unread', user.id] });
      qc.invalidateQueries({ queryKey: ['unread-count', user.id] });
    } catch (e:any) {
      console.warn('Error markRead', e);
    }
  }, [match?.id, user?.id]);

  const markReadImmediate = useCallback(async () => {
    if (!match || !user) return;
    try {
      await supabase.from('match_reads')
        .upsert({ match_id: mid, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'match_id,user_id' })
        .select();
      qc.invalidateQueries({ queryKey: ['matches-enriched-unread', user.id] });
      qc.invalidateQueries({ queryKey: ['unread-count', user.id] });
    } catch (e:any) {
      console.warn('Error markReadImmediate', e);
    }
  }, [match?.id, user?.id]);

  useEffect(() => { markRead(); }, [match?.id, user?.id]);
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const list = await Notifications.getPresentedNotificationsAsync();
        const toDismiss = (list || []).filter((n: any) => {
          const d = (n?.request?.content?.data || {}) as any;
          const t = d?.type;
          const m = Number(typeof d?.match_id === 'string' ? Number(d.match_id) : d?.match_id);
          return t === 'message' && Number.isFinite(m) && m === mid;
        });
        for (const n of toDismiss) {
          if (cancelled) break;
          await Notifications.dismissNotificationAsync(n.request.identifier);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [mid]));
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (atBottomRef.current) markRead();
  }, [messages?.length]);

  useFocusEffect(useCallback(() => {
    return () => { markReadImmediate(); };
  }, [markReadImmediate]));

  // Ensure Android hardware back returns to chat list instead of previous tab
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      try { router.replace('/(tabs)/chat'); } catch {}
      return true; // prevent default back
    });
    return () => { sub.remove(); };
  }, [router]));

  useEffect(() => {
    if (!mid) return;
    const ch = supabase
      .channel(`chat-${mid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${mid}` }, async (payload: any) => {
        const newMsg = payload.new as Message;
        setMessages(old => {
          const list = [...(old || [])];
          if (list.some(m => m.id === newMsg.id)) return list;
          if (newMsg.client_msg_id) {
            const byClientId = list.findIndex(m => m.client_msg_id && m.client_msg_id === newMsg.client_msg_id);
            if (byClientId >= 0) {
              list[byClientId] = newMsg;
              list.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              return list;
            }
          }
          const idx = list.findIndex(m => m.id < 0 && m.sender === newMsg.sender && m.content === newMsg.content && Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 10000);
          if (idx >= 0) {
            list[idx] = newMsg;
          } else {
            list.push(newMsg);
          }
          list.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return list;
        });
        if (match && user && atBottomRef.current) {
          markRead();
        }
        if (atBottomRef.current) {
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_reads', filter: `match_id=eq.${mid}` }, (payload: any) => {
        if (payload.new?.user_id && payload.new.user_id !== user?.id) {
          qc.invalidateQueries({ queryKey: ['match-read', mid, payload.new.user_id] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mid, match?.user_a, match?.user_b, user?.id]);

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

  const send = useCallback(async () => {
    if (sending) return;
    let content = text.trim();
    if (!content || !user || !match) return;
    inputRef.current?.focus();
    if (content.length > MAX_MESSAGE_LENGTH) {
      content = content.slice(0, MAX_MESSAGE_LENGTH);
    }
    setSending(true);

    const clientId = uuidv4();
    const optimistic: Message = {
      id: -Date.now(),
      match_id: mid,
      sender: user.id,
      content,
      created_at: new Date().toISOString(),
      client_msg_id: clientId,
    };
    setMessages(old => ([...(old || []), optimistic]));
    markJustSent();
    setText('');
    requestAnimationFrame(() => inputRef.current?.focus());
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    try {
      let data: any = null;
      let error: any = null;
      try {
        const rpc = await supabase.rpc('send_message_idempotent', {
          p_match_id: mid,
          p_sender: user.id,
          p_content: optimistic.content,
          p_client_msg_id: clientId,
        });
        if (rpc.error) {
          error = rpc.error;
        } else {
          data = rpc.data;
        }
      } catch (e: any) {
        error = e;
      }
      if (!data && error) {
        const ins = await supabase
          .from('messages')
          .insert({ match_id: mid, sender: user.id, content: optimistic.content, client_msg_id: clientId })
          .select('*')
          .single();
        data = ins.data;
        error = ins.error;
      }
      if (error) throw error;

      setMessages(old => {
        const list = [...(old || [])];
        const withoutOptimistic = list.filter(m => m.id !== optimistic.id);
        if (withoutOptimistic.some(m => m.id === (data as Message).id || (!!(data as Message).client_msg_id && m.client_msg_id === (data as Message).client_msg_id))) {
          return withoutOptimistic;
        }
        const next = [...withoutOptimistic, (data as Message)];
        next.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return next;
      });
      markRead();
    } catch (e: any) {
      setMessages(old => old.filter(m => m.id !== optimistic.id));
      Alert.alert('Error', e.message || 'Error');
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [sending, text, user?.id, match?.id, mid]);

  const handlePressSend = useCallback(() => {
    inputRef.current?.focus();
    if (showEmojiPicker) setShowEmojiPicker(false);
    send();
  }, [send, showEmojiPicker]);

  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    t = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => { if (t) clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [messages.length]);

  if (loadingMatch || loadingMsgs) {
    return (
      <Screen style={{ padding:0 }} edges={['top']}>
        <View style={{ flex:1, backgroundColor: theme.colors.bg }}>
          <View style={{ flex:1, paddingTop:16, alignItems:'center' }}>
            <ActivityIndicator style={{ marginTop:40 }} color={theme.colors.primary} />
          </View>
        </View>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen style={{ padding:0 }} edges={[]}>
        <View style={{ flex:1, backgroundColor: theme.colors.bg }}>
          <View style={{ flex:1, paddingTop:16 }}>
            <Card style={{ margin:16 }}><Text style={{ color: theme.colors.text }}>Chat no encontrado.</Text></Card>
          </View>
        </View>
      </Screen>
    );
  }

  const otherName = (otherProfile?.display_name || 'Match').trim();
  const avatarUrl = otherProfile?.avatar_url || null;
  const starFromOther = !!(match?.superlike && superlikeDirection?.fromOther);
  const starFromMe = !!(match?.superlike && superlikeDirection?.fromMe);

  const onHeaderLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h && Math.abs(h - headerHeight) > 2) setHeaderHeight(h);
  };

  const InnerHeader = (
    <View onLayout={onHeaderLayout} style={{ flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:12, paddingVertical:12, paddingTop:16 + insets.top, borderBottomWidth:1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgAlt }}>
      <Pressable onPress={() => router.replace('/(tabs)/chat')} hitSlop={10} style={{ padding:4 }}>
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </Pressable>
      <View style={{ width:36, height:36, borderRadius:18, overflow:'hidden', backgroundColor: theme.colors.card, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor: theme.colors.border }}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width:'100%', height:'100%' }} resizeMode="cover" />
        ) : (
          <Text style={{ color: theme.colors.text, fontWeight:'800' }}>{otherName.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex:1 }}>
        <View style={{ position:'relative', overflow:'hidden' }}>
          <Text style={{ color: theme.colors.text, fontWeight:'800', fontSize:22, letterSpacing:0.5 }} numberOfLines={1}>
            {otherName}
          </Text>
          <LinearGradient
            pointerEvents="none"
            colors={[ 'rgba(0,0,0,0)', theme.colors.bgAlt ]}
            start={{ x:0, y:0 }} end={{ x:1, y:0 }}
            style={{ position:'absolute', right:0, top:0, bottom:0, width:24 }}
          />
        </View>
        {match?.superlike && (
          <View style={{ flexDirection:'row', gap:8, marginTop:2 }}>
            {starFromOther && <Text style={{ color:'#F59E0B', fontWeight:'900', fontSize:12 }}>⭐ Te dio superlike</Text>}
            {starFromMe && <Text style={{ color: theme.colors.primary, fontWeight:'900', fontSize:12 }}>⭐ Diste superlike</Text>}
            {!starFromOther && !starFromMe && <Text style={{ color:'#F59E0B', fontWeight:'900', fontSize:12 }}>⭐ Superlike</Text>}
          </View>
        )}
      </View>
    </View>
  );

  const listContentPaddingBottom = 12 + (Platform.OS === 'ios' ? insets.bottom : 0);

  const ListComponent = (
    <Animated.FlatList
      ref={listRef as any}
      ListHeaderComponent={Platform.OS === 'android' ? undefined : InnerHeader}
      stickyHeaderIndices={Platform.OS === 'android' ? [] : [0]}
      onScroll={(e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        const distanceFromBottom = contentHeightRef.current - ((scrollOffsetRef.current || 0) + layoutHeightRef.current);
        atBottomRef.current = distanceFromBottom < 120;
      }}
      onLayout={(e) => { layoutHeightRef.current = e.nativeEvent.layout.height; }}
      onContentSizeChange={(_w, h) => {
        contentHeightRef.current = h;
        if (!initialBottomingRef.current.done && messagesRef.current.length >= 3) {
          if (!initialAutoScrollDone.current) {
            initialAutoScrollDone.current = true;
            requestAnimationFrame(() => ensureInitialBottom());
            return;
          } else {
            requestAnimationFrame(() => ensureInitialBottom());
            return;
          }
        }
        const extend = ((atBottomRef.current && h > layoutHeightRef.current + 20) || justSentRef.current);
        if (extend) {
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
          justSentRef.current = false;
        }
      }}
      scrollEventThrottle={16}
      data={enhancedMessages}
      keyExtractor={(m:any, idx:number) => `${m.id}_${new Date(m.created_at).getTime()}_${idx}`}
      refreshing={loadingOlder}
      onRefresh={() => loadOlder()}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: listContentPaddingBottom, paddingHorizontal:12 }}
      renderItem={({ item }: any) => {
        const mine = item.sender === user?.id;
        const otherLastReadAt = otherRead?.last_read_at ? new Date(otherRead.last_read_at).getTime() : 0;
        const thisCreated = new Date(item.created_at).getTime();
        const readByOther = mine && otherLastReadAt >= thisCreated;
        return (
          <View style={{ paddingVertical: 1, alignItems: mine ? 'flex-end' : 'flex-start' }}>
            <Pressable
              onPress={() => {
                if (showEmojiPicker) setShowEmojiPicker(false);
                inputRef.current?.focus();
              }}
              style={({ pressed }) => [
                {
                  maxWidth: '78%',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 14,
                  backgroundColor: mine ? theme.colors.primary : theme.colors.card,
                  borderWidth: 1,
                  borderColor: mine ? theme.colors.primary : theme.colors.border,
                  position: 'relative',
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: mine ? theme.colors.primaryText : theme.colors.text, fontSize: 14, lineHeight: 18 }}>
                {item.content}{' '}
                <Text style={{ color: mine ? 'rgba(255,255,255,0.65)' : theme.colors.subtext, fontSize:10 }}>
                  {formatTime(item.created_at, locale)}
                </Text>
                {mine && (
                  <Text style={{ fontSize:10, color: readByOther ? '#3B82F6' : '#FFFFFF' }}>
                    {readByOther ? ' ✓✓' : ' ✓'}
                  </Text>
                )}
              </Text>
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          title={locale === 'es' ? 'Aún no hay mensajes' : 'No messages yet'}
          subtitle={pickEmptyPrompt({ name: otherName, locale: (locale === 'es' ? 'es' : 'en'), matchId: mid })}
          ctaLabel={locale === 'es' ? 'Saludar' : 'Say hi'}
          onPressCta={() => {
            try { inputRef.current?.focus(); } catch {}
          }}
          iconName="chatbubbles-outline"
          style={{ paddingTop: 24 }}
        />
      }
    />
  );

  const Composer = (
    <View
      onLayout={e => setComposerHeight(e.nativeEvent.layout.height)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.bgAlt,
      }}
    >
      <Pressable onPress={() => setShowEmojiPicker(v => !v)} hitSlop={8} style={{ padding:4 }}>
        <Ionicons name={showEmojiPicker ? 'close' : 'happy-outline'} size={22} color={theme.colors.text} />
      </Pressable>
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
          paddingVertical: Platform.select({ ios: 10, default: 8 }),
          minHeight: 40,
          maxHeight: 180,
          textAlignVertical: 'top',
        }}
        onFocus={() => {
          if (showEmojiPicker) setShowEmojiPicker(false);
          requestAnimationFrame(() => {
            const distance = contentHeightRef.current - ((scrollOffsetRef.current || 0) + layoutHeightRef.current);
            if (distance < 200) listRef.current?.scrollToEnd({ animated: true });
          });
        }}
        multiline
        selection={selection}
        onSelectionChange={(e) => {
          const { start, end } = e.nativeEvent.selection; setSelection({ start, end });
        }}
        blurOnSubmit={true}
        editable
        returnKeyType={Platform.OS === 'ios' ? 'default' : 'default'}
        autoFocus={Platform.OS === 'ios'}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Enter') {
            // keep newline behavior
          }
        }}
        onContentSizeChange={(e) => {
          const h = e.nativeEvent.contentSize.height;
          if (h && h < 180) {
            requestAnimationFrame(() => {
              const distance = contentHeightRef.current - ((scrollOffsetRef.current || 0) + layoutHeightRef.current);
              if (distance < 200) listRef.current?.scrollToEnd({ animated: true });
            });
          }
        }}
      />
      <Pressable
        onPress={handlePressSend}
        disabled={sending || !text.trim()}
        hitSlop={8}
        style={({ pressed }) => [
          {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: (sending || !text.trim()) ? theme.colors.border : theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          },
          sending && { opacity: 0.7 },
        ]}
      >
        {sending ? (
          <ActivityIndicator size="small" color={theme.colors.primaryText} />
        ) : (
          <Ionicons
            name={Platform.OS === 'ios' ? 'paper-plane' : 'send'}
            size={20}
            color={(sending || !text.trim()) ? theme.colors.text : theme.colors.primaryText}
            style={Platform.OS === 'ios' ? { transform: [{ rotate: '-5deg' }] } : undefined}
          />
        )}
      </Pressable>
    </View>
  );

  const EmojiPanel = showEmojiPicker ? (
    <View style={{ borderTopWidth:1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgAlt, paddingVertical:8 }}>
      <View style={{ flexDirection:'row', flexWrap:'wrap', paddingHorizontal:8 }}>
        {EMOJIS.map(e => (
          <Pressable key={e} onPress={() => {
            setText(prev => {
              const { start, end } = selection;
              const before = prev.slice(0, start);
              const after = prev.slice(end);
              const next = before + e + after;
              const caret = before.length + e.length;
              setTimeout(() => setSelection({ start: caret, end: caret }), 0);
              return next.slice(0, MAX_MESSAGE_LENGTH);
            });
          }} style={{ padding:6 }}>
            <Text style={{ fontSize:24 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  ) : null;

  const AndroidBody = (
  <KeyboardAvoidingView style={{ flex:1 }} behavior="padding" >
      <Screen style={{ padding:0 }} edges={[]}>
        <View style={{ flex:1, backgroundColor: theme.colors.bg }}>
          <View style={{ flex:1 }}>
            {InnerHeader}
            <View style={{ flex:1 }}>
              {ListComponent}
            </View>
            {Composer}
            {EmojiPanel}
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );

  const IOSBody = (
    <Screen style={{ padding:0 }} edges={[]}>
      <View style={{ flex:1, backgroundColor: theme.colors.bg }}>
        <View style={{ flex:1 }}>
          {ListComponent}
          {hasMore && (
            <Text
              onPress={() => loadOlder()}
              style={{ textAlign:'center', color: theme.colors.primary, fontWeight:'600', marginTop:8, marginBottom:8 }}>
              {loadingOlder ? (locale==='es' ? 'Cargando...' : 'Loading...') : (locale==='es' ? 'Cargar mensajes anteriores' : 'Load older messages')}
            </Text>
          )}
          {Composer}
          {EmojiPanel}
        </View>
      </View>
    </Screen>
  );

  if (Platform.OS === 'ios') {
    return (
  <KeyboardAvoidingView style={{ flex:1 }} behavior="padding" keyboardVerticalOffset={64}>
        {IOSBody}
      </KeyboardAvoidingView>
    );
  }
  return AndroidBody;
}

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','😇','🤔','🤨','😅','🙃','🙂','😉','😏','😴','😢','😭','😡','👍','👎','🙏','👏','🔥','💯','💪','🎉','🥳','❤️','💔','💜','🧡','💙','💚','🤍','🤎','🖤','⭐','🌟','⚡','☀️','🌙','🍀','🍕','🍔','🍟','🍺','🏀','⚽','🎮','🎧','📷','💻'
];
