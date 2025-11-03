import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import { supabase } from 'lib/supabase'
import { useAuth } from 'lib/useAuth'

export function useOwner(){
  const { user } = useAuth();
  const q = useQuery<{ is_owner?: boolean; needs_onboarding?: boolean; owner_id?: string } | null>(
    {
      enabled: !!user?.id,
      queryKey: ['owner-state', user?.id],
      queryFn: async () => {
        const { data } = await supabase.rpc('owner_state');
        const row = Array.isArray(data) ? (data[0] as any) : null;
        return row || null;
      },
      staleTime: 10_000,
    }
  );

  // Fallback si falla la RPC o no hay dato aún
  const fallbackIsOwner = user?.user_metadata?.owner === true;
  const isOwner = (q.data?.is_owner === true) || (!q.isFetching && !q.data && fallbackIsOwner);
  const needsOnboarding = isOwner ? !!(q.data?.needs_onboarding ?? true) : false;
  const ownerReady = isOwner && !needsOnboarding;
  const ownerId = (q.data?.owner_id ?? null) as string | null;

  return useMemo(() => ({
    loading: !!user?.id ? q.isLoading : false,
    isOwner,
    needsOnboarding,
    ownerReady,
    ownerId,
  }), [user?.id, q.isLoading, isOwner, needsOnboarding, ownerReady, ownerId]);
}

export async function getOwnerState(user?: any){
  try {
    const { data } = await supabase.rpc('owner_state');
    const row = Array.isArray(data) ? (data[0] as any) : null;
    if (row?.is_owner) {
      return {
        loading: false,
        isOwner: true,
        needsOnboarding: !!row.needs_onboarding,
        ownerReady: !row.needs_onboarding,
        ownerId: row.owner_id ?? null,
      };
    }
  } catch {}
  // Fallback: si en metadata viene marcado como owner, obligamos onboarding
  if (user?.user_metadata?.owner === true) {
    return { loading: false, isOwner: true, needsOnboarding: true, ownerReady: false, ownerId: null };
  }
  return { loading: false, isOwner: false, needsOnboarding: false, ownerReady: false, ownerId: null as string | null };
}

// Owner RPC helpers (optional usage in dashboards/screens)
export async function fetchOwnerVenues(){
  const { data, error } = await supabase.rpc('get_owner_venues');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchOwnerEvents(params?: { venueId?: string | null; includeDrafts?: boolean }){
  const { venueId = null, includeDrafts = true } = params ?? {};
  const { data, error } = await supabase.rpc('list_owner_events', {
    p_venue_id: venueId,
    p_include_drafts: includeDrafts,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
