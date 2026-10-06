"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

/* v2: re-defaults every browser to dark (v1 stored-light choices from the
   follow-OS era are retired, not honored). Users can still pick light. */
const STORAGE_KEY = "tf.theme.v2";

type ThemeContextValue = {
  theme: Theme;
  isDark: boolean;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  isDark: true,
  setTheme: () => {},
  toggle: () => {},
});

function getStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // storage unavailable — fall through to the dark default
  }
  return null;
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // private mode etc. — theme still applies for the session
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dark-first: stored choice wins, otherwise dark. SSR falls back to dark
  // (layout inline script already set the class pre-paint, this syncs state).
  // Lazy initializer — no mount effect, no cascading render.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? "dark" : (getStoredTheme() ?? "dark"),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme ]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
