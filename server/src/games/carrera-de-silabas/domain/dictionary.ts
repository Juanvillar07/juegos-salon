import { createRequire } from 'node:module';
import { normalizeWord } from '@typeracer/shared/carrera-de-silabas';

/** Una sílaba entra al sorteo solo si aparece en al menos estas palabras: así nunca sale una imposible. */
export const MIN_WORDS_PER_SYLLABLE = 3000;
const SYLLABLE_LENGTHS = [2, 3];

/** Diccionario de ~636 000 palabras en español (paquete an-array-of-spanish-words, MIT). */
export function loadSpanishWords(): string[] {
  return createRequire(import.meta.url)('an-array-of-spanish-words') as string[];
}

/** Normaliza las palabras igual que las respuestas de los jugadores y descarta las que no son solo letras. */
export function buildDictionary(words: Iterable<string>): Set<string> {
  const dictionary = new Set<string>();
  for (const raw of words) {
    const word = normalizeWord(raw);
    if (/^[a-zñ]+$/.test(word)) dictionary.add(word);
  }
  return dictionary;
}

/** Sílabas de 2 y 3 letras, con al menos una vocal, que aparecen en muchas palabras del diccionario. */
export function buildSyllablePool(dictionary: Iterable<string>, minWords = MIN_WORDS_PER_SYLLABLE): string[] {
  const counts = new Map<string, number>();
  for (const word of dictionary) {
    const seen = new Set<string>();
    for (const length of SYLLABLE_LENGTHS) {
      for (let i = 0; i + length <= word.length; i++) seen.add(word.slice(i, i + length));
    }
    seen.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
  }
  return [...counts]
    .filter(([s, n]) => n >= minWords && /[aeiou]/.test(s))
    .map(([s]) => s)
    .sort();
}

/** Devuelve `count` sílabas al azar sin repetir (si el sorteo se queda corto, vuelve a empezar). */
export function createSyllablePicker(pool: string[], random: () => number = Math.random) {
  if (pool.length === 0) throw new Error('No hay sílabas para sortear');
  return (count: number): string[] => {
    const result: string[] = [];
    while (result.length < count) {
      const bag = [...pool];
      // Fisher-Yates parcial: solo se barajan las que hacen falta.
      for (let i = 0; i < bag.length && result.length < count; i++) {
        const j = i + Math.floor(random() * (bag.length - i));
        [bag[i], bag[j]] = [bag[j], bag[i]];
        // Al volver a empezar, se evita repetir la misma sílaba dos veces seguidas.
        if (pool.length === 1 || bag[i] !== result[result.length - 1]) result.push(bag[i]);
      }
    }
    return result;
  };
}
