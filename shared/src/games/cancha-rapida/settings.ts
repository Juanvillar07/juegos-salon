/** Configuración del partido que elige el host. */
export interface RoomSettings {
  /** Goles para ganar; 0 = sin límite (se juega todo el tiempo). */
  scoreLimit: number;
  /** Duración del partido, en minutos de juego (las pausas de gol no cuentan). */
  timeLimitMin: number;
}

export const SCORE_LIMIT_OPTIONS = [1, 3, 5, 0] as const;
export const TIME_LIMIT_OPTIONS = [3, 5, 7, 10] as const;

export const DEFAULT_SETTINGS: RoomSettings = { scoreLimit: 3, timeLimitMin: 3 };

export function validateScoreLimit(value: unknown): string | null {
  return (SCORE_LIMIT_OPTIONS as readonly unknown[]).includes(value) ? null : 'Límite de goles no válido';
}

export function validateTimeLimit(value: unknown): string | null {
  if (!(TIME_LIMIT_OPTIONS as readonly unknown[]).includes(value)) {
    return `El partido debe durar ${TIME_LIMIT_OPTIONS.join(', ')} minutos`;
  }
  return null;
}
