import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { useTranslation } from 'react-i18next';
import { PromptAnswer } from './prompts';
import { useAuth } from './useAuth';

export type Gender = 'male' | 'female' | 'other' | null;

export type ProfileDraft = {
  name: string;
  bio: string;
  gender: Gender;
  birthdate: string; // YYYY-MM-DD
  prompts: PromptAnswer[]; // respuestas a prompts
  interested_in?: string[]; // orientación: a quién quiere conocer
  show_orientation?: boolean; // controla visibilidad orientación
  show_gender?: boolean; // controla visibilidad género
  seeking?: string[]; // qué busca: dating, friends, etc.
  show_seeking?: boolean; // visibilidad de seeking
  // Nuevos campos (onboarding v2)
  relationship_status?: 'single' | 'inRelationship' | 'open' | 'itsComplicated' | 'preferNot';
  location_opt_in?: boolean;
  push_opt_in?: boolean;
  notify_messages?: boolean;
  notify_likes?: boolean;
  notify_friend_requests?: boolean;
  expo_push_token?: string | null;
};

type Ctx = {
  draft: ProfileDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>;
  loading: boolean;
  loadFromSupabase: () => Promise<void>;
  saveToSupabase: () => Promise<boolean>;
};

const CompleteProfileContext = createContext<Ctx | undefined>(undefined);

export function CompleteProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileDraft>({
    name: '',
    bio: '',
    gender: null,
    birthdate: '',
    prompts: [],
    interested_in: [],
    show_orientation: true,
    show_gender: true,
    seeking: [],
    show_seeking: true,
    relationship_status: undefined,
    location_opt_in: false,
    push_opt_in: false,
    notify_messages: true,
    notify_likes: true,
    notify_friend_requests: true,
    expo_push_token: null,
  });
  const [loading, setLoading] = useState(false);

  const loadFromSupabase = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;
      if (data) {
        // Intentamos recoger prompts si existe columna JSON (opcional) o se cargan luego de tabla
        let prompts: PromptAnswer[] = [];
        // Modelo relacional: unir templates + respuestas
        try {
          const { data: rel } = await supabase
            .from('profile_prompts')
            .select('answer, profile_id, prompt_id, profile_prompt_templates(key)')
            .eq('profile_id', user.id);
          if (rel && Array.isArray(rel)) {
            prompts = rel
              .filter((r: any) => r.profile_prompt_templates?.key && r.answer !== undefined)
              .map((r: any) => ({ key: r.profile_prompt_templates.key, answers: Array.isArray(r.answer) ? r.answer : (typeof r.answer === 'string' ? [r.answer] : []) }));
          }
        } catch {}
        setDraft({
          name: data.display_name || '',
          bio: data.bio || '',
          gender: (data.gender as Gender) ?? null,
          birthdate: data.birthdate ? String(data.birthdate) : '',
          prompts: (prompts as any),
            interested_in: Array.isArray((data as any).interested_in) ? (data as any).interested_in : [],
          show_orientation: (data as any).show_orientation !== undefined ? !!(data as any).show_orientation : true,
          show_gender: (data as any).show_gender !== undefined ? !!(data as any).show_gender : true,
          seeking: Array.isArray((data as any).seeking) ? (data as any).seeking : [],
          show_seeking: (data as any).show_seeking !== undefined ? !!(data as any).show_seeking : true,
          relationship_status: (data as any).relationship_status ?? undefined,
          location_opt_in: (data as any).location_opt_in ?? false,
          push_opt_in: (data as any).push_opt_in ?? false,
          notify_messages: (data as any).notify_messages ?? true,
          notify_likes: (data as any).notify_likes ?? true,
          notify_friend_requests: (data as any).notify_friend_requests ?? true,
          expo_push_token: (data as any).expo_push_token ?? null,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFromSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveToSupabase = async (): Promise<boolean> => {
    if (!user) return false;
  const { name, bio, gender, birthdate, prompts, interested_in, show_orientation, show_gender, seeking, show_seeking, relationship_status, location_opt_in, push_opt_in, notify_messages, notify_likes, notify_friend_requests, expo_push_token } = draft;

    if (!name.trim()) {
      Alert.alert(t('complete.nameRequiredTitle','Nombre requerido'), t('complete.nameRequiredBody','Debes introducir tu nombre visible'));
      return false;
    }
    if (!gender) {
      Alert.alert(t('complete.genderRequiredTitle','Género requerido'), t('complete.genderRequiredBody','Debes seleccionar tu género'));
      return false;
    }
    const dob = birthdate.trim();
    if (!dob) {
      Alert.alert(t('complete.birthRequiredTitle','Fecha requerida'), t('complete.birthRequiredBody','La fecha de nacimiento es obligatoria'));
      return false;
    }
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(dob);
    if (!ok) {
      Alert.alert(t('complete.birthInvalidTitle','Fecha inválida'), t('complete.birthInvalidBody','Usa formato YYYY-MM-DD'));
      return false;
    }
    // Validación de calendario real (mes/día y bisiesto)
    const [yy, mm, dd] = dob.split('-').map(Number);
    if (mm < 1 || mm > 12) {
      Alert.alert('Fecha inválida', 'Mes fuera de rango');
      return false;
    }
    const daysInMonth = (m: number, y: number) => {
      return [31, (y % 400 === 0 || (y % 4 === 0 && y % 100 !== 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    };
    if (dd < 1 || dd > daysInMonth(mm, yy)) {
      Alert.alert('Fecha inválida', 'Día fuera de rango');
      return false;
    }
    const now = new Date();
    if (new Date(dob) > now) {
      Alert.alert('Fecha inválida', 'No puede ser una fecha futura');
      return false;
    }
    const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    if (isFinite(years) && years < 18) {
      Alert.alert(t('complete.birthUnderageTitle','Edad mínima'), t('complete.birthUnderageBody','Debes ser mayor de 18 años.'));
      return false;
    }

    const payload: any = {
      id: user.id,
      display_name: name.trim() || null,
      bio: bio.trim() || null,
      gender,
      birthdate: dob,
  interested_in: Array.isArray(interested_in) ? interested_in : [],
  seeking: Array.isArray(seeking) ? seeking : [],
      show_orientation: show_orientation ?? true,
      show_gender: show_gender ?? true,
      show_seeking: show_seeking ?? true,
      relationship_status: relationship_status ?? null,
      location_opt_in: !!location_opt_in,
      push_opt_in: !!push_opt_in,
      notify_messages: !!notify_messages,
      notify_likes: !!notify_likes,
      notify_friend_requests: !!notify_friend_requests,
      expo_push_token: expo_push_token || null,
      onboarding_version: 2,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };
    // Intento guardar en columna JSON si existe
    // Eliminado payload.prompts: la columna no existe en profiles; las respuestas viven en profile_prompts.
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      Alert.alert('Error', error.message);
      return false;
    }
    // Tabla relacional: mapear key -> prompt_id
    try {
      if (Array.isArray(prompts)) {
        const valid = prompts.filter(p => Array.isArray(p.answers) && p.answers.length > 0);
        const { data: templates } = await supabase
          .from('profile_prompt_templates')
          .select('id, key')
          .eq('active', true);
        const keyToId = new Map<string, number>();
        (templates || []).forEach(t => { if (t.key) keyToId.set(t.key, t.id); });
        await supabase.from('profile_prompts').delete().eq('profile_id', user.id);
        const rows = valid.map(p => ({ profile_id: user.id, prompt_id: keyToId.get(p.key), answer: p.answers })).filter(r => !!r.prompt_id);
        if (rows.length) await supabase.from('profile_prompts').insert(rows);
      }
    } catch (e) { console.log('[profile prompts] sync error', e); }
    return true;
  };

  const value = useMemo(() => ({ draft, setDraft, loading, loadFromSupabase, saveToSupabase }), [draft, loading]);
  return <CompleteProfileContext.Provider value={value}>{children}</CompleteProfileContext.Provider>;
}

export function useCompleteProfile() {
  const ctx = useContext(CompleteProfileContext);
  if (!ctx) throw new Error('useCompleteProfile must be used within CompleteProfileProvider');
  return ctx;
}
