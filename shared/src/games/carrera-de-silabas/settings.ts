import { RACE_LIMIT_MS } from './constants.js';

/** Configuración de la sala que elige el host. */
export interface RoomSettings {
  /** Puntos necesarios para cruzar la meta. */
  target: number;
  /** Límite de tiempo de cada carrera, en segundos: los que no llegan se ordenan por puntos. */
  timeLimitSec: number;
  /** Lo que cuesta pasar a la siguiente sílaba: puntos, segundos sin escribir o ambas cosas. */
  skipPenalty: SkipPenalty;
}

export type SkipPenalty = 'points' | 'time' | 'both';
export const SKIP_PENALTY_OPTIONS: readonly SkipPenalty[] = ['points', 'time', 'both'];
/** Puntos que se pierden al pasar (sin bajar de 0). */
export const SKIP_POINTS = 5;
/** Tiempo sin poder escribir al pasar. */
export const SKIP_BLOCK_MS = 3000;

export const TARGET_OPTIONS = [100, 200] as const;
export const TIME_LIMIT_OPTIONS = [120, 180, 300, 420, 600] as const;

export const DEFAULT_SETTINGS: RoomSettings = {
  target: TARGET_OPTIONS[0],
  timeLimitSec: RACE_LIMIT_MS / 1000,
  skipPenalty: 'time',
};

export function validateSkipPenalty(value: unknown): string | null {
  return (SKIP_PENALTY_OPTIONS as readonly unknown[]).includes(value) ? null : 'Penalización no válida';
}

export function validateTimeLimit(sec: unknown): string | null {
  if (!(TIME_LIMIT_OPTIONS as readonly unknown[]).includes(sec)) {
    return `El tiempo debe ser de ${TIME_LIMIT_OPTIONS.map((s) => s / 60).join(', ')} minutos`;
  }
  return null;
}

export function validateTarget(target: unknown): string | null {
  if (!(TARGET_OPTIONS as readonly unknown[]).includes(target)) {
    return `La meta debe ser de ${TARGET_OPTIONS.join(' o ')} puntos`;
  }
  return null;
}
