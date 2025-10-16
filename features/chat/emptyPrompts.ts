// features/chat/emptyPrompts.ts
// Rotating empty-chat prompts with emoji + text, localized (es/en) and seeded by matchId + date

export type Locale = 'es' | 'en';

const promptsEs: string[] = [
  'Atrévete: {name} no muerde 😉',
  'Un “hola” puede con todo. ¿Se lo dices a {name}? ✨',
  'Si te apetece, da el primer paso con {name} 👣',
  'Hoy es buen día para hablar con {name} ☀️',
  'Lo más difícil es empezar. ¡Anímate con {name}! 💬',
  'Tu vibra le va a gustar a {name} 💫',
  'Te toca jugar: rompe el hielo con {name} 🎯',
  '¿Confías en tu intuición? {name} también 😉',
  'Si te lo estás pensando… es que sí. Saluda a {name} ✅',
  '¿Y si hoy te lanzas? {name} está a un mensaje 💌',
  'Un paso pequeño, una buena historia con {name} 📖',
  'Las conexiones empiezan con valentía. {name} te espera 💥',
  'Tu curiosidad merece un “hola” a {name} 🔎',
  'Si sonreíste, escríbele a {name} 🙂📩',
  'Cero presión: sé tú y habla con {name} 🌿',
  'La chispa la pones tú. {name}, la respuesta ✨',
  '¿Plan? Romper el hielo con {name} y ver qué pasa 🎢',
  'Te queda bien dar el primer paso. {name} lo sabe 😌',
  'Nada que perder, una conexión que ganar con {name} 🏆',
  'Hoy eliges tú: dar el paso con {name} 👑',
  'En casos de duda: escribe a {name} 🧭',
  'La magia empieza cuando te atreves. {name} está ahí ✨',
  'Si sientes curiosidad, díselo a {name} 🌟',
  '¿Y si haces el “clic” con {name}? ⚡',
  'El momento perfecto no existe; tú lo creas con {name} ⏳',
  'La primera palabra es tu superpoder. {name} espera 🦸',
  'A veces solo hace falta un “hey”. {name} está cerca 👋',
  'Si te vibra, escríbele a {name} 🎵',
  'Dale una oportunidad a lo inesperado con {name} 🎁',
  'Confía: {name} quiere saber de ti 💬',
  'Hazlo sencillo: da el paso con {name} 🧩',
  'La conexión empieza contigo. {name} te lee 👀',
  'Tu energía + {name} = buena pinta 🔥',
  'Pequeños comienzos, grandes historias (con {name}) 🌱',
];

const promptsEn: string[] = [
  'Be brave: {name} won’t bite 😉',
  'A “hi” goes a long way. Say it to {name}? ✨',
  'If you feel it, take the first step with {name} 👣',
  'Today’s a good day to talk to {name} ☀️',
  'Starting is the hardest part. You got this with {name}! 💬',
  'Your vibe might be {name}’s vibe 💫',
  'Your turn to play: break the ice with {name} 🎯',
  'Trust your gut — and say hi to {name} 😉',
  'If you’re thinking about it… that’s a yes. Say hi to {name} ✅',
  'What if you try today? {name} is one message away 💌',
  'Small step, good story with {name} 📖',
  'Connections start with courage. {name} is waiting 💥',
  'Curiosity deserves a “hello” to {name} 🔎',
  'If it made you smile, text {name} 🙂📩',
  'No pressure: be you and talk to {name} 🌿',
  'You bring the spark; {name} brings the reply ✨',
  'Plan: break the ice with {name} and see what happens 🎢',
  'You wear first moves well. {name} knows it 😌',
  'Nothing to lose, a connection to win with {name} 🏆',
  'When in doubt: message {name} 🧭',
  'Magic starts when you dare. {name} is there ✨',
  'If you’re curious, tell {name} 🌟',
  'What if you make the “click” with {name}? ⚡',
  'Perfect timing is made — say hi to {name} ⏳',
  'First words are your superpower. {name} is listening 🦸',
  'Sometimes a simple “hey” is enough. {name} is close 👋',
  'If it resonates, text {name} 🎵',
  'Give the unexpected a chance with {name} 🎁',
  'Trust it: {name} wants to hear from you 💬',
  'Keep it simple: take the step with {name} 🧩',
  'The connection starts with you. {name} will see it 👀',
  'Your energy + {name} = good signs 🔥',
  'Small beginnings, great stories (with {name}) 🌱',
];

function yyyymmdd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${da}`;
}

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return hash >>> 0;
}

export function pickEmptyPrompt(params: { name: string; locale: Locale; matchId: number; date?: Date; offset?: number }) {
  const { name, locale, matchId } = params;
  const date = params.date || new Date();
  const offset = params.offset || 0;
  const pool = (locale === 'es' ? promptsEs : promptsEn);
  const key = `${matchId}-${yyyymmdd(date)}`;
  const idx = (djb2(key) + (offset || 0)) % pool.length;
  const raw = pool[Math.abs(idx) % pool.length];
  return raw.replaceAll('{name}', name);
}

export const emptyPrompts = { es: promptsEs, en: promptsEn };
