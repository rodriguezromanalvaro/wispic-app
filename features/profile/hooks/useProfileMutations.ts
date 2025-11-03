import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uploadSinglePhoto } from 'lib/storage';
import { supabase } from 'lib/supabase';
import { useToast } from 'lib/toast';

interface UpdateBasicsInput { display_name?: string; bio?: string; interested_in?: string[]; seeking?: string[]; gender?: string|null; city?: string | null; city_id?: number | null }
interface UpdateDiscoveryInput { max_distance_km?: number }
interface UpdateVisibilityInput { show_gender?: boolean; show_orientation?: boolean; show_seeking?: boolean; }
interface UpdateNotificationsInput { push_opt_in?: boolean; notify_messages?: boolean; notify_likes?: boolean; notify_friend_requests?: boolean }
interface UpsertPromptInput { id?: number|string; prompt_id: number; response: string | string[]; }
interface DeletePromptInput { id: number|string; }

export function useProfileMutations(profileId?: string) {
  const qc = useQueryClient();
  const toast = useToast();

  const updateBasics = useMutation({
    mutationFn: async (input: UpdateBasicsInput) => {
      if (!profileId) throw new Error('No profile id');
      const { error } = await supabase.from('profiles').update(input).eq('id', profileId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        qc.setQueryData(['profile:full', profileId], {
          ...prev,
          display_name: input.display_name ?? prev.display_name,
            bio: input.bio ?? prev.bio,
            interested_in: input.interested_in ?? prev.interested_in,
            seeking: input.seeking ?? prev.seeking,
            gender: input.gender !== undefined ? input.gender : prev.gender,
            city: input.city !== undefined ? input.city : (prev as any).city,
            city_id: (input as any).city_id !== undefined ? (input as any).city_id : (prev as any).city_id,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev);
      toast.show('Error al actualizar', 'error');
    },
    onSuccess: (_data, vars) => {
      const msgs: string[] = [];
      if (vars && 'gender' in vars) msgs.push('Género actualizado');
      if (vars && 'interested_in' in vars) msgs.push('Sexualidad actualizada');
      if (vars && 'seeking' in vars) msgs.push('Busco actualizado');
      if (vars && 'display_name' in vars) msgs.push('Nombre actualizado');
      if (vars && 'bio' in vars) msgs.push('Bio actualizada');
      if (vars && ('city' in vars || 'city_id' in vars)) msgs.push('Ubicación actualizada');
      toast.show(msgs.length ? msgs.join(' · ') : 'Perfil actualizado', 'success');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile:full', profileId] });
    }
  });

  const updateVisibility = useMutation({
    mutationFn: async (input: UpdateVisibilityInput) => {
      if (!profileId) throw new Error('No profile id');
      const { error } = await supabase.from('profiles').update(input).eq('id', profileId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        qc.setQueryData(['profile:full', profileId], { ...prev, ...input });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev);
      toast.show('Error al actualizar visibilidad', 'error');
    },
    onSuccess: (_data, vars) => {
      const msgs: string[] = [];
      if (vars && 'show_gender' in vars) msgs.push('Visibilidad del género actualizada');
      if (vars && 'show_orientation' in vars) msgs.push('Visibilidad de la sexualidad actualizada');
      if (vars && 'show_seeking' in vars) msgs.push('Visibilidad de “Busco” actualizada');
      toast.show(msgs.length ? msgs.join(' · ') : 'Visibilidad actualizada', 'success');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile:full', profileId] });
    }
  });

  const updateNotifications = useMutation({
    mutationFn: async (input: UpdateNotificationsInput) => {
      if (!profileId) throw new Error('No profile id');
      const { error } = await supabase.from('profiles').update(input).eq('id', profileId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        qc.setQueryData(['profile:full', profileId], {
          ...prev,
          push_opt_in: input.push_opt_in ?? prev.push_opt_in,
          notify_messages: input.notify_messages ?? prev.notify_messages,
          notify_likes: input.notify_likes ?? prev.notify_likes,
          notify_friend_requests: input.notify_friend_requests ?? prev.notify_friend_requests,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev);
      toast.show('Error al actualizar notificaciones', 'error');
    },
    onSuccess: (_data, vars) => {
      const msgs: string[] = [];
      if (vars && 'push_opt_in' in vars) msgs.push(vars.push_opt_in ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
      if (vars && 'notify_messages' in vars) msgs.push('Mensajes');
      if (vars && 'notify_likes' in vars) msgs.push('Likes');
      if (vars && 'notify_friend_requests' in vars) msgs.push('Solicitudes');
      toast.show(msgs.length ? `Preferencias: ${msgs.join(' · ')}` : 'Preferencias actualizadas', 'success');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile:full', profileId] });
    }
  });

  const updateDiscovery = useMutation({
    mutationFn: async (input: UpdateDiscoveryInput) => {
      if (!profileId) throw new Error('No profile id');
      const { error } = await supabase.from('profiles').update(input).eq('id', profileId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        qc.setQueryData(['profile:full', profileId], {
          ...prev,
          max_distance_km: input.max_distance_km ?? prev.max_distance_km,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev); },
    onSuccess: (_d, vars) => {
      const parts: string[] = [];
      if (vars.max_distance_km !== undefined) parts.push(`Distancia máx. ${vars.max_distance_km} km`);
      toast.show(parts.length ? parts.join(' · ') : 'Preferencias actualizadas', 'success');
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['profile:full', profileId] }); }
  });

  // Prompts upsert
  const upsertPrompt = useMutation({
    mutationFn: async (input: UpsertPromptInput) => {
      if (!profileId) throw new Error('No profile id');
      // If id not provided, still attempt to find existing row to avoid duplicate insert race
  // workingId not needed; upsert handles create-or-update
      // If id is not provided, rely on upsert with onConflict to handle create-or-update without fetching first
  // Normalize arrays (store raw array; Supabase will map to jsonb / text[] depending on schema)
  // Detect if response is array; some schemas might still have 'answer' as text instead of json/array.
  const answerValue = Array.isArray(input.response) ? (input.response as string[]) : input.response;
  const payload: any = { profile_id: profileId, prompt_id: input.prompt_id };
  // If array: try raw first; if DB rejects later we'll adjust (handled in onError future).
  payload.answer = answerValue;
      // Use upsert to avoid unique constraint violations (profile_id,prompt_id)
      const { data, error } = await supabase
        .from('profile_prompts')
        .upsert(payload, { onConflict: 'profile_id,prompt_id' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        const prompts = [...(prev.prompts || [])];
        const existingIdxById = input.id ? prompts.findIndex(p => p.id === input.id) : -1;
        const existingIdxByPrompt = prompts.findIndex(p => p.prompt_id === input.prompt_id);
  const normalized = Array.isArray(input.response) ? [...input.response] : input.response;
        if (existingIdxById >= 0) {
          prompts[existingIdxById] = { ...prompts[existingIdxById], response: normalized };
        } else if (existingIdxByPrompt >= 0) {
          prompts[existingIdxByPrompt] = { ...prompts[existingIdxByPrompt], response: normalized };
        } else {
          prompts.push({ id: 'temp-'+Date.now(), prompt_id: input.prompt_id, response: normalized });
        }
        qc.setQueryData(['profile:full', profileId], { ...prev, prompts });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev); toast.show('Error saving prompt', 'error'); },
    onSuccess: () => { toast.show('Prompt saved', 'success'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['profile:full', profileId] }); }
  });

  const deletePrompt = useMutation({
    mutationFn: async (input: DeletePromptInput) => {
      if (!profileId) throw new Error('No profile id');
      const { error } = await supabase.from('profile_prompts').delete().eq('id', input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        const prompts = (prev.prompts || []).filter((p:any) => p.id !== input.id);
        qc.setQueryData(['profile:full', profileId], { ...prev, prompts });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev); toast.show('Error deleting prompt', 'error'); },
    onSuccess: () => { toast.show('Prompt deleted', 'success'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['profile:full', profileId] }); }
  });

  // (removed unused uriToBlob helper; uploadSinglePhoto handles conversions internally)

  const addPhoto = useMutation({
    mutationFn: async (input: { fileUri: string; mimeType?: string }) => {
      if (!profileId) throw new Error('No profile id');
      console.log('[addPhoto] start', input.fileUri);
      // Use higher level helper (ArrayBuffer) to avoid Blob incompat issues on some Android/Hermes builds
      const url = await uploadSinglePhoto({ userId: profileId, uri: input.fileUri, resize: { maxWidth: 1080, maxHeight: 1080, quality: 0.78 } });
      console.log('[addPhoto] uploaded URL', url);
      const { data: existing, error: exErr } = await supabase
        .from('user_photos')
        .select('id, sort_order')
        .eq('user_id', profileId)
        .order('sort_order', { ascending: false })
        .limit(1);
      if (exErr) throw exErr;
      const nextOrder = (existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0);
      const { error: insErr } = await supabase.from('user_photos').insert({ user_id: profileId, url, sort_order: nextOrder });
      if (insErr) throw insErr;
      const { error: profErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profileId).is('avatar_url', null);
      if (profErr) console.warn('avatar update skip', profErr.message);
      return url;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        const temp = { id: 'temp-photo-'+Date.now(), url: 'local-temp', sort_order: (prev.photos?.[prev.photos.length-1]?.sort_order ?? -1) + 1 };
        qc.setQueryData(['profile:full', profileId], { ...prev, photos: [...(prev.photos||[]), temp], photos_count: (prev.photos_count||0)+1 });
      }
      return { prev: qc.getQueryData<any>(['profile:full', profileId]) };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev);
      toast.show('Error añadiendo foto', 'error');
    },
    onSuccess: () => { toast.show('Foto añadida', 'success'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['profile:full', profileId] }); }
  });

  const removePhoto = useMutation({
    mutationFn: async (input: { id: string|number }) => {
      if (!profileId) throw new Error('No profile id');
      const { error } = await supabase.from('user_photos').delete().eq('id', input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        const photos = (prev.photos||[]).filter((p:any)=> p.id !== input.id);
        qc.setQueryData(['profile:full', profileId], { ...prev, photos, photos_count: photos.length });
      }
      return { prev };
    },
    onError: (_e,_v,ctx)=> { if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev); toast.show('Error eliminando foto','error'); },
    onSuccess: ()=> { toast.show('Foto eliminada','success'); },
    onSettled: ()=> { qc.invalidateQueries({ queryKey: ['profile:full', profileId] }); }
  });

  const replacePhoto = useMutation({
    mutationFn: async (input: { id: string|number; fileUri: string; mimeType?: string }) => {
      if (!profileId) throw new Error('No profile id');
      console.log('[replacePhoto] start', input.id, input.fileUri);
      const url = await uploadSinglePhoto({ userId: profileId, uri: input.fileUri, resize: { maxWidth: 1080, maxHeight: 1080, quality: 0.78 } });
      const { error: updErr } = await supabase.from('user_photos').update({ url }).eq('id', input.id);
      if (updErr) throw updErr;
      // If avatar is not set or empty string, set it to this updated photo to avoid missing avatar on profile
      const { data: prof, error: profGetErr } = await supabase.from('profiles').select('avatar_url').eq('id', profileId).maybeSingle();
      if (!profGetErr) {
        const current = (prof as any)?.avatar_url as string | null;
        if (!current || String(current).trim().length === 0) {
          await supabase.from('profiles').update({ avatar_url: url }).eq('id', profileId);
        }
      }
      return { id: input.id, url };
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        const photos = (prev.photos||[]).map((p:any)=> p.id === input.id ? { ...p, url: 'local-temp-replacing' } : p);
        qc.setQueryData(['profile:full', profileId], { ...prev, photos });
      }
      return { prev };
    },
    onError: (_e,_v,ctx)=> { if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev); toast.show('Error reemplazando foto','error'); },
    onSuccess: ()=> { toast.show('Foto actualizada','success'); },
    onSettled: ()=> { qc.invalidateQueries({ queryKey: ['profile:full', profileId] }); }
  });

  const reorderPhotos = useMutation({
    mutationFn: async (input: { orderedIds: (string|number)[] }) => {
      if (!profileId) throw new Error('No profile id');
      // Fetch existing to map orders quickly
      const updates = input.orderedIds.map((id, idx)=> ({ id, sort_order: idx }));
      // Supabase upsert/update in loop (batch RPC could be better; simple loop for now)
      for (const u of updates) {
        const { error } = await supabase.from('user_photos').update({ sort_order: u.sort_order }).eq('id', u.id);
        if (error) throw error;
      }
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['profile:full', profileId] });
      const prev = qc.getQueryData<any>(['profile:full', profileId]);
      if (prev) {
        const map: Record<string|number, number> = {};
        input.orderedIds.forEach((id,i)=> { map[id]=i; });
        const photos = (prev.photos||[]).map((p:any)=> ({ ...p, sort_order: map[p.id] ?? p.sort_order }));
        qc.setQueryData(['profile:full', profileId], { ...prev, photos });
      }
      return { prev };
    },
    onError: (_e,_v,ctx)=> { if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev); toast.show('Error reordenando','error'); },
    onSuccess: ()=> { toast.show('Fotos reordenadas','success'); },
    onSettled: ()=> { qc.invalidateQueries({ queryKey: ['profile:full', profileId] }); }
  });

  return { updateBasics, updateVisibility, updateNotifications, updateDiscovery, upsertPrompt, deletePrompt, addPhoto, removePhoto, replacePhoto, reorderPhotos };
}
