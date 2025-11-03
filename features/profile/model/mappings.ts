type Opt = { code: string; label: string };

const GENDER: Opt[] = [
  { code: 'male', label: 'Hombre' },
  { code: 'female', label: 'Mujer' },
  { code: 'nonbinary', label: 'No binario' },
];

// IMPORTANT: 'interested_in' in the app is used as TARGET GENDERS for matching, not sexual orientation labels.
// To avoid mismatches in swipe logic, offer options that map directly to genders or everyone ('*').
const ORIENT: Opt[] = [
  { code: 'male', label: 'Hombres' },
  { code: 'female', label: 'Mujeres' },
  { code: 'nonbinary', label: 'Personas no binarias' },
  { code: '*', label: 'Todos' },
];

const SEEKING: Opt[] = [
  { code: 'friendship', label: 'Amistad' },
  { code: 'dating', label: 'Citas' },
  { code: 'serious', label: 'Relación seria' },
];

export function getGenderLabel(code?: string | null, _tf?: any): string {
  return GENDER.find((g) => g.code === code)?.label || (code || '');
}

export function getGenderOptions(_tf?: any): Opt[] {
  return GENDER;
}
export function getOrientationOptions(_tf?: any): Opt[] {
  return ORIENT;
}
export function getSeekingOptions(_tf?: any): Opt[] {
  return SEEKING;
}

export function toOrientationLabels(codes: string[] | undefined | null, _tf?: any): string[] {
  if (!codes || !codes.length) return [];
  const map = new Map(ORIENT.map((o) => [o.code, o.label] as const));
  return codes.map((c) => map.get(c) || c);
}
