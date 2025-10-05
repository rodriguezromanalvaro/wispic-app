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
  TouchableOpacity,
  Image,
  Animated,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { Screen, Card } from '../../../components/ui';
import TopBar from '../../../components/TopBar';
import { theme } from '../../../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  
  // Animation states
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

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
        .select('id,display_name,avatar_url')
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
      
      // Start animation after loading messages
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
      
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${mid}` }, async (payload) => {
        if (payload.new && payload.new.sender !== user?.id) {
          // Placeholder for animation logic
        }
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
    setIsTyping(false);
    
    // Scroll to bottom when sending a message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

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
  
  // Formato de fecha
  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Agrupar mensajes por día
  const groupedMessages = useMemo(() => {
    if (!messages) return [];
    
    const groups: {date: string, messages: Message[]}[] = [];
    let currentDate = '';
    let currentGroup: Message[] = [];
    
    messages.forEach(message => {
      const messageDate = new Date(message.created_at).toLocaleDateString();
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({
            date: currentDate,
            messages: [...currentGroup]
          });
          currentGroup = [];
        }
        currentDate = messageDate;
      }
      
      currentGroup.push(message);
    });
    
    // Add the last group
    if (currentGroup.length > 0) {
      groups.push({
        date: currentDate,
        messages: [...currentGroup]
      });
    }
    
    return groups;
  }, [messages]);

  // Helper to determine if a message is the first in a sequence from the same sender
  const isFirstInSequence = (index: number, messages: Message[]) => {
    if (index === 0) return true;
    return messages[index].sender !== messages[index - 1].sender;
  };
  
  // Helper to determine if a message is the last in a sequence from the same sender
  const isLastInSequence = (index: number, messages: Message[]) => {
    if (index === messages.length - 1) return true;
    return messages[index].sender !== messages[index + 1].sender;
  };

  if (loadingMatch || loadingMsgs) {
    return (
      <Screen>
        <TopBar title="Cargando chat..." onBack={() => router.replace('/(tabs)/chat')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Cargando conversación...</Text>
        </View>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen>
        <TopBar title="Chat" onBack={() => router.replace('/(tabs)/chat')} />
        <View style={styles.errorContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={60} color={theme.colors.subtext} />
          <Text style={styles.errorTitle}>Chat no encontrado</Text>
          <Text style={styles.errorText}>Esta conversación ya no está disponible</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.replace('/(tabs)/chat')}
          >
            <Text style={styles.backButtonText}>Volver a chats</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const otherName = (otherProfile?.display_name || 'Match').trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 84, android: 0 }) as number}
    >
      <Screen>
        {/* Chat Header with Profile Info */}
        <TopBar 
          title={otherName} 
          onBack={() => router.replace('/(tabs)/chat')} 
        />
        
        {/* Profile Info Bar */}
        <View style={styles.profileInfoBar}>
          <View style={styles.profileContainer}>
            {otherProfile?.avatar_url ? (
              <Image 
                source={{ uri: otherProfile.avatar_url }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={[styles.profileImage, styles.profileImageFallback]}>
                <Text style={styles.profileInitial}>
                  {otherName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{otherName}</Text>
              <Text style={styles.profileStatus}>En línea</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.profileAction}>
            <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <Animated.View 
          style={[
            styles.messagesContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <FlatList
            ref={flatListRef}
            data={groupedMessages}
            keyExtractor={(group) => group.date}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item: group }) => (
              <View>
                {/* Date Header */}
                <View style={styles.dateHeader}>
                  <View style={styles.dateHeaderLine} />
                  <Text style={styles.dateHeaderText}>
                    {new Date(group.date).toLocaleDateString(undefined, {
                      weekday: 'long', 
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </Text>
                  <View style={styles.dateHeaderLine} />
                </View>
                
                {/* Messages in this group */}
                {group.messages.map((msg: any, idx: number) => {
                  const isMine = msg.sender === user?.id;
                  const isFirst = isFirstInSequence(idx, group.messages);
                  const isLast = isLastInSequence(idx, group.messages);
                  
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.messageRow,
                        isMine ? styles.myMessageRow : styles.theirMessageRow,
                        !isFirst && !isLast && { marginTop: 2 }
                      ]}
                    >
                      {/* Avatar (only on first message in a sequence) */}
                      {!isMine && isFirst && (
                        <View style={styles.messageAvatar}>
                          {otherProfile?.avatar_url ? (
                            <Image 
                              source={{ uri: otherProfile.avatar_url }} 
                              style={styles.messageAvatarImage}
                            />
                          ) : (
                            <View style={[styles.messageAvatarImage, styles.messageAvatarFallback]}>
                              <Text style={styles.avatarInitial}>{otherName.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      
                      {/* Spacer for my messages */}
                      {isMine && isFirst && <View style={styles.spacer} />}
                      
                      {/* Message Bubble */}
                      <View 
                        style={[
                          styles.messageBubble,
                          isMine ? styles.myMessageBubble : styles.theirMessageBubble,
                          isFirst && (isMine ? styles.myFirstBubble : styles.theirFirstBubble),
                          isLast && (isMine ? styles.myLastBubble : styles.theirLastBubble),
                        ]}
                      >
                        <Text style={[
                          styles.messageText,
                          isMine ? styles.myMessageText : styles.theirMessageText
                        ]}>
                          {msg.content}
                        </Text>
                        <Text style={[
                          styles.messageTime, 
                          isMine ? styles.myMessageTime : styles.theirMessageTime
                        ]}>
                          {formatMessageTime(msg.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          />
        </Animated.View>

        {/* Message Input */}
        <View style={[styles.inputContainer, {paddingBottom: insets.bottom ? insets.bottom : 16}]}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(value) => {
              setText(value);
              setIsTyping(value.trim().length > 0);
            }}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={theme.colors.subtext}
            multiline
            style={styles.input}
          />
          
          <TouchableOpacity 
            style={[
              styles.sendButton,
              !isTyping && styles.sendButtonDisabled
            ]} 
            onPress={send}
            disabled={!isTyping}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={isTyping ? "#fff" : theme.colors.subtext} 
            />
          </TouchableOpacity>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: theme.colors.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: 30,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  profileInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  profileImageFallback: {
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  profileStatus: {
    fontSize: 12,
    color: '#4FCC94',
  },
  profileAction: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  messagesList: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dateHeaderText: {
    fontSize: 12,
    color: theme.colors.subtext,
    marginHorizontal: 10,
    textTransform: 'uppercase',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
    marginHorizontal: 10,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 34,
    height: 34,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  messageAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  messageAvatarFallback: {
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    width: 42, // width of avatar + margin
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: theme.colors.card,
    borderBottomLeftRadius: 4,
  },
  myFirstBubble: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 4,
  },
  theirFirstBubble: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 4,
  },
  myLastBubble: {
    borderBottomRightRadius: 18,
  },
  theirLastBubble: {
    borderBottomLeftRadius: 18,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: theme.colors.text,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  theirMessageTime: {
    color: theme.colors.subtext,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 100,
    color: theme.colors.text,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
});