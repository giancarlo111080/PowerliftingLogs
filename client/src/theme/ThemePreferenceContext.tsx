import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { useSession } from "../auth/AuthSessionContext";

export type ThemePreference = "dark" | "light";

interface ThemePreferenceContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function themeStorageKey(userId: string) {
  return `iron-forge/theme/${userId}`;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "dark" || value === "light";
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const [theme, setThemeState] = useState<ThemePreference>("dark");

  useEffect(() => {
    let isMounted = true;
    async function restoreTheme() {
      if (!session) {
        return;
      }
      try {
        const storedTheme = await AsyncStorage.getItem(themeStorageKey(session.userId));
        if (isMounted) {
          setThemeState(isThemePreference(storedTheme) ? storedTheme : "dark");
        }
      }
      catch {
        if (isMounted) {
          setThemeState("dark");
        }
      }
    }
    void restoreTheme();
    return () => {
      isMounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    }
  }, [theme]);

  async function setTheme(nextTheme: ThemePreference) {
    setThemeState(nextTheme);
    if (session) {
      await AsyncStorage.setItem(themeStorageKey(session.userId), nextTheme);
    }
  }

  async function toggleTheme() {
    await setTheme(theme === "dark" ? "light" : "dark");
  }

  return <ThemePreferenceContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemePreferenceProvider.");
  }
  return context;
}