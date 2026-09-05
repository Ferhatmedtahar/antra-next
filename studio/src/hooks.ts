import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** Bumped after any mutation (scan, config save, baseline) so every view refetches. */
export const RefreshContext = createContext<{
  version: number;
  bump: () => void;
}>({
  version: 0,
  bump: () => undefined,
});

export function useRefresh() {
  return useContext(RefreshContext);
}

export interface Loadable<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Fetch-on-mount with refetch on the global refresh version. */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly unknown[] = [],
): Loadable<T> {
  const { version } = useRefresh();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `load` is intentionally not a dependency: callers pass the cache key via `deps`.
  }, [version, tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

export type Theme = "light" | "dark";
const THEME_KEY = "bg-studio-theme";

export const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => undefined });

export function useTheme() {
  return useContext(ThemeContext);
}

/** Owns the `.dark` class on <html>; index.html applies it before first paint. */
export function useThemeState(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private mode — the choice just won't persist.
    }
  }, [theme]);
  const toggle = useCallback(
    () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    [],
  );
  return { theme, toggle };
}
