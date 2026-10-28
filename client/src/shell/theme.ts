import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'typeracer:theme';
const listeners = new Set<() => void>();

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Tema actual: el elegido por el usuario o, si nunca eligió, el del sistema. */
export function getTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme | undefined) ?? storedTheme() ?? systemTheme();
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // sin almacenamiento: el tema dura solo esta visita
  }
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, getTheme);
}

// Si el usuario no eligió tema, se sigue al sistema también cuando cambia.
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (storedTheme()) return;
  document.documentElement.dataset.theme = systemTheme();
  listeners.forEach((l) => l());
});
