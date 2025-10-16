// Paleta oscura (coherente con modo oscuro opcional)
const darkColors = {
  bg: '#111827',
  bgAlt: '#0B1220',
  card: '#0B1220',
  cardAlt: '#111827',
  surface: 'rgba(255,255,255,0.06)',
  surfaceAlt: 'rgba(255,255,255,0.1)',
  overlay: 'rgba(0,0,0,0.55)',
  border: '#1F2937',
  divider: '#1F2937',
  text: '#F3F4F6',
  subtext: '#9CA3AF',
  textDim: '#A3AEC2',
  white: '#FFFFFF',
  primary: '#FF6B6B',
  primaryAlt: '#E11D48',
  primaryText: '#111827',
  secondary: '#FFD166',
  focus: '#FF6B6B',
  positive: '#10B981',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerAlt: '#F87171',
  surfaceMuted: '#0B1220'
};

// Paleta clara (A) Coral/Peach
const lightColorsCoral = {
  bg: '#FFF8F5',
  bgAlt: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#FFF8F5',
  surface: 'rgba(0,0,0,0.04)',
  surfaceAlt: 'rgba(0,0,0,0.08)',
  overlay: 'rgba(255,255,255,0.55)',
  border: '#E5E7EB',
  divider: '#E5E7EB',
  text: '#111827',
  subtext: '#6B7280',
  textDim: '#6B7280',
  white: '#FFFFFF',
  primary: '#FF6B6B',
  primaryAlt: '#FFA07A',
  primaryText: '#FFFFFF',
  secondary: '#FFD166',
  focus: '#FF6B6B',
  positive: '#10B981',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerAlt: '#F87171',
  surfaceMuted: '#FFF8F5'
};

// Paleta clara (B) Magenta/Fucsia
const lightColorsMagenta = {
  bg: '#FFF5F7',
  bgAlt: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#FFF5F7',
  surface: 'rgba(0,0,0,0.04)',
  surfaceAlt: 'rgba(0,0,0,0.08)',
  overlay: 'rgba(255,255,255,0.55)',
  border: '#E5E7EB',
  divider: '#E5E7EB',
  text: '#111827',
  subtext: '#6B7280',
  textDim: '#6B7280',
  white: '#FFFFFF',
  primary: '#E11D48',
  primaryAlt: '#A855F7',
  primaryText: '#FFFFFF',
  secondary: '#FB7185',
  focus: '#E11D48',
  positive: '#10B981',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerAlt: '#F87171',
  surfaceMuted: '#FFF5F7'
};

export const theme = {
  mode: 'light' as 'light' | 'dark',
  colors: lightColorsCoral,
  darkColors,
  lightColors: lightColorsCoral,
  // Radio principal según guía (16px en cards/botones grandes)
  radius: 16,
  radii: { xs:6, sm:10, md:14, lg:20, pill: 999 },
  spacing: (n: number) => n * 8,
  elevation: {
    1: {
      shadowColor: '#000',
      shadowOpacity: 0.30,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4
    },
    2: {
      shadowColor: '#000',
      shadowOpacity: 0.50,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8
    }
  },
  gradients: {
    // Acento Coral/Peach
    brand: ['#FFA07A', '#FF6B6B'],
    brandSoft: ['rgba(255,107,107,0.16)', 'rgba(255,107,107,0.06)'],
    positive: ['#10B981', '#34D399'],
    dark: ['#0B1220', '#111827'],
    // Fondo general con leve matiz cálido para pantallas (feed, chat, etc.)
    appBg: ['#FFF8F5', '#FFFFFF', '#FFF5F7'],
    glowTop: ['rgba(255,107,107,0.16)', 'rgba(255,107,107,0)'],
    glowBottom: ['rgba(255,107,107,0)', 'rgba(255,107,107,0.14)']
  },
  layout: {
    maxWidth: 480,
    authWidth: 420
  }
};

// Paletas preparadas para toggling (A/B)
export const palettes = {
  coral: {
    colors: lightColorsCoral,
    gradients: {
      brand: ['#FFA07A', '#FF6B6B'] as [string, string],
      brandSoft: ['rgba(255,107,107,0.16)', 'rgba(255,107,107,0.06)'] as [string, string],
    }
  },
  magenta: {
    colors: lightColorsMagenta,
    gradients: {
      brand: ['#FF4D8D', '#A855F7'] as [string, string],
      brandSoft: ['rgba(225,29,72,0.16)', 'rgba(168,85,247,0.08)'] as [string, string],
    }
  },
  owner: {
    colors: {
      bg: '#F5F8FF',
      bgAlt: '#FFFFFF',
      card: '#FFFFFF',
      cardAlt: '#F5F8FF',
      surface: 'rgba(0,0,0,0.04)',
      surfaceAlt: 'rgba(0,0,0,0.08)',
      overlay: 'rgba(255,255,255,0.55)',
      border: '#E5E7EB',
      divider: '#E5E7EB',
      text: '#0B1220',
      subtext: '#6B7280',
      textDim: '#6B7280',
      white: '#FFFFFF',
      primary: '#2563EB',
      primaryAlt: '#60A5FA',
      primaryText: '#FFFFFF',
      secondary: '#93C5FD',
      focus: '#2563EB',
      positive: '#10B981',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      dangerAlt: '#F87171',
      surfaceMuted: '#F5F8FF'
    },
    gradients: {
      brand: ['#60A5FA', '#2563EB'] as [string, string],
      brandSoft: ['rgba(59,130,246,0.16)', 'rgba(59,130,246,0.06)'] as [string, string],
      appBg: ['#F5F8FF', '#FFFFFF', '#F0F7FF'] as [string, string, string]
    }
  }
} as const;

// Helper opcional para cambiar de paleta en runtime (simple mutación)
export function applyPalette(name: keyof typeof palettes) {
  const p = palettes[name];
  if (!p) return;
  // mutamos referencias usadas por la app
  (theme as any).colors = p.colors;
  (theme as any).lightColors = p.colors;
  (theme as any).gradients = {
    ...theme.gradients,
    brand: p.gradients.brand,
    brandSoft: p.gradients.brandSoft,
    ...(p.gradients as any).appBg ? { appBg: (p.gradients as any).appBg } : {}
  } as any;
}
