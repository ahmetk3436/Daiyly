import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  colorScheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  isDark: false,
  setThemeMode: () => {},
  colorScheme: 'light',
});

const STORAGE_KEY = '@daiyly_settings';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  // Load persisted theme preference and apply to NativeWind
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.themeMode) {
            setThemeModeState(parsed.themeMode);
            setColorScheme(parsed.themeMode);
          }
        }
      } catch {}
      setLoaded(true);
    };
    load();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    setColorScheme(mode);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const s = stored ? JSON.parse(stored) : {};
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...s, themeMode: mode })
      );
    } catch {}
  }, [setColorScheme]);

  const isDark = colorScheme === 'dark';

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode, colorScheme: colorScheme ?? 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
