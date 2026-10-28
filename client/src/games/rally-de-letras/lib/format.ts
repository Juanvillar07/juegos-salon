export function ordinal(n: number): string {
  return `${n}.º`;
}

/** Duración legible: 30 s, 1 min, 1:30 min, 10 min. */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}

/** WPM mínimo para escribir `chars` caracteres en `sec` segundos. */
export function requiredWpm(chars: number, sec: number): number {
  return Math.ceil(chars / 5 / (sec / 60));
}

/** Milisegundos restantes como m:ss. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
