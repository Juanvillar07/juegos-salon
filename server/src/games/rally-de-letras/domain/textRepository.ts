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

/**
 * Elige un texto al azar que la sala no haya corrido hace poco (`recent`, del más antiguo al
 * más nuevo). Si ya los usó todos, solo evita repetir el último.
 */
export function createTextPicker(texts: RaceText[], random: () => number = Math.random) {
  return (recent: readonly number[]): RaceText => {
    const used = new Set(recent);
    let pool = texts.filter((t) => !used.has(t.id));
    if (pool.length === 0) pool = texts.length > 1 ? texts.filter((t) => t.id !== recent.at(-1)) : texts;
    return pool[Math.floor(random() * pool.length)];
  };
}
