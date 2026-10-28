import { RACE_LIMIT_MS } from './constants.js';

/** Configuración de la sala que elige el host. */
export interface RoomSettings {
  /** Puntos necesarios para cruzar la meta. */
  target: number;
  /** Límite de tiempo de cada carrera, en segundos: los que no llegan se ordenan por puntos. */
  timeLimitSec: number;
}

export const TARGET_OPTIONS = [100, 200] as const;
export const TIME_LIMIT_OPTIONS = [120, 180, 300, 420, 600] as const;

export const DEFAULT_SETTINGS: RoomSettings = {
  target: TARGET_OPTIONS[0],
  timeLimitSec: RACE_LIMIT_MS / 1000,
};

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
