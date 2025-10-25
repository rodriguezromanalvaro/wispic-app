import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, FlatList, ActivityIndicator, Image } from 'react-native';
import { useAttendeesSheetStore } from '../../lib/stores/attendeesSheet';
import { theme } from '../../lib/theme';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { useRouter } from 'expo-router';

// Simple sheet (Modal) listing up to N attendees with avatar + name (fallback initial)
// Optimized for quick social proof; full actions remain in people screen.
export const AttendeesSheet: React.FC = () => {
  const open = useAttendeesSheetStore(s=>s.open);
  const eventId = useAttendeesSheetStore(s=>s.eventId);
  const close = useAttendeesSheetStore(s=>s.close);
  const router = useRouter();

  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    enabled: open && !!eventId,
    queryKey: ['attendees-preview', eventId],
    queryFn: async () => {
      // 1) Get attendance user ids (limit large-ish to keep preview light)
      const { data: attendanceRows, error: attErr } = await supabase
        .from('event_attendance')
        .select('user_id')
        .eq('event_id', eventId)
  .eq('status','going')
        .limit(80);
      if (attErr) throw attErr;
      const ids = Array.from(new Set((attendanceRows || []).map(r => r.user_id)));
      if (!ids.length) return [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
      // 2) Fetch profiles for those ids
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ids);
      if (profErr) throw profErr;
      const list = (profs || []).map(p => ({ id: p.id, display_name: (p as any).display_name || null, avatar_url: (p as any).avatar_url || null }));
      // Always ensure current user appears if present in attendance but profile query failed to include (edge case)
      if (user && ids.includes(user.id) && !list.find(l => l.id === user.id)) {
        list.unshift({ id: user.id, display_name: 'Tú', avatar_url: null });
      }
      return list;
    }
  });

  const attendees = useMemo(() => {
    const base = (data || []).map(u => ({
      ...u,
      isMe: user?.id === u.id,
      displayLabel: user?.id === u.id ? 'Tú' : (u.display_name || 'Sin nombre')
    }));
    return base.sort((a,b) => {
      if(a.isMe && !b.isMe) return -1; // yo primero
      if(b.isMe && !a.isMe) return 1;
      return a.displayLabel.localeCompare(b.displayLabel);
    });
  }, [data, user?.id]);

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <Pressable onPress={close} style={{ flex:1, backgroundColor: theme.colors.overlay }} />
      <View style={{ position:'absolute', left:0, right:0, bottom:0, maxHeight:'70%', backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius:24, padding:16, gap:12 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ color: theme.colors.text, fontSize:16, fontWeight:'700' }}>Asistentes</Text>
          <Pressable onPress={close}>
            <Text style={{ color: theme.colors.primary }}>Cerrar</Text>
          </Pressable>
        </View>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop:16 }} />
        ) : error ? (
          <Text style={{ color: theme.colors.danger }}>Error al cargar asistentes</Text>
        ) : attendees.length === 0 ? (
          <Text style={{ color: theme.colors.textDim }}>Aún no hay asistentes.</Text>
        ) : (
          <FlatList
            data={attendees}
            keyExtractor={u=>u.id}
            style={{ maxHeight: 260 }}
            renderItem={({ item }) => {
              const isMe = (item as any).isMe;
              return (
                <View style={{ flexDirection:'row', alignItems:'center', paddingVertical:6 }}>
                  <View style={{ width:36, height:36, borderRadius:18, backgroundColor: theme.colors.bgAlt, overflow:'hidden', justifyContent:'center', alignItems:'center', marginRight:10, borderWidth:1, borderColor: theme.colors.border }}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={{ color: theme.colors.text, fontWeight:'700' }}>{(item.displayLabel||'?').charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={{ color: theme.colors.text, flex:1 }} numberOfLines={1}>{(item as any).displayLabel}</Text>
                  {isMe && (
                    <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal:8, paddingVertical:4, borderRadius:12, marginLeft:8 }}>
                      <Text style={{ color: theme.colors.white, fontSize:11, fontWeight:'700' }}>Tú</Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}
        {/* CTA legacy eliminado para reducir ruido */}
      </View>
    </Modal>
  );
};
