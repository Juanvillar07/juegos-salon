/** Configuración del partido que elige el host. */
export interface RoomSettings {
  /** Goles para ganar; 0 = sin límite (se juega todo el tiempo). */
  scoreLimit: number;
  /** Duración del partido, en minutos de juego (las pausas de gol no cuentan). */
  timeLimitMin: number;
  /** Tiro cargado (mantener y soltar para dar potencia) o patada clásica de fuerza fija. */
  chargedShot: boolean;
  /** Qué pasa si se acaba el tiempo con empate. */
  tiebreak: Tiebreak;
}

/** draw: queda empate; goldenGoal: se sigue y el primer gol gana; penalties: tanda de penaltis. */
export type Tiebreak = 'draw' | 'goldenGoal' | 'penalties';

export const SCORE_LIMIT_OPTIONS = [1, 3, 5, 0] as const;
export const TIME_LIMIT_OPTIONS = [3, 5, 7, 10] as const;
export const TIEBREAK_OPTIONS: readonly Tiebreak[] = ['draw', 'goldenGoal', 'penalties'];

export const DEFAULT_SETTINGS: RoomSettings = { scoreLimit: 3, timeLimitMin: 3, chargedShot: true, tiebreak: 'draw' };

export function validateScoreLimit(value: unknown): string | null {
  return (SCORE_LIMIT_OPTIONS as readonly unknown[]).includes(value) ? null : 'Límite de goles no válido';
}

export function validateTimeLimit(value: unknown): string | null {
  if (!(TIME_LIMIT_OPTIONS as readonly unknown[]).includes(value)) {
    return `El partido debe durar ${TIME_LIMIT_OPTIONS.join(', ')} minutos`;
  }
  return null;
}

export function validateChargedShot(value: unknown): string | null {
  return typeof value === 'boolean' ? null : 'Tipo de tiro no válido';
}

export function validateTiebreak(value: unknown): string | null {
  return (TIEBREAK_OPTIONS as readonly unknown[]).includes(value) ? null : 'Desempate no válido';
}
