import { MAX_WORD_LENGTH, MIN_WORD_LENGTH } from './constants.js';

/**
 * Deja una palabra comparable con el diccionario: minúsculas y sin tildes ni diéresis
 * ("Camión" → "camion", "pingüino" → "pinguino"). La ñ se conserva.
 */
export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ');
}

/** Puntos de una palabra válida: uno por letra. */
export function wordPoints(word: string): number {
  return word.length;
}

/**
 * Comprueba la forma de una palabra (ya normalizada) frente a la sílaba que toca.
 * No mira el diccionario: eso lo hace el servidor. Devuelve el motivo del rechazo o null.
 */
export function checkWordShape(word: string, syllable: string): string | null {
  if (!word) return 'Escribe una palabra';
  if (!/^[a-zñ]+$/.test(word)) return 'Solo letras, sin espacios ni símbolos';
  if (word.length < MIN_WORD_LENGTH) return `Mínimo ${MIN_WORD_LENGTH} letras`;
  if (word.length > MAX_WORD_LENGTH) return `Máximo ${MAX_WORD_LENGTH} letras`;
  if (!word.includes(syllable)) return `No contiene «${syllable.toUpperCase()}»`;
  return null;
}
