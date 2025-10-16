import { useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '../useAuth';
import { supabase } from '../supabase';

type OwnerState = {
  isOwner: boolean;
  needsOnboarding: boolean;
};

// Dev helper for forcing owner mode (kept); onboarded flag deprecated in favor of DB RPC

export async function getOwnerState(user: User | null): Promise<OwnerState> {
  if (!user) return { isOwner: false, needsOnboarding: false };

  // Preferir cálculo server-side con RPC owner_state()
  try {
    const { data, error } = await supabase.rpc('owner_state');
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as any;
      const isOwner = !!row.is_owner;
      const needs = !!row.needs_onboarding;
      return { isOwner, needsOnboarding: needs };
    }
  } catch (_) {
    // caemos a la ruta de fallback
  }

  // Fallback DB-driven (en caso de que la RPC no esté disponible)
  try {
    const { data: memberships, error: mErr } = await supabase
      .from('venue_staff')
      .select('venue_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .limit(1);

    if (mErr) return { isOwner: false, needsOnboarding: false };
    const membership = memberships?.[0] as { venue_id: number } | undefined;

    if (!membership) {
      // aceptar intención via metadata (pre-onboarding)
      const role = (user.user_metadata as any)?.role as string | undefined;
      const ownerMetaFlag = Boolean((user.user_metadata as any)?.owner);
      const isOwnerIntent = role === 'owner' || ownerMetaFlag;
      return { isOwner: isOwnerIntent, needsOnboarding: isOwnerIntent };
    }

    const { data: venue, error: vErr } = await supabase
      .from('venues')
      .select('id,name,category,location_text,description,avatar_url')
      .eq('id', membership.venue_id)
      .maybeSingle();

    if (vErr || !venue) return { isOwner: true, needsOnboarding: true };
    const isMissing = !venue.name || !venue.category || !venue.location_text || !venue.description || !venue.avatar_url;
    return { isOwner: true, needsOnboarding: isMissing };
  } catch {
    return { isOwner: false, needsOnboarding: false };
  }
}

export function useOwner(): OwnerState & { loading: boolean } {
  const { user } = useAuth();
  const [state, setState] = useState<OwnerState>({ isOwner: false, needsOnboarding: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const st = await getOwnerState(user ?? null);
      if (alive) {
        setState(st);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, (user as any)?.user_metadata]);

  return { ...state, loading };
}

// setDevOwnerMode removed; owner mode is determined by DB state only
