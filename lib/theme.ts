// Paleta oscura original retenida para usos puntuales o futuros toggles
const darkColors = {
  // Azul más claro y aireado ("Azure Dusk")
  bg: '#0F1D30',        // Base general
  bgAlt: '#13263D',     // Header / barras
  card: '#19324B',      // Cards principales
  cardAlt: '#1F3C56',   // Cards secundarios
  surface: 'rgba(255,255,255,0.07)',
  surfaceAlt: 'rgba(255,255,255,0.12)',
  overlay: 'rgba(19,38,61,0.55)',
  border: '#295272',
  divider: '#254A68',
  text: '#FFFFFF',
  subtext: '#D2DEE9',
  textDim: '#94A9BC',
  white: '#FFFFFF',
  primary: '#55A8FF',     // Azul más claro como acción
  primaryAlt: '#6A7CFF',  // Azul-violeta
  primaryText: '#0F1D30',
  secondary: '#9F62FF',   // Violeta claro
  focus: '#6A7CFF',
  positive: '#27D6C0',
  success: '#2EC287',
  warning: '#FFC55A',
  danger: '#FF5474',
  dangerAlt: '#FF7892',
  gradientTop: '#102036',
  gradientMid: '#152C45',
  gradientBottom: '#1D3A55'
};

// Nueva paleta clara "base blanca" más alegre
const lightColors = {
  bg: '#F4F8FF',
  bgAlt: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F2F6FD',
  surface: 'rgba(0,0,0,0.04)',
  surfaceAlt: 'rgba(0,0,0,0.08)',
  overlay: 'rgba(255,255,255,0.55)',
  border: '#D3DDED',
  divider: '#E1E8F3',
  text: '#182235',
  subtext: '#586482',
  textDim: '#7C889E',
  white: '#FFFFFF',
  primary: '#4D7CFF',
  primaryAlt: '#825BFF',
  primaryText: '#FFFFFF',
  secondary: '#C153FF',
  focus: '#5F74FF',
  positive: '#18B9A3',
  success: '#1F9F6C',
  warning: '#F4B12F',
  danger: '#E34761',
  dangerAlt: '#FF6C8F',
  gradientTop: '#FFFFFF',
  gradientMid: '#F1F5FF',
  gradientBottom: '#E0E9FA'
};

export const theme = {
  mode: 'dark' as 'light' | 'dark',
  colors: darkColors,
  darkColors,
  lightColors,
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
    // Azul claro → violeta suave → violeta claro
    brand: ['#55A8FF', '#6A7CFF', '#9F62FF'],
    brandSoft: ['rgba(85,168,255,0.25)', 'rgba(159,98,255,0.25)'],
    positive: ['#27D6C0', '#6A7CFF'],
    dark: ['#102036', '#152C45', '#1D3A55'],
    glowTop: ['rgba(85,168,255,0.22)', 'rgba(85,168,255,0)'],
    glowBottom: ['rgba(159,98,255,0)', 'rgba(159,98,255,0.18)']
  },
  layout: {
    maxWidth: 480,
    authWidth: 420
  }
};
