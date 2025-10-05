import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { uploadSinglePhoto } from '../../../lib/storage';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { useToast } from '../../../lib/toast';

interface UpdateBasicsInput { display_name?: string; bio?: string; interested_in?: string[]; seeking?: string[]; gender?: string|null; }
interface UpdateVisibilityInput { show_gender?: boolean; show_orientation?: boolean; show_seeking?: boolean; }
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
            gender: input.gender !== undefined ? input.gender : prev.gender
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['profile:full', profileId], ctx.prev);
      toast.show('Error updating basics', 'error');
    },
    onSuccess: () => {
      toast.show('Profile updated', 'success');
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
      toast.show('Error updating visibility', 'error');
    },
    onSuccess: () => {
      toast.show('Visibility updated', 'success');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile:full', profileId] });
    }
  });

  // Prompts upsert
  const upsertPrompt = useMutation({
    mutationFn: async (input: UpsertPromptInput) => {
      if (!profileId) throw new Error('No profile id');
      // If id not provided, still attempt to find existing row to avoid duplicate insert race
      let workingId = input.id;
      if (!workingId) {
        const cached: any = supabase; // placeholder to satisfy linter (not actually used)
        // Try to read from query cache directly
        // (We don't have direct access to qc here easily without coupling; rely on DB upsert instead)
      }
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

  // Photos: add single photo (append at end). Accepts a local file uri (already picked & optionally cropped)
  async function uriToBlob(localUri: string, mime?: string): Promise<Blob> {
    // Handle content:// URIs by copying to cache (Android)
    let workingUri = localUri;
    try {
      if (workingUri.startsWith('content://')) {
        const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
        const dest = baseDir + 'upl-' + Date.now() + '.jpg';
        await FileSystem.copyAsync({ from: workingUri, to: dest });
        workingUri = dest;
      }
      // First attempt: fetch
      const res = await fetch(workingUri);
      const b = await res.blob();
      if (b.size === 0) throw new Error('Empty blob');
      return b;
    } catch(err) {
      console.warn('[uriToBlob] fetch fallback', err);
      try {
        const path = workingUri.replace('file://','');
        const b64 = await FileSystem.readAsStringAsync(path, { encoding: 'base64' as any });
        const arrayBuffer = decodeBase64(b64);
        return new Blob([arrayBuffer], { type: mime || 'image/jpeg' });
      } catch(e2) {
        console.warn('[uriToBlob] base64 fallback failed', e2);
        throw e2;
      }
    }
  }

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

  return { updateBasics, updateVisibility, upsertPrompt, deletePrompt, addPhoto, removePhoto, replacePhoto, reorderPhotos };
}
