import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from 'react';

import { theme as baseTheme, onPaletteChange } from './theme';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: typeof baseTheme;
  toggleMode: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children, initialMode }: { children: ReactNode; initialMode?: ThemeMode }) => {
  const [mode, setModeState] = useState<ThemeMode>(initialMode || baseTheme.mode);
  // Track palette changes so that memoized theme picks up palette updates (magenta/owner)
  const [palette, setPalette] = useState<string>((baseTheme as any).currentPalette || 'magenta');
  useEffect(() => {
    const unsub = onPaletteChange?.((name) => setPalette(name));
    return () => { try { unsub && (unsub as any)(); } catch {} };
  }, []);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggleMode = useCallback(() => setModeState(m => (m === 'light' ? 'dark' : 'light')), []);

  const theme = useMemo(
    () => ({ ...baseTheme, mode, colors: mode === 'light' ? baseTheme.lightColors : baseTheme.darkColors }),
    [mode, palette]
  );

  const value = useMemo(() => ({ mode, theme, toggleMode, setMode }), [mode, theme, toggleMode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}

// Utilidad de focus ring según modo
export function focusRing(mode: ThemeMode) {
  if (mode === 'dark') {
    return {
      shadowColor: '#5D5FEF',
      shadowOpacity: 0.5,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
      outlineWidth: 0
    } as const;
  }
  return {
    shadowColor: '#5D5FEF',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0
  } as const;
}
