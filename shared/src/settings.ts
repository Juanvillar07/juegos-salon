import { RACE_LIMIT_MS } from './constants.js';

/** Longitud de los textos del catálogo: cualquiera, o solo cortos, medios o largos. */
export type TextLength = 'any' | 'short' | 'medium' | 'long';

export const TEXT_LENGTH_OPTIONS: readonly TextLength[] = ['any', 'short', 'medium', 'long'];

/** Caracteres de cada longitud del catálogo (el corto y el largo, abiertos por un lado). */
export const TEXT_LENGTH_RANGES: Record<Exclude<TextLength, 'any'>, { min: number; max: number }> = {
  short: { min: 0, max: 199 },
  medium: { min: 200, max: 300 },
  long: { min: 301, max: Infinity },
};

/** Configuración de la sala que elige el host. */
export interface RoomSettings {
  /** Límite de tiempo de cada carrera, en segundos. */
  timeLimitSec: number;
  /** Texto pegado por el host; null = un texto aleatorio del catálogo en cada carrera. */
  customText: string | null;
  /** Longitud de los textos aleatorios (no se aplica al texto pegado). */
  textLength: TextLength;
  /** Quita ¿ ¡ y comillas del texto, para quien juega con un teclado sin esas teclas. */
  plainText: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  timeLimitSec: RACE_LIMIT_MS / 1000,
  customText: null,
  textLength: 'any',
  plainText: false,
};

export function isTextLength(value: unknown): value is TextLength {
  return (TEXT_LENGTH_OPTIONS as readonly unknown[]).includes(value);
}

/** Longitud del catálogo a la que pertenece un texto de `chars` caracteres. */
export function textLengthOf(chars: number): Exclude<TextLength, 'any'> {
  if (chars <= TEXT_LENGTH_RANGES.short.max) return 'short';
  if (chars <= TEXT_LENGTH_RANGES.medium.max) return 'medium';
  return 'long';
}

/**
 * "Sin signos": quita los signos que faltan en los teclados en inglés (¿ ¡ y las comillas)
 * y vuelve a dejar un solo espacio donde hiciera falta.
 */
export function stripSigns(text: string): string {
  return text
    .replace(/[¿¡"']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

export const TIME_LIMIT_OPTIONS = [30, 60, 90, 120, 180, 300, 600] as const;
export const MIN_TIME_LIMIT_SEC = 15;
export const MAX_TIME_LIMIT_SEC = 900;

export const MIN_CUSTOM_TEXT_LENGTH = 20;
export const MAX_CUSTOM_TEXT_LENGTH = 1500;

/**
 * Deja un texto pegado listo para escribirse con cualquier teclado: comillas y guiones
 * tipográficos pasan a su versión simple y todos los espacios y saltos de línea se
 * reducen a un único espacio (el juego avanza palabra por palabra).
 */
export function normalizeRaceText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[  -​  　]/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Devuelve un mensaje de error si el texto (ya normalizado) no sirve para una carrera. */
export function validateCustomText(text: string): string | null {
  if (text.length < MIN_CUSTOM_TEXT_LENGTH) return `El texto debe tener al menos ${MIN_CUSTOM_TEXT_LENGTH} caracteres`;
  if (text.length > MAX_CUSTOM_TEXT_LENGTH) return `El texto no puede superar ${MAX_CUSTOM_TEXT_LENGTH} caracteres`;
  return null;
}

export function validateTimeLimit(sec: unknown): string | null {
  if (typeof sec !== 'number' || !Number.isInteger(sec)) return 'El tiempo debe ser un número entero de segundos';
  if (sec < MIN_TIME_LIMIT_SEC || sec > MAX_TIME_LIMIT_SEC) {
    return `El tiempo debe estar entre ${MIN_TIME_LIMIT_SEC} s y ${MAX_TIME_LIMIT_SEC / 60} min`;
  }
  return null;
}
