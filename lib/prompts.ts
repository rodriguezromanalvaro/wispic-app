export const AVAILABLE_PROMPTS = [
  {
    key: 'hobby',
    type: 'single',
    choices: ['música', 'cine', 'deporte', 'lectura'] as string[],
  },
  {
    key: 'pet',
    type: 'single',
    choices: ['perros', 'gatos', 'ninguna'] as string[],
  },
] as const
