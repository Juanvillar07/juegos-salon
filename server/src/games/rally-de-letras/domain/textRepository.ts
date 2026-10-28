import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RaceText } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
// Funciona igual desde src/games/... (tsx) y dist/games/... (build).
const DEFAULT_PATH = resolve(here, '../../../../data/texts.json');

export function loadTexts(path = DEFAULT_PATH): RaceText[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as string[];
  return raw.map((text, id) => ({ id, text: text.trim() }));
}

/** Elige un texto al azar distinto del último usado en la sala. */
export function createTextPicker(texts: RaceText[]) {
  return (excludeId: number | null): RaceText => {
    const pool = texts.length > 1 ? texts.filter((t) => t.id !== excludeId) : texts;
    return pool[Math.floor(Math.random() * pool.length)];
  };
}
