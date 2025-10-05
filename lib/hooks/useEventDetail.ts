import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface PresenceRow { verified_count:number; manual_count:number; present_count:number; last_sample_at:string|null }

interface Options { enabled?: boolean }

export function useEventDetail(eventId: number | null, opts: Options = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const enabled = !!eventId && (opts.enabled ?? true);

  const [event, setEvent] = useState<any>(null);
  const [going, setGoing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastCheckInAt, setLastCheckInAt] = useState<number | null>(null);
  const [presence, setPresence] = useState<PresenceRow | null>(null);

  // Load base event + attendance
  useEffect(()=>{
    if(!enabled) return;
    let alive = true;
    (async()=>{
      setLoading(true);
      const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
      if(!alive) return;
      setEvent(ev||null);
      if(user && ev){
        const { data: att } = await supabase.from('event_attendance').select('event_id').eq('event_id', eventId).eq('user_id', user.id).eq('status','going').maybeSingle();
        if(!alive) return;
        setGoing(!!att);
      } else {
        setGoing(false);
      }
      setLoading(false);
    })();
    return ()=>{ alive=false; };
  }, [eventId, user?.id, enabled]);

  // Presence polling
  useEffect(()=>{
    if(!enabled) return;
    let alive = true;
    const load = async()=>{
      const { data, error } = await supabase.rpc('get_event_presence', { event_ids: [eventId], recent_minutes: 90 });
      if(!alive) return;
      if(error){ setPresence(null); return; }
      if(Array.isArray(data) && data.length>0){
        const row:any = data[0];
        setPresence({
          verified_count: row.verified_count ?? 0,
          manual_count: row.manual_count ?? 0,
            present_count: Number(row.present_count ?? 0),
          last_sample_at: row.last_sample_at ?? null
        });
      } else {
        setPresence({ verified_count:0, manual_count:0, present_count:0, last_sample_at:null });
      }
    };
    load();
    const t = setInterval(load, 60*1000);
    return ()=>{ alive=false; clearInterval(t); };
  }, [eventId, enabled]);

  const presenceLabel = useMemo(()=>{
    const pc = presence?.present_count ?? 0;
    if (pc <= 2) return { text: 'Tranquilo', color: '#4caf50' };
    if (pc <= 6) return { text: 'Normal', color: '#ffb300' };
    if (pc <= 12) return { text: 'Lleno', color: '#fb8c00' };
    return { text: 'A tope', color: '#e53935' };
  }, [presence?.present_count]);

  async function toggleGoing() {
    if(!user || !eventId) return;
    if(going){
      const { error } = await supabase.from('event_attendance').delete().match({ event_id:eventId, user_id:user.id, status:'going' });
      if(!error) setGoing(false);
    } else {
      const { error } = await supabase.from('event_attendance').upsert({ event_id:eventId, user_id:user.id, status:'going' }, { onConflict:'event_id,user_id' });
      if(!error) setGoing(true);
    }
    if(user){
      qc.invalidateQueries({ queryKey: ['events-all', user.id] });
      qc.invalidateQueries({ queryKey: ['my-feed-events-with-pending', user.id] });
    }
  }

  async function checkIn() {
    if(!user || !eventId) return;
    const now = Date.now();
    if(lastCheckInAt && now - lastCheckInAt < 10*60*1000) return; // cooldown 10m
    try {
      setCheckingIn(true);
      const { error } = await supabase.from('event_checkins').upsert({
        event_id: eventId,
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
        method: 'manual',
        verified: false
      }, { onConflict:'event_id,user_id' });
      if(!error) setLastCheckInAt(Date.now());
    } finally {
      setCheckingIn(false);
    }
  }

  return { event, going, loading, toggleGoing, checkIn, checkingIn, presence, presenceLabel };
}
