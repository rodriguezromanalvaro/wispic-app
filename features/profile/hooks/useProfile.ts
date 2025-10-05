import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { filterPublicProfile, annotateOwnerPerspective, FullProfile } from '../logic/privacy';
import { computeCompletion } from '../logic/computeCompletion';

interface UseProfileResult {
  data: (FullProfile & { completion: ReturnType<typeof computeCompletion> }) | null | undefined;
  publicData: (FullProfile & { completion: ReturnType<typeof computeCompletion> }) | null | undefined;
  isOwner: boolean;
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

export function useProfile(targetId?: string): UseProfileResult {
  const { user } = useAuth();
  const profileId = targetId || user?.id;
  const isOwner = !!user?.id && user.id === profileId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profile:full', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<FullProfile | null> => {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, display_name, bio, calculated_age, gender, birthdate, is_premium, verified_at, interested_in, seeking, show_orientation, show_gender, show_seeking, avatar_url')
        .eq('id', profileId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) return null;

      const { data: photos, error: phErr } = await supabase
        .from('user_photos')
        .select('id, url, sort_order')
        .eq('user_id', profileId)
        .order('sort_order', { ascending: true });
      if (phErr) console.warn('[useProfile] photos error', phErr);

      // Attempt to fetch multiple possible response column names for robustness
      const { data: promptsRows, error: prErr } = await supabase
        .from('profile_prompts')
        .select('id, prompt_id, answer, profile_prompt_templates(question)')
        .eq('profile_id', profileId);
      if (prErr) console.warn('[useProfile] prompts error', prErr);
      function parseArrayLike(val: any): any {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          const s = val.trim();
            // Try JSON array
          if (s.startsWith('[') && s.endsWith(']')) {
            try { const parsed = JSON.parse(s); if (Array.isArray(parsed)) return parsed; } catch {}
          }
          // Try Postgres text[] like {a,b,c}
          if (s.startsWith('{') && s.endsWith('}')) {
            const inner = s.slice(1, -1);
            if (!inner) return [];
            const parts = inner.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g,''));
            return parts.filter(p => p.length > 0);
          }
        }
        return val;
      }
      const prompts = (promptsRows||[]).map((r: any) => {
  let resp = r.answer ?? '';
        resp = parseArrayLike(resp);
        return {
          id: r.id,
          prompt_id: r.prompt_id,
          profile_id: profileId!,
          response: resp,
          question: r.profile_prompt_templates?.question as string | undefined
        };
      });

      // Load interests from bridge table instead of deprecated profiles.interests
      const { data: interestRows, error: intErr } = await supabase
        .from('profile_interests')
        .select('interest_id, interests(name)')
        .eq('profile_id', profileId);
      if (intErr) console.warn('[useProfile] interests error', intErr);
      const interests: string[] = (interestRows||[])
        .map((r: any) => r.interests?.name)
        .filter((v: any) => typeof v === 'string' && v.length > 0);

      const full: FullProfile = {
        id: profile.id,
        display_name: profile.display_name,
        bio: profile.bio,
        age: profile.calculated_age,
        gender: profile.gender,
        interests,
        is_premium: profile.is_premium,
        birthdate: profile.birthdate,
        verified_at: profile.verified_at,
        interested_in: profile.interested_in || [],
        seeking: profile.seeking || [],
        show_orientation: profile.show_orientation ?? true,
        show_gender: profile.show_gender ?? true,
        show_seeking: profile.show_seeking ?? true,
        avatar_url: profile.avatar_url,
        prompts,
        photos_count: photos?.length || 0,
        photos: (photos||[]).map(p => ({ id: p.id, url: p.url, sort_order: p.sort_order }))
      };
      return full;
    }
  });

  let ownerData: (FullProfile & { completion: ReturnType<typeof computeCompletion> }) | null | undefined = undefined;
  let publicData: (FullProfile & { completion: ReturnType<typeof computeCompletion> }) | null | undefined = undefined;

  if (data) {
    const completion = computeCompletion(data);
    if (isOwner) {
      ownerData = { ...annotateOwnerPerspective(data), completion } as any;
      publicData = { ...filterPublicProfile(data), completion } as any;
    } else {
      publicData = { ...filterPublicProfile(data), completion } as any;
    }
  } else if (data === null) {
    ownerData = null; publicData = null;
  }

  return {
    data: isOwner ? ownerData : publicData,
    publicData,
    isOwner,
    isLoading,
    error,
    refetch
  };
}
