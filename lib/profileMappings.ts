// Centralized mappings and helpers for profile fields: gender, orientation, seeking
// Provides canonical codes, label resolution via i18n, and normalization from legacy values

export type GenderCode = 'male' | 'female' | 'other';
export type OrientationCode = 'men' | 'women' | 'nonBinary' | 'everyone';
export type SeekingCode = 'friends' | 'relationship' | 'casual' | 'plan' | 'networking';

type TFn = (k: string, def?: string) => any;

// GENDER
const genderSynonyms: Record<string, GenderCode> = {
  male: 'male', hombre: 'male', m: 'male',
  female: 'female', mujer: 'female', f: 'female',
  other: 'other', otro: 'other', otra: 'other',
  non_binary: 'other', nonbinary: 'other', 'no binario': 'other',
  prefer_not_to_say: 'other', 'prefiero no decir': 'other',
};

export function normalizeGender(input: string | null | undefined): GenderCode | null {
  if (!input) return null;
  const key = String(input).trim();
  const found = genderSynonyms[key] || genderSynonyms[key.toLowerCase()];
  if (found) return found;
  // If a label slipped through, map Spanish labels heuristically
  const lowered = key.toLowerCase();
  if (['hombre', 'masculino'].includes(lowered)) return 'male';
  if (['mujer', 'femenino'].includes(lowered)) return 'female';
  return 'other';
}

export function getGenderOptions(t: TFn): Array<{ code: GenderCode; label: string }> {
  return [
    { code: 'female', label: String(t('complete.female', 'Mujer')) },
    { code: 'male', label: String(t('complete.male', 'Hombre')) },
    { code: 'other', label: String(t('complete.other', 'Otro')) },
  ];
}

export function getGenderLabel(code: string | null | undefined, t: TFn): string {
  const c = normalizeGender(code);
  if (!c) return '';
  if (c === 'male') return String(t('complete.male', 'Hombre'));
  if (c === 'female') return String(t('complete.female', 'Mujer'));
  return String(t('complete.other', 'Otro'));
}

// ORIENTATION (interested_in)
const orientationSynonyms: Record<string, OrientationCode> = {
  men: 'men', man: 'men', hombres: 'men', hombre: 'men',
  women: 'women', woman: 'women', mujeres: 'women', mujer: 'women',
  nonbinary: 'nonBinary', non_binary: 'nonBinary', 'no binario': 'nonBinary',
  everyone: 'everyone', all: 'everyone', todos: 'everyone', todes: 'everyone',
};

export function normalizeOrientationInput(input: Array<string | null | undefined>): OrientationCode[] {
  const set = new Set<OrientationCode>();
  for (const raw of input || []) {
    if (!raw) continue;
    const key = String(raw).trim();
    const mapped = orientationSynonyms[key] || orientationSynonyms[key.toLowerCase()] as OrientationCode | undefined;
    if (mapped) set.add(mapped);
    else {
      // If direct canonical
      if (['men','women','nonBinary','everyone'].includes(key)) set.add(key as OrientationCode);
    }
  }
  return Array.from(set);
}

export function getOrientationOptions(t: TFn): Array<{ code: OrientationCode; label: string }> {
  return [
    { code: 'women', label: String(t('orientation.women', 'Mujeres')) },
    { code: 'men', label: String(t('orientation.men', 'Hombres')) },
    { code: 'nonBinary', label: String(t('orientation.nonBinary', 'Más allá del modelo binario')) },
    { code: 'everyone', label: String(t('orientation.everyone', 'Todos los géneros')) },
  ];
}

export function toOrientationLabels(codes: string[] | undefined | null, t: TFn): string[] {
  const norm = normalizeOrientationInput(codes || []);
  const map: Record<OrientationCode, string> = {
    men: String(t('orientation.men', 'Hombres')),
    women: String(t('orientation.women', 'Mujeres')),
    nonBinary: String(t('orientation.nonBinary', 'Más allá del modelo binario')),
    everyone: String(t('orientation.everyone', 'Todos los géneros')),
  };
  return norm.map(c => map[c]);
}

// SEEKING
const seekingSynonyms: Record<string, SeekingCode> = {
  friends: 'friends', amistad: 'friends', amigo: 'friends', amistades: 'friends',
  relationship: 'relationship', relacion: 'relationship', relación: 'relationship', pareja: 'relationship',
  casual: 'casual', cita: 'casual', ligue: 'casual',
  plan: 'plan', planear: 'plan', planes: 'plan',
  networking: 'networking', contactos: 'networking', red: 'networking'
};

export function normalizeSeekingInput(input: Array<string | null | undefined>): SeekingCode[] {
  const set = new Set<SeekingCode>();
  for (const raw of input || []) {
    if (!raw) continue;
    const key = String(raw).trim();
    const low = key.toLowerCase();
    const mapped = (seekingSynonyms[key] || seekingSynonyms[low]) as SeekingCode | undefined;
    if (mapped) set.add(mapped);
    else {
      if (['friends','relationship','casual','plan','networking'].includes(key)) set.add(key as SeekingCode);
    }
  }
  return Array.from(set);
}

export function getSeekingOptions(t: TFn): Array<{ code: SeekingCode; label: string }> {
  return [
    { code: 'friends', label: String(t('seeking.friends', 'Amistad')) },
    { code: 'relationship', label: String(t('seeking.relationship', 'Relación')) },
    { code: 'casual', label: String(t('seeking.casual', 'Casual')) },
    { code: 'plan', label: String(t('seeking.plan', 'Plan')) },
    { code: 'networking', label: String(t('seeking.networking', 'Networking')) },
  ];
}

export function toSeekingLabels(codes: string[] | undefined | null, t: TFn): string[] {
  const norm = normalizeSeekingInput(codes || []);
  const map: Record<SeekingCode, string> = {
    friends: String(t('seeking.friends', 'Amistad')),
    relationship: String(t('seeking.relationship', 'Relación')),
    casual: String(t('seeking.casual', 'Casual')),
    plan: String(t('seeking.plan', 'Plan')),
    networking: String(t('seeking.networking', 'Networking')),
  };
  return norm.map(c => map[c]);
}
