import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getThemePreference, setThemePreference, ThemeName } from './storage';

// ─── Palettes ─────────────────────────────────────────────────────────────────

export const lightTheme = {
  background:   '#DAE0E6',
  surface:      '#FFFFFF',
  surfaceElevated: '#F6F7F8',
  border:       '#CCCCCC',
  text:         '#1A1A1B',
  textMuted:    '#787C7E',
  textDisabled: '#AAAAAA',
  brand:        '#7ba0b3',
  primary:      '#FF4500',
  primaryMuted: 'rgba(255,69,0,0.12)',
};

export const darkTheme = {
  background:   '#000000',
  surface:      '#1E1E1E',
  surfaceElevated: '#2A2A2A',
  border:       '#343536',
  text:         '#D7DADC',
  textMuted:    '#818384',
  textDisabled: '#555555',
  brand:        '#7ba0b3',
  primary:      '#FF4500',
  primaryMuted: 'rgba(255,69,0,0.15)',
};

export type AppTheme = typeof darkTheme;

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: AppTheme;
  themeName: ThemeName;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  themeName: 'dark',
  toggleTheme: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('dark');

  // Load persisted preference on mount
  useEffect(() => {
    getThemePreference().then((saved) => setThemeName(saved));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeName((prev) => {
      const next: ThemeName = prev === 'dark' ? 'light' : 'dark';
      setThemePreference(next);
      return next;
    });
  }, []);

  const theme = themeName === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
