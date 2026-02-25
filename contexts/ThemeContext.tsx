import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
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
  const deviceScheme = useDeviceColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  // Load persisted theme preference
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.themeMode) {
            setThemeModeState(parsed.themeMode);
          }
        }
      } catch {}
      setLoaded(true);
    };
    load();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const s = stored ? JSON.parse(stored) : {};
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...s, themeMode: mode })
      );
    } catch {}
  }, []);

  const colorScheme: 'light' | 'dark' =
    themeMode === 'system'
      ? deviceScheme === 'dark'
        ? 'dark'
        : 'light'
      : themeMode;

  const isDark = colorScheme === 'dark';

  // Don't render until we've loaded the preference to prevent flash
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
